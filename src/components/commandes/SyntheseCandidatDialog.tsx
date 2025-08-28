import { useEffect, useMemo, useState } from "react"
import { addDays, format, startOfWeek, subDays, getISOWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { secteursList } from "@/lib/secteurs"
import { statutColors, disponibiliteColors } from "@/lib/colors"
import { Calendar, ChevronLeft, ChevronRight, Car, Clock } from "lucide-react"

type Props = { children: React.ReactNode }

// 🔧 Couleur de fond de la zone scroll (planning)
const PLANNING_BG = "#e5e7eb"

const fmt = (h?: string | null) => (h && h.length >= 5 ? h.slice(0, 5) : "")

const getWeekDays = (base: Date) => {
  const monday = startOfWeek(base, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

type Candidat = {
  id: string
  nom: string
  prenom: string
  vehicule?: boolean | null
}

type Planif = {
  candidat_id: string
  date: string
  statut: string | null
  heure_debut_matin: string | null
  heure_fin_matin: string | null
  heure_debut_soir: string | null
  heure_fin_soir: string | null
  client: { nom: string } | null
}

type Dispo = {
  candidat_id: string
  date: string
  statut: "Dispo" | "Non Dispo" | "Non Renseigné"
  dispo_matin: boolean
  dispo_soir: boolean
}

/**
 * Synthèse – Planning Candidat (dialog)
 * - Filtrage STRICT par secteur (récent 15j / long si "Tous les actifs")
 * - Étages : 1 vignette pleine hauteur
 * - Autres secteurs : 2 vignettes fixes (matin/soir)
 * - Header modernisé + fond planning personnalisable (PLANNING_BG)
 * - Colonne candidats : nom + icône voiture en badge espacé
 * - Labels Matin/Soir retirés (demande)
 */
export function SyntheseCandidatDialog({ children }: Props) {
  const [open, setOpen] = useState(false)

  // Semaine affichée
  const [baseDate, setBaseDate] = useState<Date>(() => new Date())
  const days = useMemo(() => getWeekDays(baseDate), [baseDate])
  const weekNum = useMemo(() => getISOWeek(baseDate), [baseDate])

  // Filtres
  const [selectedSecteur, setSelectedSecteur] = useState<string>(() => secteursList[0]?.label || "")
  const [search, setSearch] = useState("")
  const [showAllActifs, setShowAllActifs] = useState(false)

  // Données
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [weekPlanifs, setWeekPlanifs] = useState<Planif[]>([])
  const [weekDispos, setWeekDispos] = useState<Dispo[]>([])
  const [loadingBase, setLoadingBase] = useState(false)
  const [loadingWeek, setLoadingWeek] = useState(false)

  // map secteurs par candidat (récent & long)
  const [sectorsByCandRecent, setSectorsByCandRecent] = useState<Record<string, Set<string>>>({})
  const [sectorsByCandLong, setSectorsByCandLong] = useState<Record<string, Set<string>>>({})

  // ——— Tailles fixes
  const COL1_W = 200                 // colonne "Candidats"
  const DAY_MIN_W = 132              // min des colonnes jour
  const HALF_H = 42                  // hauteur d’un créneau (autres secteurs) — légèrement plus haut pour l’air en haut
  const FULL_H_ETAGES = 48           // hauteur unique pour Étages
  const CELL_GAP = 6                 // gap entre 2 créneaux
  const ROW_H_OTHERS = HALF_H * 2 + CELL_GAP
  const rowMinHeight = selectedSecteur === "Étages" ? FULL_H_ETAGES : ROW_H_OTHERS

  // 1) Précharge : candidats actifs & mapping secteurs
  useEffect(() => {
    let ignore = false
    const run = async () => {
      setLoadingBase(true)
      const sinceRecent = subDays(new Date(), 14)
      const sinceLong = subDays(new Date(), 365)

      const { data: cmdRecent } = await supabase
        .from("commandes")
        .select("candidat_id, secteur")
        .not("candidat_id", "is", null)
        .gte("date", format(sinceRecent, "yyyy-MM-dd"))

      const { data: dispoRecent } = await supabase
        .from("disponibilites")
        .select("candidat_id, statut")
        .gte("date", format(sinceRecent, "yyyy-MM-dd"))

      const ids = new Set<string>()
      const mapRecent = new Map<string, Set<string>>()

      ;(cmdRecent || []).forEach((r: any) => {
        if (r.candidat_id) {
          ids.add(r.candidat_id)
          if (r.secteur) {
            const set = mapRecent.get(r.candidat_id) || new Set<string>()
            set.add(r.secteur)
            mapRecent.set(r.candidat_id, set)
          }
        }
      })
      ;(dispoRecent || []).forEach((r: any) => {
        if (r.candidat_id && r.statut && r.statut !== "Non Renseigné") ids.add(r.candidat_id)
      })

      const idArr = Array.from(ids)

      // Tous les actifs (pour le toggle)
      const { data: candAllActifs } = await supabase
        .from("candidats")
        .select("id, nom, prenom, vehicule, actif")
      const actifs = (candAllActifs || []).filter((c: any) => c.actif) as any[]

      // Mapping long (1 an) pour filtrage secteur avec "Tous les actifs"
      const { data: cmdLong } = await supabase
        .from("commandes")
        .select("candidat_id, secteur")
        .not("candidat_id", "is", null)
        .gte("date", format(sinceLong, "yyyy-MM-dd"))

      const mapLong = new Map<string, Set<string>>()
      ;(cmdLong || []).forEach((r: any) => {
        if (!r.candidat_id || !r.secteur) return
        const set = mapLong.get(r.candidat_id) || new Set<string>()
        set.add(r.secteur)
        mapLong.set(r.candidat_id, set)
      })

      const keepIds = new Set<string>([...actifs.map(c => c.id), ...idArr])

      const { data: candRows } = await supabase
        .from("candidats")
        .select("id, nom, prenom, vehicule")
        .in("id", Array.from(keepIds))

      if (!ignore) {
        setCandidats((candRows as Candidat[]) || [])

        const objRecent: Record<string, Set<string>> = {}
        mapRecent.forEach((set, key) => { objRecent[key] = set })
        setSectorsByCandRecent(objRecent)

        const objLong: Record<string, Set<string>> = {}
        mapLong.forEach((set, key) => { objLong[key] = set })
        setSectorsByCandLong(objLong)

        setLoadingBase(false)
      }
    }
    run()
  }, [])

  // 2) Charger missions + dispos pour la semaine affichée (sur les candidats filtrés)
  useEffect(() => {
    let ignore = false
    const run = async () => {
      setLoadingWeek(true)
      const monday = startOfWeek(baseDate, { weekStartsOn: 1 })
      const weekDates = Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), "yyyy-MM-dd"))

      const ids = filteredCandidats.map(c => c.id)
      if (ids.length === 0) {
        if (!ignore) { setWeekPlanifs([]); setWeekDispos([]); setLoadingWeek(false) }
        return
      }

      const [{ data: plan }, { data: disp }] = await Promise.all([
        supabase
          .from("commandes")
          .select("candidat_id, date, statut, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir, client:client_id (nom)")
          .in("candidat_id", ids)
          .in("date", weekDates),
        supabase
          .from("disponibilites")
          .select("candidat_id, date, statut, dispo_matin, dispo_soir")
          .in("candidat_id", ids)
          .in("date", weekDates),
      ])

      if (!ignore) {
        setWeekPlanifs((plan as Planif[]) || [])
        setWeekDispos((disp as Dispo[]) || [])
        setLoadingWeek(false)
      }
    }
    run()
  }, [baseDate, selectedSecteur, search, showAllActifs, candidats, sectorsByCandRecent, sectorsByCandLong])

  // Index
  const planIdx = useMemo(() => {
    const m = new Map<string, Planif[]>()
    for (const p of weekPlanifs) {
      const key = `${p.candidat_id}|${p.date}`
      const arr = m.get(key)
      if (arr) { arr.push(p) } else { m.set(key, [p]) }
    }
    return m
  }, [weekPlanifs])

  const dispoIdx = useMemo(() => {
    const m = new Map<string, Dispo>()
    for (const d of weekDispos) m.set(`${d.candidat_id}|${d.date}`, d)
    return m
  }, [weekDispos])

  // ——— Utils : compactage nom client — max 3 mots + ellipsis
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

  // Filtrage candidats : STRICT par secteur + recherche
  const filteredCandidats = useMemo(() => {
    const sectorsMap = showAllActifs ? sectorsByCandLong : sectorsByCandRecent
    const q = search.trim().toLowerCase()
    return candidats
      .filter(c => {
        const sectors = sectorsMap[c.id]
        if (!sectors || !sectors.has(selectedSecteur)) return false
        if (!q) return true
        return (c.nom || "").toLowerCase().includes(q) || (c.prenom || "").toLowerCase().includes(q)
      })
      .sort((a, b) => (a.nom || "").localeCompare(b.nom || ""))
  }, [candidats, sectorsByCandRecent, sectorsByCandLong, selectedSecteur, search, showAllActifs])

  // ——— Vignettes
  const VignettePlanifiee = ({
    client,
    h1,
    h2,
    emphasize = false,
  }: {
    client: string
    h1?: string
    h2?: string
    emphasize?: boolean
  }) => (
    <div
      className="w-full h-full rounded-md px-2 pt-2 pb-1.5 flex flex-col items-start justify-center gap-1 overflow-hidden shadow-sm"
      style={{
        backgroundColor: statutColors["Validé"]?.bg,
        color: statutColors["Validé"]?.text,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
      }}
    >
      <div className="w-full min-w-0">
        <div
          className={emphasize ? "font-bold text-[12.75px] leading-[1.15] truncate" : "font-bold text-[12px] leading-[1.15] truncate"}
          title={client}
        >
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
    <div
      className="w-full h-full rounded-md shadow-sm"
      style={{
        backgroundColor: color,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
      }}
    />
  )

  const VignetteEmpty = () => (
    <div
      className="w-full h-full rounded-md shadow-[inset_0_0_0_1px_rgba(203,213,225,0.9)]"
      style={{
        backgroundColor: "#ffffff",
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0, rgba(0,0,0,0.03) 10px, transparent 10px, transparent 20px)",
      }}
      title="Non renseigné"
    />
  )

  // Cellule : Étages => 1 vignette ; autres => 2 demi-hauteurs
  const DayCell = ({ c, dateStr }: { c: Candidat; dateStr: string }) => {
    const isEtages = selectedSecteur === "Étages"

    const plansAll = (planIdx.get(`${c.id}|${dateStr}`) || []).filter(p => (p.statut || "").toLowerCase() === "validé")
    const planMatin = plansAll.find(p => p.heure_debut_matin && p.heure_fin_matin)
    const planSoir  = plansAll.find(p => p.heure_debut_soir  && p.heure_fin_soir)
    const d = dispoIdx.get(`${c.id}|${dateStr}`)

    const colorDispo = disponibiliteColors["Dispo"]?.bg || "#d1d5db"
    const colorNonDispo = disponibiliteColors["Non Dispo"]?.bg || "#6b7280"

    // Étages : 1 vignette pleine case
    if (isEtages) {
      if (planMatin || planSoir) {
        const p = planMatin || planSoir
        const h1 = p?.heure_debut_matin && p?.heure_fin_matin ? `${fmt(p.heure_debut_matin)} ${fmt(p.heure_fin_matin)}` : ""
        const h2 = p?.heure_debut_soir && p?.heure_fin_soir ? `${fmt(p.heure_debut_soir)} ${fmt(p.heure_fin_soir)}` : ""
        return (
          <div className="w-full h-full p-1">
            <div className="w-full h-full">
              <VignettePlanifiee client={p?.client?.nom || "Client ?"} h1={h1} h2={h2} emphasize />
            </div>
          </div>
        )
      }
      if (d?.statut === "Non Dispo") {
        return (
          <div className="w-full h-full p-1">
            <div className="w-full h-full">
              <VignetteColor color={colorNonDispo} />
            </div>
          </div>
        )
      }
      if (d?.statut === "Dispo") {
        return (
          <div className="w-full h-full p-1">
            <div className="w-full h-full">
              <VignetteColor color={colorDispo} />
            </div>
          </div>
        )
      }
      return (
        <div className="w-full h-full p-1">
          <div className="w-full h-full">
            <VignetteEmpty />
          </div>
        </div>
      )
    }

    // Autres secteurs : 2 vignettes fixes
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
        <div
          className="grid h-full gap-1.5"
          style={{ gridTemplateRows: `repeat(2, minmax(${HALF_H}px, ${HALF_H}px))` }}
        >
          {renderHalfMatin()}
          {renderHalfSoir()}
        </div>
      </div>
    )
  }

  const isLoading = loadingBase || loadingWeek
  const secteurInfo = useMemo(() => secteursList.find(s => s.label === selectedSecteur), [selectedSecteur])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="max-w-[1600px] w-[98vw] px-0 pb-0 pt-2 overflow-x-hidden">
        <DialogHeader className="px-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold">
            <Calendar className="w-4 h-4" />
            {`Planning Candidat – Semaine ${weekNum}`}
          </DialogTitle>
        </DialogHeader>

        {/* Boutons secteurs (exclusifs) */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-5 gap-2">
            {secteursList.map(({ label, icon: Icon }) => {
              const active = selectedSecteur === label
              return (
                <Button
                  key={label}
                  variant={active ? "default" : "outline"}
                  className={`w-full h-10 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
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

        {/* Nav semaine + recherche + toggle "Tous les actifs" */}
        <div className="px-4 pb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setBaseDate(addDays(baseDate, -7))} title="Semaine précédente">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="inline-flex items-center gap-2 text-[13.5px] font-semibold">
              <Calendar className="w-4 h-4 text-[#840404]" />
              {format(days[0], "dd MMM", { locale: fr })} → {format(days[6], "dd MMM", { locale: fr })}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setBaseDate(addDays(baseDate, +7))} title="Semaine suivante">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <input
            className="h-9 w-[280px] rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-[#840404]/30"
            placeholder="Rechercher candidat…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <label className="ml-2 inline-flex items-center gap-2 text-sm select-none">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#840404] cursor-pointer"
              checked={showAllActifs}
              onChange={e => setShowAllActifs(e.target.checked)}
            />
            <span>Afficher tous les actifs</span>
          </label>
        </div>

        {/* Tableau avec header sticky + scroll vertical */}
        <div className="px-4 pb-4">
          <div className="border rounded-lg bg-white overflow-hidden">
            {/* Fond planning personnalisable */}
            <div
              className="relative max-h-[75vh] overflow-y-auto"
              style={{ backgroundColor: PLANNING_BG }}
            >
              {/* Overlay loading */}
              {isLoading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center">
                  <div className="text-sm text-gray-700">Chargement…</div>
                </div>
              )}

              {/* Entête modernisé avec bordure droite visible */}
              <div className="sticky top-0 z-10 bg-transparent">
                <div
                  className="border-t border-b border-r border-gray-300 shadow-sm"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `${COL1_W}px repeat(7, minmax(${DAY_MIN_W}px, 1fr))`,
                    background: "linear-gradient(180deg, rgba(243,244,246,0.96), rgba(229,231,235,0.96))"
                  }}
                >
                  {/* Colonne titre + secteur */}
                  <div className="px-3 py-3 border-r border-gray-300 flex flex-col items-center justify-center">
                    <div className="text-[15px] font-bold text-gray-900 tracking-wide">Candidats</div>
                    {secteurInfo && (
                      <div className="mt-1 inline-flex items-center gap-1.5 text-gray-800">
                        <secteurInfo.icon className="w-4 h-4" />
                        <span className="text-[13px] font-semibold">{selectedSecteur}</span>
                      </div>
                    )}
                  </div>

                  {/* Jours */}
                  {days.map((d, i) => (
                    <div
                      key={i}
                      className="px-2 py-3 text-center border-r last:border-r-0 border-gray-300"
                    >
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

              {/* Lignes — cartes nettes */}
              <div className="p-2 space-y-2">
                {(!isLoading && filteredCandidats.length === 0) ? (
                  <div className="p-4 text-sm italic text-gray-700 bg-gray-100 border rounded-md">
                    Aucun candidat pour ce secteur / recherche.
                  </div>
                ) : (
                  filteredCandidats.map((c) => (
                    <div
                      key={c.id}
                      className="grid bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition"
                      style={{ gridTemplateColumns: `${COL1_W}px repeat(7, minmax(${DAY_MIN_W}px, 1fr))` }}
                    >
                      {/* Colonne candidat : nom + voiture (badge espacé) */}
                      <div
                        className="px-3 py-2 border-r border-gray-200"
                        style={{ minHeight: rowMinHeight }}
                      >
                        <div className="h-full w-full flex items-center justify-between gap-2">
                          {/* Bloc nom + prénom + voiture */}
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
                            <DayCell c={c} dateStr={dateStr} />
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
      </DialogContent>
    </Dialog>
  )
}
