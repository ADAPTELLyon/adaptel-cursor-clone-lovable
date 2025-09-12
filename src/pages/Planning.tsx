import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import MainLayout from "@/components/main-layout"
import { SectionFixeCandidates } from "@/components/Planning/section-fixe-candidates"
import { PlanningCandidateTable } from "@/components/Planning/PlanningCandidateTable"
import { supabase } from "@/lib/supabase"
import { addDays, endOfWeek, format, getISOWeek, parseISO, startOfWeek, addWeeks, subDays } from "date-fns"
import type {
  JourPlanningCandidat,
  CommandeFull,
  StatutCommande,
  CandidatDispoWithNom,
} from "@/types/types-front"
import { useLiveRows } from "@/hooks/useLiveRows"

/* -----------------------------------------
 *  LocalStorage helpers
 * ----------------------------------------- */
const lsGet = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
const lsSet = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

/* -----------------------------------------
 *  DB rows
 * ----------------------------------------- */
type CommandeRow = {
  id: string
  date: string
  statut: StatutCommande | string
  secteur: string
  service?: string | null
  mission_slot?: number | null
  client_id: string
  candidat_id?: string | null
  heure_debut_matin?: string | null
  heure_fin_matin?: string | null
  heure_debut_soir?: string | null
  heure_fin_soir?: string | null
  heure_debut_nuit?: string | null
  heure_fin_nuit?: string | null
  commentaire?: string | null
  created_at: string
  updated_at?: string | null
  client?: { nom: string } | null
  candidat?: { nom: string; prenom: string } | null
}

type DispoRow = {
  id: string
  date: string
  secteur: string
  service?: string | null
  statut: "Dispo" | "Non Dispo" | "Non Renseigné"
  candidat_id: string
  commentaire?: string | null
  dispo_matin?: boolean | null
  dispo_soir?: boolean | null
  dispo_nuit?: boolean | null
  created_at: string
  updated_at?: string | null
  candidats?: { nom: string; prenom: string } | null
}

type PlanifRow = {
  id: string
  commande_id: string
  candidat_id: string
  date: string
  secteur: string
  statut: StatutCommande | string | null
  heure_debut_matin: string | null
  heure_fin_matin: string | null
  heure_debut_soir: string | null
  heure_fin_soir: string | null
  heure_debut_nuit: string | null
  heure_fin_nuit: string | null
  created_at: string
  updated_at: string | null
  commande?: {
    id: string
    client_id: string | null
    secteur?: string | null
    service?: string | null
    client?: { nom: string } | null
  } | null
  candidat?: { nom: string; prenom: string } | null
}

/* -----------------------------------------
 *  Utils
 * ----------------------------------------- */
const normalize = (s?: string | null) =>
  (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()

const isAnnexe = (s?: string | null) => {
  const t = (s || "").trim()
  return t === "Annule Int" || t === "Annule Client" || t === "Annule ADA" || t === "Absence"
}

const buildCommandeFull = (c: Partial<CommandeRow>): CommandeFull => ({
  id: String(c.id),
  date: String(c.date),
  statut: (c.statut as StatutCommande) || "En recherche",
  secteur: String(c.secteur),
  service: (c.service ?? null) as string | null,
  client_id: String(c.client_id ?? ""),
  candidat_id: (c.candidat_id ?? null) as string | null,
  heure_debut_matin: c.heure_debut_matin ?? null,
  heure_fin_matin: c.heure_fin_matin ?? null,
  heure_debut_soir: c.heure_debut_soir ?? null,
  heure_fin_soir: c.heure_fin_soir ?? null,
  heure_debut_nuit: c.heure_debut_nuit ?? null,
  heure_fin_nuit: c.heure_fin_nuit ?? null,
  commentaire: c.commentaire ?? null,
  created_at: String(c.created_at),
  updated_at: (c.updated_at ?? undefined) as string | undefined,
  mission_slot: (c.mission_slot ?? 0) as number,
  candidat: c.candidat ? { nom: c.candidat.nom, prenom: c.candidat.prenom } : null,
  client: c.client ? { nom: c.client.nom } : undefined,
  motif_contrat: null,
})

const buildDispoFull = (d: Partial<DispoRow>): CandidatDispoWithNom => ({
  id: String(d.id),
  date: String(d.date),
  secteur: String(d.secteur),
  statut: (d.statut as "Dispo" | "Non Dispo" | "Non Renseigné") ?? "Non Renseigné",
  service: (d.service ?? null) as string | null,
  commentaire: d.commentaire ?? null,
  candidat_id: String(d.candidat_id),
  matin: (d.dispo_matin ?? null) as boolean | null,
  soir: (d.dispo_soir ?? null) as boolean | null,
  nuit: (d.dispo_nuit ?? null) as boolean | null,
  created_at: String(d.created_at),
  updated_at: d.updated_at ?? null,
  candidat: d.candidats ? { nom: d.candidats.nom, prenom: d.candidats.prenom } : undefined,
})

const buildCommandeRowFromPlanif = (p: PlanifRow): CommandeRow => ({
  id: String(p.commande?.id || p.commande_id || p.id),
  date: String(p.date),
  statut: (p.statut as StatutCommande) || "Validé",
  secteur: String(p.commande?.secteur || p.secteur || "Inconnu"),
  service: (p.commande?.service ?? null) as string | null,
  mission_slot: null,
  client_id: String(p.commande?.client_id ?? ""),
  candidat_id: String(p.candidat_id),
  heure_debut_matin: p.heure_debut_matin,
  heure_fin_matin: p.heure_fin_matin,
  heure_debut_soir: p.heure_debut_soir,
  heure_fin_soir: p.heure_fin_soir,
  heure_debut_nuit: p.heure_debut_nuit,
  heure_fin_nuit: p.heure_fin_nuit,
  commentaire: null,
  created_at: String(p.created_at),
  updated_at: p.updated_at ?? null,
  client: p.commande?.client ? { nom: p.commande.client.nom } : null,
  candidat: p.candidat ? { nom: p.candidat.nom, prenom: p.candidat.prenom } : null,
})

const ts = (x?: { updated_at?: string | null; created_at?: string | null } | null) =>
  (x?.updated_at ? Date.parse(x.updated_at) : 0) || (x?.created_at ? Date.parse(x.created_at!) : 0) || 0

/* -----------------------------------------
 *  Page
 * ----------------------------------------- */
export default function Planning() {
  const [planning, setPlanning] = useState<Record<string, JourPlanningCandidat[]>>({})
  const [filteredPlanning, setFilteredPlanning] = useState<Record<string, JourPlanningCandidat[]>>({})

  // UI state (persisted)
  const [selectedSecteurs, setSelectedSecteurs] = useState<string[]>(
    () => lsGet<string[]>("planning.selectedSecteurs", ["Étages"])
  )
  const [semaineEnCours, setSemaineEnCours] = useState<boolean>(
    () => lsGet<boolean>("planning.semaineEnCours", true)
  )
  const [semaine, setSemaine] = useState<string>(
    () => lsGet<string>("planning.semaine", format(new Date(), "yyyy-MM-dd"))
  )
  const [selectedSemaine, setSelectedSemaine] = useState<string>(
    () => lsGet<string>("planning.selectedSemaine", "Toutes")
  )
  const [candidat, setCandidat] = useState<string>(() => lsGet<string>("planning.candidat", ""))
  const [search, setSearch] = useState<string>(() => lsGet<string>("planning.search", ""))
  const [toutAfficher, setToutAfficher] = useState<boolean>(
    () => lsGet<boolean>("planning.toutAfficher", false)
  )
  const [dispo, setDispo] = useState<boolean>(() => lsGet<boolean>("planning.dispo", false))

  const [semainesDisponibles, setSemainesDisponibles] = useState<string[]>([])
  const [stats, setStats] = useState({ "Non renseigné": 0, "Dispo": 0, "Non Dispo": 0, "Planifié": 0 })
  const [candidateNames, setCandidateNames] = useState<Record<string, string>>({})

  /* -------- Date range builder (semaine choisie + buffer 15j si besoin) -------- */
  const computeDateRange = useCallback((): { from: string; to: string; includePrev: boolean } => {
    const today = new Date()
    const mondayBase = startOfWeek(today, { weekStartsOn: 1 })
    const currentWeek = getISOWeek(today)
    const allWeeks = selectedSemaine === "Toutes"

    if (allWeeks) {
      const from = format(mondayBase, "yyyy-MM-dd")
      // horizon raisonnable pour éviter l'egress massif ; ajustable si besoin
      const to = format(endOfWeek(addWeeks(mondayBase, 12), { weekStartsOn: 1 }), "yyyy-MM-dd")
      return { from, to, includePrev: false }
    }

    // semaine précise (numéro)
    const targetWeek = parseInt(selectedSemaine || String(currentWeek), 10)
    const diff = targetWeek - currentWeek
    const mondayTarget = addWeeks(mondayBase, diff)
    const sundayTarget = endOfWeek(mondayTarget, { weekStartsOn: 1 })

    // buffer -15 jours pour la détection “candidat récent sans statut sur la semaine”
    const from = format(subDays(mondayTarget, 14), "yyyy-MM-dd")
    const to = format(sundayTarget, "yyyy-MM-dd")
    return { from, to, includePrev: true }
  }, [selectedSemaine])

  /* --------- compose un jour (priorité : Validé > Annexe >= Dispo) --------- */
  const composeJour = useCallback((
    dateISO: string,
    dispoRow: DispoRow | null,
    commandesRows: CommandeRow[]
  ): { secteur: string; service: string | null; commande?: CommandeFull; autresCommandes: CommandeFull[]; disponibilite?: CandidatDispoWithNom } => {
    const dispoFull = dispoRow ? buildDispoFull(dispoRow) : undefined

    // Séparation
    const valides = commandesRows.filter((c) => normalize(c.statut) === "valide")
    const annexes = commandesRows.filter((c) => isAnnexe(c.statut))

    let principale: CommandeFull | undefined
    const secondaires: CommandeFull[] = []
    let secteur = dispoRow?.secteur || "Inconnu"
    let service = (dispoRow?.service ?? null) as string | null

    if (valides.length > 0) {
      const missionMatin = valides.find((c) => !!c.heure_debut_matin && !!c.heure_fin_matin)
      const missionSoir  = valides.find((c) => !!c.heure_debut_soir  && !!c.heure_fin_soir)

      if (missionMatin) {
        const full = buildCommandeFull(missionMatin)
        principale = full
        secteur = full.secteur
        service = (full.service ?? service) ?? null
      }
      if (missionSoir) {
        const soirFull = buildCommandeFull(missionSoir)
        if (!principale) {
          principale = soirFull
          secteur = soirFull.secteur
          service = (soirFull.service ?? service) ?? null
        } else {
          // on garde le créneau complémentaire même si même client
          secondaires.push(soirFull)
        }
      }
      if (!principale) {
        const lastValide = [...valides].sort((a, b) => ts(b) - ts(a))[0]
        const full = buildCommandeFull(lastValide)
        principale = full
        secteur = full.secteur
        service = (full.service ?? service) ?? null
      }
    } else {
      const lastAnnexe = annexes.length > 0 ? [...annexes].sort((a, b) => ts(b) - ts(a))[0] : null
      if (lastAnnexe && (!dispoFull || ts(lastAnnexe) >= ts(dispoFull))) {
        const full = buildCommandeFull(lastAnnexe)
        principale = full
        secteur = full.secteur
        service = (full.service ?? service) ?? null
      }
    }

    return { secteur, service, commande: principale, autresCommandes: secondaires, disponibilite: dispoFull }
  }, [])

  /* --------- helpers pour MAJ locale --------- */
  const removeCommandeEverywhere = useCallback((base: Record<string, JourPlanningCandidat[]>, id: string) => {
    const next: Record<string, JourPlanningCandidat[]> = {}
    for (const [label, jours] of Object.entries(base)) {
      const nj: JourPlanningCandidat[] = []
      for (const j of jours) {
        let clone: JourPlanningCandidat = j
        let changed = false
        if (j.commande?.id === id) { clone = { ...clone, commande: undefined }; changed = true }
        if (j.autresCommandes?.length) {
          const filtered = j.autresCommandes.filter((c) => c.id !== id)
          if (filtered.length !== (j.autresCommandes?.length || 0)) { clone = { ...clone, autresCommandes: filtered }; changed = true }
        }
        const keep = clone.commande || (clone.autresCommandes && clone.autresCommandes.length > 0) || clone.disponibilite
        if (keep) nj.push(changed ? clone : j)
      }
      if (nj.length > 0) next[label] = nj
    }
    return next
  }, [])

  const getLabelForCandidate = useCallback(
    (candidat_id?: string | null) => (candidat_id && candidateNames[candidat_id]) || "Candidat inconnu",
    [candidateNames]
  )

  const upsertCommande = useCallback(
    (base: Record<string, JourPlanningCandidat[]>, row: Partial<CommandeRow>) => {
      if (!row?.id || !row.date) return base
      const candId = row.candidat_id ?? null
      if (!candId) return removeCommandeEverywhere(base, String(row.id))

      const label = getLabelForCandidate(candId)
      const commande = buildCommandeFull(row)
      const dateStr = String(row.date)

      const next = removeCommandeEverywhere(base, String(row.id))
      const line = next[label] ?? []
      const idx = line.findIndex((j) => j.date === dateStr)

      if (idx >= 0) {
        const current = line[idx]
        const autres = (current.autresCommandes ?? []).filter((c) => c.id !== row.id)
        const maybeKeepOld = current.commande && current.commande.id !== row.id ? [current.commande] : []
        line[idx] = { ...current, secteur: row.secteur ?? current.secteur, service: (row.service ?? current.service) ?? null, commande, autresCommandes: [...autres, ...maybeKeepOld] }
      } else {
        line.push({ date: dateStr, secteur: String(row.secteur ?? "Inconnu"), service: (row.service ?? null) as string | null, commande, autresCommandes: [] })
      }
      next[label] = line
      return next
    },
    [getLabelForCandidate, removeCommandeEverywhere]
  )

  const upsertDispo = useCallback(
    (base: Record<string, JourPlanningCandidat[]>, row: Partial<DispoRow>) => {
      if (!row?.id || !row.date || !row.candidat_id) return base
      const label = getLabelForCandidate(row.candidat_id)
      const dispo = buildDispoFull(row)
      const dateStr = String(row.date)

      const next = { ...base }
      const line = next[label] ?? []
      const idx = line.findIndex((j) => j.date === dateStr)
      if (idx >= 0) {
        const current = line[idx]
        line[idx] = { ...current, secteur: String(row.secteur ?? current.secteur ?? "Inconnu"), service: (row.service ?? current.service) ?? null, disponibilite: dispo }
      } else {
        line.push({ date: dateStr, secteur: String(row.secteur ?? "Inconnu"), service: (row.service ?? null) as string | null, disponibilite: dispo, commande: undefined, autresCommandes: [] })
      }
      next[label] = line
      return next
    },
    [getLabelForCandidate]
  )

  const removeDispo = useCallback(
    (base: Record<string, JourPlanningCandidat[]>, row: Partial<DispoRow>) => {
      if (!row?.id) return base
      const next: Record<string, JourPlanningCandidat[]> = {}
      for (const [label, jours] of Object.entries(base)) {
        const nj: JourPlanningCandidat[] = []
        for (const j of jours) {
          if (j.disponibilite?.id === String(row.id)) {
            const clone: JourPlanningCandidat = { ...j, disponibilite: undefined }
            const keep = clone.commande || (clone.autresCommandes && clone.autresCommandes.length > 0) || clone.disponibilite
            if (keep) nj.push(clone)
          } else {
            nj.push(j)
          }
        }
        if (nj.length > 0) next[label] = nj
      }
      return next
    },
    []
  )

  /* --------- Filtrage (conserve ta logique existante) --------- */
  const applyFilters = useCallback((
    rawPlanning: Record<string, JourPlanningCandidat[]>,
    secteurs: string[],
    semaineSelect: string,
    candidatSelect: string,
    dispoFilter: boolean,
    searchText: string,
    _toutAfficherBool: boolean
  ) => {
    const newFiltered: typeof rawPlanning = {}
    const currentWeekStr = getISOWeek(new Date()).toString()

    const matchSearchTerm = (val: string) =>
      searchText.trim().toLowerCase().split(" ").every((term) => val.toLowerCase().includes(term))

    const isToutes = semaineSelect === "Toutes"
    const selectedWeekNum = isToutes ? null : parseInt(semaineSelect || "0", 10)
    const prevWeeks = new Set<string>()
    if (!isToutes && selectedWeekNum && !Number.isNaN(selectedWeekNum)) {
      const w1 = selectedWeekNum - 1 > 0 ? selectedWeekNum - 1 : 52
      const w2 = w1 - 1 > 0 ? w1 - 1 : 52
      prevWeeks.add(String(w1)); prevWeeks.add(String(w2))
    }

    let mondayOfSelectedWeek: Date | null = null
    if (!isToutes && selectedWeekNum) {
      outer: for (const jours of Object.values(rawPlanning)) {
        for (const j of jours) {
          const w = getISOWeek(parseISO(j.date))
          if (w === selectedWeekNum) {
            mondayOfSelectedWeek = startOfWeek(parseISO(j.date), { weekStartsOn: 1 })
            break outer
          }
        }
      }
      if (!mondayOfSelectedWeek) mondayOfSelectedWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
    }

    const weekMatch = (dateISO: string) => {
      const w = getISOWeek(parseISO(dateISO)).toString()
      return isToutes ? parseInt(w) >= parseInt(currentWeekStr) : w === String(selectedWeekNum)
    }
    const weekInPrev2 = (dateISO: string) => {
      if (isToutes) return false
      const w = getISOWeek(parseISO(dateISO)).toString()
      return prevWeeks.has(w)
    }

    Object.entries(rawPlanning).forEach(([candidatNom, jours]) => {
      const aggregate = [
        candidatNom,
        ...jours.map(j => j.secteur || ""),
        ...jours.map(j => j.service || ""),
        ...jours.map(j => j.commande?.client?.nom || ""),
        ...jours.flatMap(j => (j.autresCommandes || []).map(c => c.client?.nom || "")),
      ].join(" ")
      if (searchText.trim() && !matchSearchTerm(aggregate)) return
      if (candidatSelect && candidatNom !== candidatSelect) return

      const joursSemaine = jours.filter((j) => secteurs.includes(j.secteur) && weekMatch(j.date))
      if (dispoFilter) {
        const hasDispo = joursSemaine.some((j) => j.disponibilite?.statut === "Dispo")
        if (!hasDispo) return
      }

      if (joursSemaine.length > 0) {
        newFiltered[candidatNom] = joursSemaine
      } else if (!isToutes && !dispoFilter) {
        const hadRecent = jours.some((j) => secteurs.includes(j.secteur) && weekInPrev2(j.date))
        if (hadRecent && mondayOfSelectedWeek) {
          const recentJours = jours
            .filter((j) => weekInPrev2(j.date) && secteurs.includes(j.secteur))
            .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
          const recentSecteur = recentJours[0]?.secteur || "Inconnu"
          const recentService = recentJours[0]?.service ?? null

          const sevenDays: JourPlanningCandidat[] = Array.from({ length: 7 }).map((_, idx) => {
            const d = addDays(mondayOfSelectedWeek!, idx)
            const dISO = format(d, "yyyy-MM-dd")
            return { date: dISO, secteur: recentSecteur, service: recentService, commande: undefined, autresCommandes: [], disponibilite: undefined }
          })
          newFiltered[candidatNom] = sevenDays
        }
      }
    })

    setFilteredPlanning(newFiltered)

    // stats
    let nr = 0, d = 0, nd = 0, p = 0
    Object.values(newFiltered).forEach((jours) =>
      jours.forEach((j) => {
        const s = j.commande?.statut
        if (s === "Validé") p++
        else {
          const sd = j.disponibilite?.statut || "Non renseigné"
          if (sd === "Dispo") d++
          else if (sd === "Non Dispo") nd++
          else nr++
        }
      })
    )
    setStats({ "Non renseigné": nr, "Dispo": d, "Non Dispo": nd, "Planifié": p })
  }, [])

  /* --------- Fetch (SEMAINE & SECTEUR ciblés) + MERGE planif/commandes --------- */
  const didInitRef = useRef(false)

  const fetchPlanning = useCallback(async () => {
    try {
      const { from, to } = computeDateRange()
      const filterSecteur = selectedSecteurs.length && selectedSecteurs.length < 5 ? selectedSecteurs : null

      const [cmdQ, dispQ, planQ] = [
        supabase
          .from("commandes")
          .select(`
            id, date, statut, secteur, service, client_id, candidat_id,
            heure_debut_matin, heure_fin_matin,
            heure_debut_soir,  heure_fin_soir,
            heure_debut_nuit,  heure_fin_nuit,
            commentaire, created_at, updated_at, mission_slot,
            client:client_id ( nom ),
            candidat:candidat_id ( nom, prenom )
          `)
          .gte("date", from)
          .lte("date", to),
        supabase
          .from("disponibilites")
          .select(`
            id, date, secteur, service, statut, commentaire, candidat_id,
            dispo_matin, dispo_soir, dispo_nuit, created_at, updated_at,
            candidats:candidat_id ( nom, prenom )
          `)
          .gte("date", from)
          .lte("date", to),
        supabase
          .from("planification")
          .select(`
            id, commande_id, candidat_id, date, secteur, statut,
            heure_debut_matin, heure_fin_matin,
            heure_debut_soir,  heure_fin_soir,
            heure_debut_nuit,  heure_fin_nuit,
            created_at, updated_at,
            commande:commande_id (
              id, client_id, secteur, service,
              client:client_id ( nom )
            ),
            candidat:candidat_id ( nom, prenom )
          `)
          .gte("date", from)
          .lte("date", to),
      ]

      if (filterSecteur) {
        ;(cmdQ as any).in("secteur", filterSecteur)
        ;(dispQ as any).in("secteur", filterSecteur)
        ;(planQ as any).in("secteur", filterSecteur)
      }

      const [{ data: commandesData, error: commandesError }, { data: dispoData, error: dispoError }, { data: planifData, error: planifError }] =
        await Promise.all([cmdQ, dispQ, planQ])

      if (commandesError || dispoError || planifError) {
        console.error("Erreurs fetch:", commandesError || dispoError || planifError)
        return
      }

      const nameCache: Record<string, string> = {}
      ;(dispoData ?? []).forEach((d) => { if (d.candidat_id && d.candidats?.nom) nameCache[d.candidat_id] = `${d.candidats.nom} ${d.candidats.prenom ?? ""}`.trim() })
      ;(commandesData ?? []).forEach((c) => { if (c.candidat_id && c.candidat?.nom) nameCache[c.candidat_id] = `${c.candidat.nom} ${c.candidat.prenom ?? ""}`.trim() })
      ;(planifData ?? []).forEach((p: PlanifRow) => { if (p.candidat_id && p.candidat?.nom) nameCache[p.candidat_id] = `${p.candidat.nom} ${p.candidat.prenom ?? ""}`.trim() })
      setCandidateNames(nameCache)

      // index planification par candidat|date
      const planifIdx = new Map<string, PlanifRow[]>()
      ;(planifData ?? []).forEach((p: PlanifRow) => {
        const key = `${p.candidat_id}|${p.date}`
        const arr = planifIdx.get(key)
        if (arr) arr.push(p); else planifIdx.set(key, [p])
      })

      const map: Record<string, JourPlanningCandidat[]> = {}
      const semaines = new Set<string>()

      const candidatsSet = new Set<string>([
        ...((commandesData ?? []).map((c) => c.candidat_id).filter(Boolean) as string[]),
        ...((dispoData ?? []).map((d) => d.candidat_id) as string[]),
        ...((planifData ?? []).map((p: PlanifRow) => p.candidat_id) as string[]),
      ])

      for (const candId of candidatsSet) {
        const label = nameCache[candId] ?? "Candidat inconnu"
        const jours: Record<string, JourPlanningCandidat> = {}

        const commandesCandidat = (commandesData ?? []).filter((c) => c.candidat_id === candId)
        const dispoCandidat = (dispoData ?? []).filter((d) => d.candidat_id === candId)
        const planifsCandidat = (planifData ?? []).filter((p: PlanifRow) => p.candidat_id === candId)

        const dates = Array.from(new Set([
          ...commandesCandidat.map((c) => c.date),
          ...dispoCandidat.map((d) => d.date),
          ...planifsCandidat.map((p) => p.date),
        ]))

        for (const dt of dates) {
          // MERGE commandes + planifs du jour (toujours), dédoublonné par id
          const fromCmd = commandesCandidat.filter((c) => c.date === dt)
          const fromPlanif = (planifIdx.get(`${candId}|${dt}`) || []).map(buildCommandeRowFromPlanif)
          const byId = new Map<string, CommandeRow>()
          for (const r of [...fromCmd, ...fromPlanif]) { if (r?.id) byId.set(String(r.id), r as CommandeRow) }
          const cs: CommandeRow[] = Array.from(byId.values())

          const dispoJour = dispoCandidat.find((d) => d.date === dt) ?? null
          const composed = composeJour(dt, dispoJour as any, cs as any)

          const w = getISOWeek(parseISO(dt)).toString()
          semaines.add(w)

          jours[dt] = {
            date: dt,
            secteur: composed.secteur,
            service: composed.service,
            commande: composed.commande,
            autresCommandes: composed.autresCommandes,
            disponibilite: composed.disponibilite,
          }
        }

        const arr = Object.values(jours)
        if (arr.length > 0) map[label] = arr
      }

      setPlanning(map)

      const semainesTriees = Array.from(semaines).sort((a, b) => parseInt(b) - parseInt(a))
      setSemainesDisponibles(semainesTriees)
      if (!didInitRef.current) didInitRef.current = true
    } catch (e) {
      console.error(e)
    }
  }, [computeDateRange, selectedSecteurs])

  /* --------- Refresh ciblé (1 candidat / 1 jour), MERGE inclus --------- */
  const refreshOne = useCallback(async (candidatId: string, dateISO: string) => {
    try {
      const jour = dateISO.slice(0, 10)
      const [{ data: dispoData }, { data: cmdData }, { data: planData }, { data: candRow }] = await Promise.all([
        supabase
          .from("disponibilites")
          .select(`
            id, date, secteur, service, statut, commentaire, candidat_id,
            dispo_matin, dispo_soir, dispo_nuit, created_at, updated_at,
            candidats:candidat_id ( nom, prenom )
          `)
          .eq("candidat_id", candidatId)
          .eq("date", jour)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("commandes")
          .select(`
            id, date, statut, secteur, service, client_id, candidat_id,
            heure_debut_matin, heure_fin_matin,
            heure_debut_soir,  heure_fin_soir,
            heure_debut_nuit,  heure_fin_nuit,
            commentaire, created_at, updated_at, mission_slot,
            client:client_id ( nom ),
            candidat:candidat_id ( nom, prenom )
          `)
          .eq("candidat_id", candidatId)
          .eq("date", jour),
        supabase
          .from("planification")
          .select(`
            id, commande_id, candidat_id, date, secteur, statut,
            heure_debut_matin, heure_fin_matin,
            heure_debut_soir,  heure_fin_soir,
            heure_debut_nuit,  heure_fin_nuit,
            created_at, updated_at,
            commande:commande_id (
              id, client_id, secteur, service,
              client:client_id ( nom )
            ),
            candidat:candidat_id ( nom, prenom )
          `)
          .eq("candidat_id", candidatId)
          .eq("date", jour),
        supabase.from("candidats").select("nom, prenom").eq("id", candidatId).maybeSingle(),
      ])

      const label = candidateNames[candidatId] || (candRow ? `${candRow.nom ?? ""} ${candRow.prenom ?? ""}`.trim() : "Candidat inconnu")

      const byId = new Map<string, CommandeRow>()
      for (const r of [
        ...(((cmdData ?? []) as unknown) as CommandeRow[]),
        ...(((planData ?? []).map(buildCommandeRowFromPlanif)) as unknown as CommandeRow[]),
      ]) { if (r?.id) byId.set(String(r.id), r) }
      const cmdRows: CommandeRow[] = Array.from(byId.values())

      const composed = composeJour(jour, (dispoData as any) ?? null, cmdRows as any)

      setCandidateNames((prev) => ({ ...prev, [candidatId]: label }))
      setPlanning((prev) => {
        const next = { ...prev }
        const line = next[label] ? [...next[label]] : []
        const idx = line.findIndex((j) => j.date === jour)
        const newJour: JourPlanningCandidat = {
          date: jour,
          secteur: composed.secteur,
          service: composed.service,
          commande: composed.commande,
          autresCommandes: composed.autresCommandes,
          disponibilite: composed.disponibilite,
        }
        if (idx >= 0) line[idx] = newJour
        else line.push(newJour)
        next[label] = line
        return next
      })
    } catch (e) {
      console.error("refreshOne exception:", e)
    }
  }, [candidateNames])

  /* --------- Effects --------- */
  useEffect(() => { if (semaineEnCours) setSelectedSemaine(getISOWeek(new Date()).toString()) }, [semaineEnCours])

  useEffect(() => { fetchPlanning() }, [fetchPlanning, selectedSemaine, selectedSecteurs])

  useEffect(() => {
    applyFilters(planning, selectedSecteurs, selectedSemaine, candidat, dispo, search, toutAfficher)
  }, [planning, selectedSecteurs, selectedSemaine, candidat, search, dispo, toutAfficher, applyFilters])

  // persist
  useEffect(() => { lsSet("planning.selectedSecteurs", selectedSecteurs) }, [selectedSecteurs])
  useEffect(() => { lsSet("planning.semaineEnCours", semaineEnCours) }, [semaineEnCours])
  useEffect(() => { lsSet("planning.semaine", semaine) }, [semaine])
  useEffect(() => { lsSet("planning.selectedSemaine", selectedSemaine) }, [selectedSemaine])
  useEffect(() => { lsSet("planning.candidat", candidat) }, [candidat])
  useEffect(() => { lsSet("planning.search", search) }, [search])
  useEffect(() => { lsSet("planning.toutAfficher", toutAfficher) }, [toutAfficher])
  useEffect(() => { lsSet("planning.dispo", dispo) }, [dispo])

  const resetFiltres = () => {
    setSelectedSecteurs(["Étages"])
    setCandidat("")
    setSearch("")
    setDispo(false)
    setToutAfficher(false)
    setSemaineEnCours(true)
    setSemaine(format(new Date(), "yyyy-MM-dd"))
    setSelectedSemaine(getISOWeek(new Date()).toString())
  }

  /* --------- Realtime (inchangé) --------- */
  useLiveRows<CommandeRow>({
    table: "commandes",
    onInsert: (row) => setPlanning((prev) => upsertCommande(prev, row)),
    onUpdate: (row) => setPlanning((prev) => upsertCommande(prev, row)),
    onDelete: (row) => { if (row?.id) setPlanning((prev) => removeCommandeEverywhere(prev, String(row.id))) },
  })
  useLiveRows<DispoRow>({
    table: "disponibilites",
    onInsert: (row) => setPlanning((prev) => upsertDispo(prev, row)),
    onUpdate: (row) => setPlanning((prev) => upsertDispo(prev, row)),
    onDelete: (row) => setPlanning((prev) => removeDispo(prev, row)),
  })

  useEffect(() => {
    const onEvt = (fn: (c: string, d: string) => void) => (e: Event) => {
      const ce = e as CustomEvent<{ candidatId?: string; date?: string }>
      const { candidatId, date } = ce.detail || {}
      if (candidatId && date) fn(candidatId, date); else fetchPlanning()
    }
    const onDispoUpdated = onEvt((c, d) => refreshOne(c, d))
    const onPlanifUpdated = onEvt((c, d) => refreshOne(c, d))
    const onAdaptelRefresh = onEvt((c, d) => refreshOne(c, d))

    window.addEventListener("dispos:updated", onDispoUpdated as EventListener)
    window.addEventListener("planif:updated", onPlanifUpdated as EventListener)
    window.addEventListener("adaptel:refresh-planning-candidat", onAdaptelRefresh as EventListener)
    return () => {
      window.removeEventListener("dispos:updated", onDispoUpdated as EventListener)
      window.removeEventListener("planif:updated", onPlanifUpdated as EventListener)
      window.removeEventListener("adaptel:refresh-planning-candidat", onAdaptelRefresh as EventListener)
    }
  }, [refreshOne, fetchPlanning])

  const candidatsDisponibles = useMemo(() => Object.keys(planning), [planning])

  return (
    <MainLayout>
      <SectionFixeCandidates
        selectedSecteurs={selectedSecteurs}
        setSelectedSecteurs={setSelectedSecteurs}
        stats={stats}
        semaine={semaine}
        setSemaine={setSemaine}
        selectedSemaine={selectedSemaine}
        setSelectedSemaine={setSelectedSemaine}
        candidat={candidat}
        setCandidat={setCandidat}
        search={search}
        setSearch={setSearch}
        toutAfficher={toutAfficher}
        setToutAfficher={setToutAfficher}
        dispo={dispo}
        setDispo={setDispo}
        semaineEnCours={semaineEnCours}
        setSemaineEnCours={setSemaineEnCours}
        resetFiltres={resetFiltres}
        semainesDisponibles={semainesDisponibles}
        candidatsDisponibles={candidatsDisponibles}
        setRefreshTrigger={() => {}}
      />
      <PlanningCandidateTable
        planning={filteredPlanning}
        selectedSecteurs={selectedSecteurs}
        selectedSemaine={selectedSemaine}
        onRefresh={() => {}}
      />
    </MainLayout>
  )
}
