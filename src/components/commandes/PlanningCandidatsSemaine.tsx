import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { addDays, format, startOfWeek, getISOWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { disponibiliteColors, statutColors } from "@/lib/colors"
import { Calendar, CheckCircle2, Filter, FileText, AlertCircle, Clock } from "lucide-react"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"
import { secteursList } from "@/lib/secteurs"
import FicheMemoCandidat from "@/components/commandes/Fiche-Memo-Candidat"

type PlanifData = {
  candidat_id: string
  date: string
  heure_debut_matin: string | null
  heure_fin_matin: string | null
  heure_debut_soir: string | null
  heure_fin_soir: string | null
  client: { nom: string } | null
  statut: string
}

type DispoData = {
  candidat_id: string
  date: string
  statut: "Dispo" | "Non Dispo" | "Non Renseigné"
  dispo_matin: boolean
  dispo_soir: boolean
}

export function PlanningCandidatsSemaine({
  semaineDate,
  secteur,
}: {
  semaineDate: string
  secteur: string
}) {
  const { data: candidats = [] } = useCandidatsBySecteur(secteur)
  const [jours, setJours] = useState<Date[]>([])
  const [dispos, setDispos] = useState<DispoData[]>([])
  const [planifs, setPlanifs] = useState<PlanifData[]>([])

  // UI (interrupteur + recherche)
  const [filterOnlyWithData, setFilterOnlyWithData] = useState(false)
  const [search, setSearch] = useState("")

  // Fiche mémo candidat
  const [memoOpen, setMemoOpen] = useState(false)
  const [memoCandidatId, setMemoCandidatId] = useState<string>("")

  // Bulle d’info mission secondaire (par cellule)
  const [openAlertKey, setOpenAlertKey] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const baseDate = semaineDate ? new Date(semaineDate) : new Date()
      const lundi = startOfWeek(baseDate, { weekStartsOn: 1 })
      const joursSem = Array.from({ length: 7 }, (_, i) => addDays(lundi, i))
      setJours(joursSem)

      const dates = joursSem.map((d) => format(d, "yyyy-MM-dd"))
      const ids = candidats.map((c) => c.id)
      if (ids.length === 0) {
        setDispos([])
        setPlanifs([])
        return
      }

      const { data: dispoData } = await supabase
        .from("disponibilites")
        .select("candidat_id, date, statut, dispo_matin, dispo_soir")
        .in("date", dates)
        .in("candidat_id", ids)

      setDispos((dispoData as DispoData[]) || [])

      const { data: planifData } = await supabase
        .from("commandes")
        .select(
          "candidat_id, date, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir, statut, client:client_id (nom)"
        )
        .in("date", dates)
        .in("candidat_id", ids)

      setPlanifs((planifData as PlanifData[]) || [])
    }

    fetchData()
  }, [semaineDate, secteur, candidats])

  // Helpers
  const k = (candidatId: string, dateStr: string) => `${candidatId}|${dateStr}`
  const H = (h?: string | null) => (h && h.length >= 5 ? h.slice(0, 5) : "")

  // ————————— Sélection principale/secondaire (mimique du planning candidat) —————————
  type Pair = { main?: PlanifData; second?: PlanifData }

  const planifPairs = useMemo(() => {
    // on ne travaille QUE sur les missions Validé pour choisir main/second
    const valides = planifs.filter((p) => (p.statut || "").toLowerCase() === "validé")

    // regrouper par (candidat, date)
    const groups = new Map<string, PlanifData[]>()
    for (const p of valides) {
      const key = k(p.candidat_id, p.date)
      const arr = groups.get(key)
      if (arr) arr.push(p)
      else groups.set(key, [p])
    }

    const result = new Map<string, Pair>()
    for (const [key, arr] of groups) {
      // repérer une mission “matin” et une mission “soir”
      const missionMatin = arr.find((p) => p.heure_debut_matin && p.heure_fin_matin)
      const missionSoir  = arr.find((p) => p.heure_debut_soir  && p.heure_fin_soir)

      let main: PlanifData | undefined
      let second: PlanifData | undefined

      if (missionMatin) {
        main = missionMatin // priorité à la mission du matin/midi
        if (missionSoir && (missionSoir.client?.nom || "") !== (missionMatin.client?.nom || "")) {
          second = missionSoir
        }
      } else if (missionSoir) {
        // seulement une mission soir validée
        main = missionSoir
      } else {
        // Validé sans heures -> on prend la première pour ne pas afficher d’annexe ici
        main = arr[0]
      }

      result.set(key, { main, second })
    }

    return result
  }, [planifs])

  // Index principal + secondaire
  const planifIndex = useMemo(() => {
    const idx = new Map<string, PlanifData>()
    for (const [key, pair] of planifPairs) {
      if (pair.main) idx.set(key, pair.main)
    }
    return idx
  }, [planifPairs])

  const planifSecondIndex = useMemo(() => {
    const idx = new Map<string, PlanifData>()
    for (const [key, pair] of planifPairs) {
      if (pair.second) idx.set(key, pair.second)
    }
    return idx
  }, [planifPairs])

  const dispoIndex = useMemo(() => {
    const idx = new Map<string, DispoData>()
    for (const d of dispos) idx.set(`${d.candidat_id}|${d.date}`, d)
    return idx
  }, [dispos])

  // Icônes
  const CellIcon = ({ statut }: { statut: string }) => {
    const s = (statut || "").toLowerCase()
    if (s === "validé") {
      return (
        <CheckCircle2
          className="w-5 h-5"
          style={{ color: statutColors["Validé"]?.bg }}
        />
      )
    }
    const color =
      statutColors[statut as keyof typeof statutColors]?.bg || "#d1d5db"
    return (
      <div
        className="w-3.5 h-3.5 rounded-full"
        style={{ backgroundColor: color }}
      />
    )
  }

  const DispoDot = ({ type }: { type: "Dispo" | "Non Dispo" }) => {
    const color = disponibiliteColors[type]?.bg || "#d1d5db"
    return (
      <div
        className="w-3.5 h-3.5 rounded-full"
        style={{ backgroundColor: color }}
      />
    )
  }

  // Corps de cellule
  const renderInfosSousIcone = (p?: PlanifData, d?: DispoData) => {
    if (p) {
      const matin =
        p.heure_debut_matin && p.heure_fin_matin
          ? `${H(p.heure_debut_matin)}–${H(p.heure_fin_matin)}`
          : ""
      const soir =
        p.heure_debut_soir && p.heure_fin_soir
          ? `${H(p.heure_debut_soir)}–${H(p.heure_fin_soir)}`
          : ""
      return (
        <div className="mt-1 text-[11px] leading-tight text-gray-700">
          <div className="px-1 font-bold break-words">{p.client?.nom || " "}</div>
          <div className="mt-0.5 grid grid-rows-2 gap-0.5">
            <div className="h-4">{matin}</div>
            <div className="h-4">{soir}</div>
          </div>
        </div>
      )
    }

    if (d && d.statut === "Dispo") {
      return (
        <div className="mt-1 text-[11px] leading-tight text-gray-700">
          <div className="grid grid-rows-2 gap-0.5">
            <div className="h-4">{d.dispo_matin ? "Matin / Midi" : ""}</div>
            <div className="h-4">{d.dispo_soir ? "Soir" : ""}</div>
          </div>
        </div>
      )
    }

    return null
  }

  // En-tête jour
  const HeaderCell = ({ d }: { d: Date }) => (
    <div className="text-center px-2 py-2 leading-tight">
      <div className="capitalize text-[12px] font-medium">
        {format(d, "EEEE d", { locale: fr })}
      </div>
      <div className="capitalize text-[11px] text-gray-600">
        {format(d, "LLLL", { locale: fr })}
      </div>
    </div>
  )

  // Semaine ISO
  const semaineNum = useMemo(() => {
    const baseDate = semaineDate ? new Date(semaineDate) : new Date()
    return getISOWeek(baseDate)
  }, [semaineDate])

  // Filtrage (interrupteur + recherche)
  const hasUsefulDataForWeek = (candidatId: string) => {
    for (const d of jours) {
      const dateStr = format(d, "yyyy-MM-dd")
      const p = planifIndex.get(k(candidatId, dateStr))
      if (p) return true
      const dispo = dispoIndex.get(k(candidatId, dateStr))
      if (dispo && (dispo.statut === "Dispo" || dispo.statut === "Non Dispo"))
        return true
    }
    return false
  }

  const filteredCandidats = useMemo(() => {
    const q = search.trim().toLowerCase()
    return candidats.filter((c) => {
      const okSearch =
        q.length === 0 ||
        c.nom?.toLowerCase().startsWith(q) ||
        c.prenom?.toLowerCase().startsWith(q)

      if (!okSearch) return false
      if (!filterOnlyWithData) return true
      return hasUsefulDataForWeek(c.id)
    })
  }, [candidats, search, filterOnlyWithData, jours, planifIndex, dispoIndex])

  // Icône secteur
  const secteurInfo = useMemo(() => {
    return secteursList.find((s) => s.label === secteur)
  }, [secteur])

  // Ouvre la fiche mémo
  const openMemoFor = (candidatId: string) => {
    setMemoCandidatId(candidatId)
    setMemoOpen(true)
  }

  return (
    <>
      {/* Fiche mémo (dialog) */}
      {memoCandidatId && (
        <FicheMemoCandidat
          open={memoOpen}
          onOpenChange={setMemoOpen}
          candidatId={memoCandidatId}
        />
      )}

      <div className="space-y-4">
        {/* Barre supérieure sticky */}
        <div className="sticky top-0 z-30 bg-white border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1.5 sm:px-2 py-2">
            <h3 className="text-base font-semibold inline-flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#840404]" />
              <span>Planning – Semaine {semaineNum}</span>
            </h3>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#840404] cursor-pointer"
                  checked={filterOnlyWithData}
                  onChange={(e) => setFilterOnlyWithData(e.target.checked)}
                />
                <span className="inline-flex items-center gap-1">
                  <Filter className="w-4 h-4" />
                  Filtrer les données
                </span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher candidat…"
                  className="h-8 w-[220px] sm:w-[260px] rounded-md border px-2 text-sm outline-none focus:ring-2 focus:ring-[#840404]/30"
                />
              </div>
            </div>
          </div>
        </div>

        {filteredCandidats.length === 0 ? (
          <div className="text-sm text-muted-foreground italic px-1.5">
            Aucun candidat correspondant.
          </div>
        ) : (
          <div className="border rounded-md bg-white w-full">
            {/* En-tête de la grille (sticky sous la barre) */}
            <div className="grid grid-cols-[140px_repeat(7,1fr)] items-center bg-gray-50 sticky top-[44px] sm:top-[48px] z-20 border-b shadow-sm">
              <div className="px-3 py-3 text-xs font-medium flex items-center gap-2">
                {secteurInfo ? <secteurInfo.icon className="h-4 w-4" /> : null}
                <span>{secteur}</span>
              </div>
              {jours.map((j, i) => (
                <HeaderCell key={i} d={j} />
              ))}
            </div>

            {/* Lignes candidats */}
            <div>
              {filteredCandidats.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[140px_repeat(7,1fr)] border-b"
                  style={{ minHeight: "96px" }}
                >
                  {/* Colonne candidat */}
                  <div className="px-3 py-2 flex items-center">
                    <div className="my-auto flex items-center gap-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {c.nom}
                        </div>
                        <div className="text-xs text-gray-700">{c.prenom}</div>
                      </div>
                      <button
                        onClick={() => openMemoFor(c.id)}
                        title="Ouvrir la fiche mémo candidat"
                        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-[#840404] transition"
                        aria-label={`Ouvrir la fiche mémo de ${c.prenom} ${c.nom}`}
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 7 jours */}
                  {jours.map((j, i) => {
                    const dateStr = format(j, "yyyy-MM-dd")
                    const key = k(c.id, dateStr)

                    const main = planifIndex.get(key) // mission principale (matin si possible)
                    const second = planifSecondIndex.get(key) // mission du second créneau (soir)
                    const d = main ? undefined : dispoIndex.get(key)
                    const noData = !main && (!d || d.statut === "Non Renseigné")

                    // Alerte seulement si seconde mission et client différent
                    const showAlert =
                      !!second &&
                      (second.client?.nom || "") !== (main?.client?.nom || "")

                    let topIcon: JSX.Element | null = null
                    if (!noData) {
                      if (main) {
                        topIcon = <CellIcon statut={main.statut || ""} />
                      } else if (d) {
                        if (d.statut === "Dispo")
                          topIcon = <DispoDot type="Dispo" />
                        else if (d.statut === "Non Dispo")
                          topIcon = <DispoDot type="Non Dispo" />
                      }
                    }

                    const secondMatin =
                      second?.heure_debut_matin && second?.heure_fin_matin
                        ? `${H(second.heure_debut_matin)}–${H(second.heure_fin_matin)}`
                        : ""
                    const secondSoir =
                      second?.heure_debut_soir && second?.heure_fin_soir
                        ? `${H(second.heure_debut_soir)}–${H(second.heure_fin_soir)}`
                        : ""

                    return (
                      <div
                        key={i}
                        className="px-1 py-2 flex flex-col items-center justify-center text-center relative"
                      >
                        {!noData && (
                          <>
                            <div className="h-5 flex items-center justify-center gap-1">
                              {topIcon}

                              {showAlert && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenAlertKey((prev) =>
                                      prev === key ? null : key
                                    )
                                  }
                                  className="ml-1 inline-flex items-center justify-center"
                                  title="Autre mission planifiée ce jour (deuxième créneau)"
                                  aria-label="Autre mission planifiée ce jour"
                                >
                                  <AlertCircle className="w-4 h-4 text-[#840404]" />
                                </button>
                              )}
                            </div>

                            {renderInfosSousIcone(main, d)}

                            {/* Bulle d’info seconde mission (soir) */}
                            {showAlert && openAlertKey === key && (
                              <div
                                className="absolute top-7 right-2 z-30 w-56 rounded-md border bg-white shadow-lg p-2 text-left"
                                role="dialog"
                                aria-label="Détails de la seconde mission"
                                onMouseLeave={() => setOpenAlertKey(null)}
                              >
                                <div className="text-[11px] text-gray-900 font-semibold break-words">
                                  {second?.client?.nom || "Autre mission"}
                                </div>
                                <div className="mt-1 text-[11px] text-gray-700 space-y-0.5">
                                  {secondMatin && (
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5" />
                                      <span>Matin : {secondMatin}</span>
                                    </div>
                                  )}
                                  {secondSoir && (
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5" />
                                      <span>Soir : {secondSoir}</span>
                                    </div>
                                  )}
                                  {!secondMatin && !secondSoir && (
                                    <div>Horaires non renseignés</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
