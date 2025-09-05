// components/commandes/SyntheseCandidatDialog.tsx
import { useEffect, useMemo, useState } from "react"
import { addDays, format, startOfWeek, getISOWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { secteursList } from "@/lib/secteurs"
import { statutColors, disponibiliteColors } from "@/lib/colors"
import { Calendar, ChevronLeft, ChevronRight, Car, Clock } from "lucide-react"

type Candidat = {
  id: string
  nom: string
  prenom: string
  vehicule?: boolean | null
}

type Planif = {
  candidat_id: string
  date: string
  // on ne garde que Validé côté SQL ; heures + client pour l’affichage
  heure_debut_matin: string | null
  heure_fin_matin: string | null
  heure_debut_soir: string | null
  heure_fin_soir: string | null
  client: { nom: string } | null
  candidat?: { id: string; nom: string; prenom: string; vehicule?: boolean | null } | null
}

type Dispo = {
  candidat_id: string
  date: string
  statut: "Dispo" | "Non Dispo" | "Non Renseigné"
  dispo_matin: boolean | null
  dispo_soir: boolean | null
  candidats?: { id: string; nom: string; prenom: string; vehicule?: boolean | null } | null
}

// ——— helpers
const fmt = (h?: string | null) => (h && h.length >= 5 ? h.slice(0, 5) : "")
const getWeekDays = (base: Date) => {
  const monday = startOfWeek(base, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}
const PLANNING_BG = "#e5e7eb"

export default function SyntheseCandidat() {
  // Semaine + secteur visibles
  const [baseDate, setBaseDate] = useState<Date>(() => new Date())
  const [selectedSecteur, setSelectedSecteur] = useState<string>(() => secteursList[0]?.label || "Étages")

  const days = useMemo(() => getWeekDays(baseDate), [baseDate])
  const weekNum = useMemo(() => getISOWeek(baseDate), [baseDate])
  const weekDates = useMemo(() => days.map(d => format(d, "yyyy-MM-dd")), [days])

  // Données
  const [loading, setLoading] = useState(false)
  const [planifs, setPlanifs] = useState<Planif[]>([])
  const [dispos, setDispos] = useState<Dispo[]>([])
  const [candidats, setCandidats] = useState<Candidat[]>([])

  // ————————————————— Chargement minimal : 2 requêtes / semaine / secteur —————————————————
  useEffect(() => {
    let ignore = false
    ;(async () => {
      setLoading(true)

      // 1) Commandes VALIDÉES de la semaine & du secteur (avec joint client + candidat pour éviter une 3e requête)
      const { data: plan } = await supabase
        .from("commandes")
        .select(`
          candidat_id,
          date,
          heure_debut_matin, heure_fin_matin,
          heure_debut_soir,  heure_fin_soir,
          client:client_id ( nom ),
          candidat:candidat_id ( id, nom, prenom, vehicule )
        `)
        .eq("statut", "Validé")
        .eq("secteur", selectedSecteur)
        .in("date", weekDates)

      // 2) Disponibilités de la semaine & du secteur (avec joint candidat)
      const { data: disp } = await supabase
        .from("disponibilites")
        .select(`
          candidat_id,
          date,
          statut,
          dispo_matin, dispo_soir,
          candidats:candidat_id ( id, nom, prenom, vehicule )
        `)
        .eq("secteur", selectedSecteur)
        .in("date", weekDates)

      if (ignore) return

      const planRows = (plan as Planif[]) || []
      const dispRows = (disp as Dispo[]) || []

      setPlanifs(planRows)
      setDispos(dispRows)

      // Déduire la liste de candidats à afficher depuis les 2 datasets (pas de 3e requête)
      const byId = new Map<string, Candidat>()
      for (const p of planRows) {
        const c = p.candidat
        if (c && !byId.has(c.id)) byId.set(c.id, { id: c.id, nom: c.nom, prenom: c.prenom, vehicule: c.vehicule ?? null })
      }
      for (const d of dispRows) {
        const c = d.candidats
        if (c && !byId.has(c.id)) byId.set(c.id, { id: c.id, nom: c.nom, prenom: c.prenom, vehicule: c.vehicule ?? null })
      }

      const list = Array.from(byId.values()).sort((a, b) => (a.nom || "").localeCompare(b.nom || ""))
      setCandidats(list)
      setLoading(false)
    })()
    return () => { ignore = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSecteur, weekNum]) // change dès que la semaine affichée ou le secteur change

  // ————————————————— Index pour accès O(1) —————————————————
  const planIdx = useMemo(() => {
    // key: `${candidat_id}|${date}`
    const m = new Map<string, Planif[]>()
    for (const p of planifs) {
      const key = `${p.candidat_id}|${p.date}`
      const arr = m.get(key)
      if (arr) arr.push(p)
      else m.set(key, [p])
    }
    return m
  }, [planifs])

  const dispoIdx = useMemo(() => {
    const m = new Map<string, Dispo>()
    for (const d of dispos) m.set(`${d.candidat_id}|${d.date}`, d)
    return m
  }, [dispos])

  // ————————————————— Petits composants de rendu —————————————————
  const compactClient = (raw?: string) => {
    if (!raw) return "Client ?"
    const words = raw.trim().split(/\s+/)
    if (words.length <= 3) return raw
    const cleaned: string[] = []
    for (const w of words) {
      const lw = w.toLowerCase().replace(/[’']/g, "'")
      if (["le", "la", "les", "l'"].includes(lw)) continue
      cleaned.push(w)
    }
    const limited = (cleaned.length >= 3 ? cleaned.slice(0, 3) : words.slice(0, 3)).join(" ")
    return limited + " ..."
  }

  const VignettePlanifiee = ({
    client, h1, h2, emphasize = false,
  }: { client: string; h1?: string; h2?: string; emphasize?: boolean }) => (
    <div
      className="w-full h-full rounded-md px-2 pt-2 pb-1.5 flex flex-col items-start justify-center gap-1 overflow-hidden shadow-sm"
      style={{
        backgroundColor: statutColors["Validé"]?.bg,
        color: statutColors["Validé"]?.text,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
      }}
    >
      <div className="w-full min-w-0">
        <div className={emphasize ? "font-bold text-[12.75px] leading-[1.15] truncate" : "font-bold text-[12px] leading-[1.15] truncate"} title={client}>
          {compactClient(client)}
        </div>
      </div>
      <div className={emphasize ? "text-[12.5px] font-semibold opacity-95" : "text-[12px] font-semibold opacity-95"}>
        {h1}{(h1 && h2) ? " " : ""}{h2}
        {!h1 && !h2 ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />n.c.</span> : null}
      </div>
    </div>
  )

  const VignetteColor = ({ color }: { color: string }) => (
    <div className="w-full h-full rounded-md shadow-sm" style={{ backgroundColor: color, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)" }} />
  )

  const VignetteEmpty = () => (
    <div
      className="w-full h-full rounded-md shadow-[inset_0_0_0_1px_rgba(203,213,225,0.9)]"
      style={{
        backgroundColor: "#ffffff",
        backgroundImage: "repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0, rgba(0,0,0,0.03) 10px, transparent 10px, transparent 20px)",
      }}
      title="Non renseigné"
    />
  )

  const DayCell = ({ candId, dateStr }: { candId: string; dateStr: string }) => {
    const isEtages = selectedSecteur === "Étages"
    const plansAll = (planIdx.get(`${candId}|${dateStr}`) || [])
    const planMatin = plansAll.find(p => p.heure_debut_matin && p.heure_fin_matin)
    const planSoir  = plansAll.find(p => p.heure_debut_soir  && p.heure_fin_soir)
    const d = dispoIdx.get(`${candId}|${dateStr}`)

    const colorDispo = disponibiliteColors["Dispo"]?.bg || "#d1d5db"
    const colorNonDispo = disponibiliteColors["Non Dispo"]?.bg || "#6b7280"

    // Étages : vignette pleine hauteur
    if (isEtages) {
      if (planMatin || planSoir) {
        const h1 = planMatin ? `${fmt(planMatin.heure_debut_matin)} ${fmt(planMatin.heure_fin_matin)}` : ""
        const h2 = planSoir  ? `${fmt(planSoir.heure_debut_soir)} ${fmt(planSoir.heure_fin_soir)}`   : ""
        const client = (planMatin?.client?.nom || planSoir?.client?.nom || "Client ?")
        return (
          <div className="w-full h-full p-1">
            <div className="w-full h-full">
              <VignettePlanifiee client={client} h1={h1} h2={h2} emphasize />
            </div>
          </div>
        )
      }
      if (d?.statut === "Non Dispo") {
        return <div className="w-full h-full p-1"><div className="w-full h-full"><VignetteColor color={colorNonDispo} /></div></div>
      }
      if (d?.statut === "Dispo") {
        return <div className="w-full h-full p-1"><div className="w-full h-full"><VignetteColor color={colorDispo} /></div></div>
      }
      return <div className="w-full h-full p-1"><div className="w-full h-full"><VignetteEmpty /></div></div>
    }

    // Autres secteurs : 2 demi-hauteurs fixes
    const renderHalfMatin = () => {
      if (planMatin) {
        const h1 = `${fmt(planMatin.heure_debut_matin)} ${fmt(planMatin.heure_fin_matin)}`
        return <VignettePlanifiee client={planMatin.client?.nom || "Client ?"} h1={h1} />
      }
      if (d?.statut === "Non Dispo") return <VignetteColor color={colorNonDispo} />
      if (d?.statut === "Dispo" && d.dispo_matin) return <VignetteColor color={colorDispo} />
      return <VignetteEmpty />
    }

    const renderHalfSoir = () => {
      if (planSoir) {
        const h2 = `${fmt(planSoir.heure_debut_soir)} ${fmt(planSoir.heure_fin_soir)}`
        return <VignettePlanifiee client={planSoir.client?.nom || "Client ?"} h2={h2} />
      }
      if (d?.statut === "Non Dispo") return <VignetteColor color={colorNonDispo} />
      if (d?.statut === "Dispo" && d.dispo_soir) return <VignetteColor color={colorDispo} />
      return <VignetteEmpty />
    }

    return (
      <div className="w-full h-full p-1">
        <div className="grid h-full gap-1.5" style={{ gridTemplateRows: `repeat(2, minmax(42px, 42px))` }}>
          {renderHalfMatin()}
          {renderHalfSoir()}
        </div>
      </div>
    )
  }

  // ————————————————— Rendu —————————————————
  const COL1_W = 200
  const DAY_MIN_W = 132
  const rowMinHeight = selectedSecteur === "Étages" ? 48 : (42 * 2 + 6)
  const secteurInfo = useMemo(() => secteursList.find(s => s.label === selectedSecteur), [selectedSecteur])

  return (
    <div className="w-full">
      {/* Header (dans la modale) */}
      <div className="px-4 pt-2 pb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setBaseDate(addDays(baseDate, -7))} title="Semaine précédente">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="inline-flex items-center gap-2 text-[13.5px] font-semibold">
            <Calendar className="w-4 h-4 text-[#840404]" />
            Semaine {weekNum}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setBaseDate(addDays(baseDate, +7))} title="Semaine suivante">
            <ChevronRight className="w-4 h-4" />
          </Button>

          <div className="ml-4 text-sm text-gray-600">
            {format(days[0], "dd MMM", { locale: fr })} → {format(days[6], "dd MMM", { locale: fr })}
          </div>
        </div>

        <div className="flex-1" />

        {/* Boutons secteurs (exclusifs) */}
        <div className="grid grid-cols-5 gap-2">
          {secteursList.map(({ label, icon: Icon }) => {
            const active = selectedSecteur === label
            return (
              <Button
                key={label}
                variant={active ? "default" : "outline"}
                className={`h-9 px-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                  active ? "bg-[#840404] hover:bg-[#840404]/90 text-white" : "hover:bg-gray-50"
                }`}
                onClick={() => setSelectedSecteur(label)}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Tableau synthèse */}
      <div className="px-4 pb-4">
        <div className="border rounded-lg bg-white overflow-hidden">
          <div
            className="relative max-h-[78vh] overflow-y-auto"
            style={{ backgroundColor: PLANNING_BG }}
          >
            {/* Loader overlay */}
            {loading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center">
                <div className="text-sm text-gray-700">Chargement…</div>
              </div>
            )}

            {/* En-tête sticky */}
            <div className="sticky top-0 z-10 bg-transparent">
              <div
                className="border-t border-b border-r border-gray-300 shadow-sm"
                style={{
                  display: "grid",
                  gridTemplateColumns: `${COL1_W}px repeat(7, minmax(${DAY_MIN_W}px, 1fr))`,
                  background: "linear-gradient(180deg, rgba(243,244,246,0.96), rgba(229,231,235,0.96))"
                }}
              >
                {/* Col titre + secteur */}
                <div className="px-3 py-3 border-r border-gray-300 flex flex-col items-center justify-center">
                  <div className="text-[15px] font-bold text-gray-900 tracking-wide">Candidats</div>
                  {secteurInfo && (
                    <div className="mt-1 inline-flex items-center gap-1.5 text-gray-800">
                      <secteurInfo.icon className="w-4 h-4" />
                      <span className="text-[13px] font-semibold">{selectedSecteur}</span>
                    </div>
                  )}
                </div>

                {/* 7 jours */}
                {days.map((d, i) => (
                  <div key={i} className="px-2 py-3 text-center border-r last:border-r-0 border-gray-300">
                    <div className="capitalize text-[15px] font-semibold text-gray-900">
                      {format(d, "EEEE d", { locale: fr })}
                    </div>
                    <div className="capitalize text-[13.5px] text-gray-700">
                      {format(d, "LLLL", { locale: fr })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lignes */}
            <div className="p-2 space-y-2">
              {(!loading && candidats.length === 0) ? (
                <div className="p-4 text-sm italic text-gray-700 bg-gray-100 border rounded-md">
                  Aucun candidat pour cette semaine / ce secteur.
                </div>
              ) : (
                candidats.map((c) => (
                  <div
                    key={c.id}
                    className="grid bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition"
                    style={{ gridTemplateColumns: `${COL1_W}px repeat(7, minmax(${DAY_MIN_W}px, 1fr))` }}
                  >
                    {/* Col candidat */}
                    <div className="px-3 py-2 border-r border-gray-200" style={{ minHeight: rowMinHeight }}>
                      <div className="h-full w-full flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-[14px] font-semibold leading-tight text-gray-900 truncate">{c.nom}</div>
                            {c.vehicule ? (
                              <span
                                className="inline-flex items-center justify-center ml-1.5 p-1 rounded-full bg-gray-100 text-gray-700 border"
                                title="Véhiculé"
                                aria-label="Véhiculé"
                              >
                                <Car className="w-3.5 h-3.5" />
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[12.5px] text-gray-700 leading-tight truncate">{c.prenom}</div>
                        </div>
                      </div>
                    </div>

                    {/* 7 jours */}
                    {days.map((d, idx) => {
                      const dateStr = format(d, "yyyy-MM-dd")
                      return (
                        <div
                          key={idx}
                          className="border-r last:border-r-0 border-gray-200"
                          style={{
                            minHeight: rowMinHeight,
                            background: "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.9))"
                          }}
                        >
                          <DayCell candId={c.id} dateStr={dateStr} />
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
