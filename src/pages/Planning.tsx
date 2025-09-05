import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import MainLayout from "@/components/main-layout"
import { SectionFixeCandidates } from "@/components/Planning/section-fixe-candidates"
import { PlanningCandidateTable } from "@/components/Planning/PlanningCandidateTable"
import { supabase } from "@/lib/supabase"
import { addDays, format, getWeek, parseISO, startOfWeek } from "date-fns"
import type {
  JourPlanningCandidat,
  CommandeFull,
  StatutCommande,
  CandidatDispoWithNom,
} from "@/types/types-front"
import { useLiveRows } from "@/hooks/useLiveRows"

/** -----------------------------------------
 *  Helpers de persistance (localStorage)
 *  ----------------------------------------- */
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

/** -----------------------------------------
 *  Types (lignes DB)
 *  ----------------------------------------- */
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
  // joints (fetch initial uniquement)
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
  // joint (fetch initial uniquement)
  candidats?: { nom: string; prenom: string } | null
}

/** planification + joints pour fallback (client/candidat) */
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
  // joints
  commande?: {
    id: string
    client_id: string | null
    secteur?: string | null
    service?: string | null
    client?: { nom: string } | null
  } | null
  candidat?: { nom: string; prenom: string } | null
}

/** -----------------------------------------
 *  Page
 *  ----------------------------------------- */
export default function Planning() {
  const [planning, setPlanning] = useState<Record<string, JourPlanningCandidat[]>>({})
  const [filteredPlanning, setFilteredPlanning] = useState<Record<string, JourPlanningCandidat[]>>({})

  // --------- États avec initialisation depuis localStorage ---------
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
  // ---------------------------------------------------------------

  const [semainesDisponibles, setSemainesDisponibles] = useState<string[]>([])

  const [stats, setStats] = useState({
    "Non renseigné": 0,
    "Dispo": 0,
    "Non Dispo": 0,
    "Planifié": 0,
  })

  // cache id -> "Nom Prénom" pour grouper de façon stable côté Realtime
  const [candidateNames, setCandidateNames] = useState<Record<string, string>>({})

  // ————————————————— Helpers —————————————————

  const getLabelForCandidate = useCallback(
    (candidat_id?: string | null) =>
      (candidat_id && candidateNames[candidat_id]) || "Candidat inconnu",
    [candidateNames]
  )

  const buildCommandeFull = useCallback((c: Partial<CommandeRow>): CommandeFull => {
    return {
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
    }
  }, [])

  const buildDispoFull = useCallback((d: Partial<DispoRow>): CandidatDispoWithNom => {
    return {
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
    }
  }, [])

  /** Fallback : transforme une ligne de planification en "CommandeRow" compatible */
  const buildCommandeRowFromPlanif = useCallback((p: PlanifRow): CommandeRow => {
    return {
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
    }
  }, [])

  // utilitaire timestamp
  const ts = useCallback((x?: { updated_at?: string | null; created_at?: string | null } | null) => {
    return (x?.updated_at ? Date.parse(x.updated_at) : 0) || (x?.created_at ? Date.parse(x.created_at!) : 0) || 0
  }, [])

  // Supprime une commande (par id) partout, et nettoie les jours vides
  const removeCommandeEverywhere = useCallback((base: Record<string, JourPlanningCandidat[]>, id: string) => {
    const next: Record<string, JourPlanningCandidat[]> = {}
    for (const [label, jours] of Object.entries(base)) {
      const nj: JourPlanningCandidat[] = []
      for (const j of jours) {
        let changed = false
        let clone: JourPlanningCandidat = j
        if (j.commande?.id === id) {
          clone = { ...clone, commande: undefined }
          changed = true
        }
        if (j.autresCommandes?.length) {
          const filtered = j.autresCommandes.filter((c) => c.id !== id)
          if (filtered.length !== j.autresCommandes.length) {
            clone = { ...clone, autresCommandes: filtered }
            changed = true
          }
        }
        const keep =
          clone.commande ||
          (clone.autresCommandes && clone.autresCommandes.length > 0) ||
          clone.disponibilite
        if (keep) nj.push(changed ? clone : j)
      }
      if (nj.length > 0) next[label] = nj
    }
    return next
  }, [])

  // Insère/replace une commande pour le bon candidat & jour
  const upsertCommande = useCallback(
    (base: Record<string, JourPlanningCandidat[]>, row: Partial<CommandeRow>) => {
      if (!row?.id || !row.date) return base
      const candId = row.candidat_id ?? null
      if (!candId) {
        return removeCommandeEverywhere(base, String(row.id))
      }

      const label = getLabelForCandidate(candId)
      const commande = buildCommandeFull(row)
      const dateStr = String(row.date)

      const next = removeCommandeEverywhere(base, String(row.id))
      const line = next[label] ?? []
      const idx = line.findIndex((j) => j.date === dateStr)

      if (idx >= 0) {
        const current = line[idx]
        const anciensAutres = current.autresCommandes ?? []
        let autres = anciensAutres.filter((c) => c.id !== row.id)
        let principale = commande

        if (current.commande && current.commande.id !== row.id) {
          autres = [...autres, current.commande]
        }

        line[idx] = {
          ...current,
          secteur: row.secteur ?? current.secteur,
          service: (row.service ?? current.service) ?? null,
          commande: principale,
          autresCommandes: autres,
        }
      } else {
        line.push({
          date: dateStr,
          secteur: String(row.secteur ?? "Inconnu"),
          service: (row.service ?? null) as string | null,
          commande,
          autresCommandes: [],
        })
      }

      next[label] = line
      return next
    },
    [buildCommandeFull, getLabelForCandidate, removeCommandeEverywhere]
  )

  // Upsert disponibilité
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
        line[idx] = {
          ...current,
          secteur: String(row.secteur ?? current.secteur ?? "Inconnu"),
          service: (row.service ?? current.service) ?? null,
          disponibilite: dispo,
        }
      } else {
        line.push({
          date: dateStr,
          secteur: String(row.secteur ?? "Inconnu"),
          service: (row.service ?? null) as string | null,
          disponibilite: dispo,
          commande: undefined,
          autresCommandes: [],
        })
      }

      next[label] = line
      return next
    },
    [buildDispoFull, getLabelForCandidate]
  )

  // Remove disponibilité
  const removeDispo = useCallback(
    (base: Record<string, JourPlanningCandidat[]>, row: Partial<DispoRow>) => {
      if (!row?.id) return base
      const next: Record<string, JourPlanningCandidat[]> = {}
      for (const [label, jours] of Object.entries(base)) {
        const nj: JourPlanningCandidat[] = []
        for (const j of jours) {
          if (j.disponibilite?.id === String(row.id)) {
            const clone: JourPlanningCandidat = { ...j, disponibilite: undefined }
            const keep =
              clone.commande ||
              (clone.autresCommandes && clone.autresCommandes.length > 0) ||
              clone.disponibilite
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

  // ————————————————— Filtres (inclut “+2 semaines précédentes”) —————————————————
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
    const currentWeekStr = getWeek(new Date(), { weekStartsOn: 1 }).toString()

    const matchSearchTerm = (val: string) =>
      searchText
        .trim()
        .toLowerCase()
        .split(" ")
        .every((term) => val.toLowerCase().includes(term))

    // Prépare les infos “semaine sélectionnée” + 2 semaines précédentes
    const isToutes = semaineSelect === "Toutes"
    const selectedWeekNum = isToutes ? null : parseInt(semaineSelect || "0", 10)
    const prevWeeks = new Set<string>()
    if (!isToutes && selectedWeekNum && !Number.isNaN(selectedWeekNum)) {
      // wrap simple 52 semaines (suffisant ici)
      const w1 = selectedWeekNum - 1 > 0 ? selectedWeekNum - 1 : 52
      const w2 = w1 - 1 > 0 ? w1 - 1 : 52
      prevWeeks.add(String(w1))
      prevWeeks.add(String(w2))
    }

    // Cherche une date “exemple” appartenant à la semaine sélectionnée pour fabriquer 7 jours vides
    let mondayOfSelectedWeek: Date | null = null
    if (!isToutes && selectedWeekNum) {
      outer: for (const jours of Object.values(rawPlanning)) {
        for (const j of jours) {
          const w = getWeek(parseISO(j.date), { weekStartsOn: 1 })
          if (w === selectedWeekNum) {
            mondayOfSelectedWeek = startOfWeek(parseISO(j.date), { weekStartsOn: 1 })
            break outer
          }
        }
      }
      // fallback défensif
      if (!mondayOfSelectedWeek) {
        mondayOfSelectedWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
      }
    }

    const weekMatch = (dateISO: string) => {
      const semaineDuJour = getWeek(parseISO(dateISO), { weekStartsOn: 1 }).toString()
      return isToutes
        ? parseInt(semaineDuJour) >= parseInt(currentWeekStr)
        : semaineDuJour === String(selectedWeekNum)
    }

    const weekInPrev2 = (dateISO: string) => {
      if (isToutes) return false
      const w = getWeek(parseISO(dateISO), { weekStartsOn: 1 }).toString()
      return prevWeeks.has(w)
    }

    // Construit la ligne filtrée
    Object.entries(rawPlanning).forEach(([candidatNom, jours]) => {
      // 1) test recherche (sur le candidat + secteur/service + noms clients des commandes)
      const aggregateForSearch = [
        candidatNom,
        ...jours.map(j => j.secteur || ""),
        ...jours.map(j => j.service || ""),
        ...jours.map(j => j.commande?.client?.nom || ""),
        ...jours.flatMap(j => (j.autresCommandes || []).map(c => c.client?.nom || "")),
      ].join(" ")

      const matchesSearch =
        searchText.trim() === "" ? true : matchSearchTerm(aggregateForSearch)

      if (!matchesSearch) return
      if (candidatSelect && candidatNom !== candidatSelect) return

      // 2) jours appartenant à la semaine sélectionnée (mais on applique aussi le filtre secteur)
      const joursSemaine = jours.filter((j) =>
        secteurs.includes(j.secteur) && weekMatch(j.date)
      )

      // 3) si le filtre "Dispo" est activé, on ne conserve la ligne que si au moins un jour de la semaine a "Dispo"
      if (dispoFilter) {
        const hasDispo = joursSemaine.some((j) => j.disponibilite?.statut === "Dispo")
        if (!hasDispo) return
      }

      if (joursSemaine.length > 0) {
        // ✅ cas normal : on garde cette ligne avec les jours de la semaine filtrés
        newFiltered[candidatNom] = joursSemaine
      } else if (!isToutes && !dispoFilter) {
        // 4) sinon (aucun jour sur la semaine choisie), on regarde si le candidat
        //    a AU MOINS un statut sur l’une des 2 semaines précédentes (et secteur OK)
        const hadRecent = jours.some((j) => secteurs.includes(j.secteur) && weekInPrev2(j.date))
        if (hadRecent && mondayOfSelectedWeek) {
          // On affiche une ligne "complète" de 7 jours vides pour la semaine sélectionnée
          // Secteur “récent” pour éviter de filtrer la ligne (prend le plus récent des 2 semaines précédentes)
          const recentJours = jours
            .filter((j) => weekInPrev2(j.date) && secteurs.includes(j.secteur))
            .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
          const recentSecteur = recentJours[0]?.secteur || "Inconnu"
          const recentService = recentJours[0]?.service ?? null

          const sevenDays: JourPlanningCandidat[] = Array.from({ length: 7 }).map((_, idx) => {
            const d = addDays(mondayOfSelectedWeek!, idx)
            const dISO = format(d, "yyyy-MM-dd")
            return {
              date: dISO,
              secteur: recentSecteur,
              service: recentService,
              commande: undefined,
              autresCommandes: [],
              disponibilite: undefined,
            }
          })
          newFiltered[candidatNom] = sevenDays
        }
      }
    })

    setFilteredPlanning(newFiltered)

    // Stats basées sur la vue filtrée
    let nr = 0, d = 0, nd = 0, p = 0
    Object.values(newFiltered).forEach((jours) =>
      jours.forEach((j) => {
        const statut = j.commande?.statut
        if (statut === "Validé") p++
        else {
          const s = j.disponibilite?.statut || "Non renseigné"
          if (s === "Dispo") d++
          else if (s === "Non Dispo") nd++
          else nr++
        }
      })
    )
    setStats({
      "Non renseigné": nr,
      "Dispo": d,
      "Non Dispo": nd,
      "Planifié": p,
    })
  }, [])

  // ——————————————— compose un JourPlanningCandidat (logique unique) ———————————————
  const composeJour = useCallback((
    dateISO: string,
    dispoRow: DispoRow | null,
    commandesRows: CommandeRow[]
  ): { secteur: string; service: string | null; commande?: CommandeFull; autresCommandes: CommandeFull[]; disponibilite?: CandidatDispoWithNom } => {
    const dispoFull = dispoRow ? buildDispoFull(dispoRow) : undefined

    // robustesse casse/espaces
    const valides = commandesRows.filter((c) => (c.statut || "").trim().toLowerCase() === "validé")
    const annexes = commandesRows.filter((c) =>
      ["Annule Int", "Absence", "Annule Client", "Annule ADA"].includes((c.statut || "").trim())
    )

    let principale: CommandeFull | undefined
    let secondaires: CommandeFull[] = []
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
        if (missionSoir) {
          const soirFull = buildCommandeFull(missionSoir)
          if (principale.client?.nom && soirFull.client?.nom && principale.client.nom !== soirFull.client.nom) {
            secondaires.push(soirFull)
          }
        }
      } else if (missionSoir) {
        const full = buildCommandeFull(missionSoir)
        principale = full
        secteur = full.secteur
        service = (full.service ?? service) ?? null
      } else {
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
      } else {
        principale = undefined
      }
    }

    return {
      secteur,
      service,
      commande: principale,
      autresCommandes: secondaires,
      disponibilite: dispoFull,
    }
  }, [buildCommandeFull, buildDispoFull, ts])

  // ————————————————— Fetch initial (avec fallback planification) —————————————————
  const didInitRef = useRef(false)

  const fetchPlanning = useCallback(async () => {
    try {
      const [
        { data: commandesData, error: commandesError },
        { data: dispoData, error: dispoError },
        { data: planifData, error: planifError },
      ] = await Promise.all([
        supabase
          .from("commandes")
          .select(`
            id, date, statut, secteur, service, client_id, candidat_id,
            heure_debut_matin, heure_fin_matin,
            heure_debut_soir, heure_fin_soir,
            heure_debut_nuit, heure_fin_nuit,
            commentaire, created_at, updated_at, mission_slot,
            client:client_id ( nom ),
            candidat:candidat_id ( nom, prenom )
          `),
        supabase
          .from("disponibilites")
          .select(`
            id, date, secteur, service, statut, commentaire, candidat_id,
            dispo_matin, dispo_soir, dispo_nuit, created_at, updated_at,
            candidats:candidat_id ( nom, prenom )
          `),
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
          `),
      ])

      if (commandesError || dispoError || planifError) {
        console.error("Erreurs:", commandesError || dispoError || planifError)
        return
      }

      const nameCache: Record<string, string> = {}

      ;(dispoData ?? []).forEach((d) => {
        if (d.candidat_id && d.candidats?.nom) {
          nameCache[d.candidat_id] = `${d.candidats.nom} ${d.candidats.prenom ?? ""}`.trim()
        }
      })
      ;(commandesData ?? []).forEach((c) => {
        if (c.candidat_id && c.candidat?.nom) {
          nameCache[c.candidat_id] = `${c.candidat.nom} ${c.candidat.prenom ?? ""}`.trim()
        }
      })
      ;(planifData ?? []).forEach((p: PlanifRow) => {
        if (p.candidat_id && p.candidat?.nom) {
          nameCache[p.candidat_id] = `${p.candidat.nom} ${p.candidat.prenom ?? ""}`.trim()
        }
      })
      setCandidateNames(nameCache)

      // index planification par candidat|date
      const planifIdx = new Map<string, PlanifRow[]>()
      ;(planifData ?? []).forEach((p: PlanifRow) => {
        const key = `${p.candidat_id}|${p.date}`
        const arr = planifIdx.get(key)
        if (arr) arr.push(p)
        else planifIdx.set(key, [p])
      })

      const map: Record<string, JourPlanningCandidat[]> = {}
      const semaines = new Set<string>()

      // Regrouper par candidat + date (inclure planification)
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
          let cs: CommandeRow[] = commandesCandidat.filter((c) => c.date === dt)
          if (cs.length === 0) {
            const ps = planifIdx.get(`${candId}|${dt}`) || []
            if (ps.length > 0) {
              cs = ps.map(buildCommandeRowFromPlanif)
            }
          }

          const dispoJour = dispoCandidat.find((d) => d.date === dt) ?? null
          const composed = composeJour(dt, dispoJour as any, cs as any)

          const w = getWeek(parseISO(dt), { weekStartsOn: 1 }).toString()
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

      // ❌ Ne pas forcer selectedSemaine ici – laisse l'utilisateur décider.
      // (on synchronise "semaine en cours" dans un useEffect dédié)
      if (!didInitRef.current) {
        didInitRef.current = true
      }
    } catch (e) {
      console.error(e)
    }
  }, [composeJour, buildCommandeRowFromPlanif])

  // ———————————————— Refresh ciblé (1 candidat / 1 jour) ————————————————
  const refreshOne = useCallback(async (candidatId: string, dateISO: string) => {
    try {
      const jour = dateISO.slice(0, 10)

      const [
        { data: dispoData, error: dErr },
        { data: cmdData, error: cErr },
        { data: planData, error: pErr },
        { data: candRow },
      ] = await Promise.all([
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
            heure_debut_soir, heure_fin_soir,
            heure_debut_nuit, heure_fin_nuit,
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
        supabase
          .from("candidats")
          .select("nom, prenom")
          .eq("id", candidatId)
          .maybeSingle(),
      ])

      if (dErr || cErr || pErr) {
        console.error("RefreshOne errors:", dErr || cErr || pErr)
        return
      }

      const label =
        candidateNames[candidatId] ||
        (candRow ? `${candRow.nom ?? ""} ${candRow.prenom ?? ""}`.trim() : "Candidat inconnu")

      let cmdRows: CommandeRow[] = (cmdData ?? []) as any
      if (!cmdRows || cmdRows.length === 0) {
        cmdRows = (planData ?? []).map(buildCommandeRowFromPlanif)
      }

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

        if (idx >= 0) {
          line[idx] = newJour
        } else {
          line.push(newJour)
        }
        next[label] = line
        return next
      })
    } catch (e) {
      console.error("refreshOne exception:", e)
    }
  }, [candidateNames, composeJour, buildCommandeRowFromPlanif])

  // ————————————————— Effets —————————————————
  useEffect(() => {
    fetchPlanning()
  }, [fetchPlanning])

  // ✅ Synchronisation "Semaine en cours" -> selectedSemaine (sans override quand l'utilisateur change la liste)
  useEffect(() => {
    if (semaineEnCours) {
      const currentWeek = getWeek(new Date(), { weekStartsOn: 1 }).toString()
      setSelectedSemaine(currentWeek)
    }
  }, [semaineEnCours])

  useEffect(() => {
    applyFilters(planning, selectedSecteurs, selectedSemaine, candidat, dispo, search, toutAfficher)
  }, [planning, selectedSecteurs, selectedSemaine, candidat, search, dispo, toutAfficher, applyFilters])

  // ————————————————— Persistance LS (sauvegarde) —————————————————
  useEffect(() => { lsSet("planning.selectedSecteurs", selectedSecteurs) }, [selectedSecteurs])
  useEffect(() => { lsSet("planning.semaineEnCours", semaineEnCours) }, [semaineEnCours])
  useEffect(() => { lsSet("planning.semaine", semaine) }, [semaine])
  useEffect(() => { lsSet("planning.selectedSemaine", selectedSemaine) }, [selectedSemaine])
  useEffect(() => { lsSet("planning.candidat", candidat) }, [candidat])
  useEffect(() => { lsSet("planning.search", search) }, [search])
  useEffect(() => { lsSet("planning.toutAfficher", toutAfficher) }, [toutAfficher])
  useEffect(() => { lsSet("planning.dispo", dispo) }, [dispo])
  // ------------------------------------------------------------------------------------------------

  const resetFiltres = () => {
    setSelectedSecteurs(["Étages"])
    setCandidat("")
    setSearch("")
    setDispo(false)
    setToutAfficher(false)
    setSemaineEnCours(true)
    setSemaine(format(new Date(), "yyyy-MM-dd"))
    const current = getWeek(new Date(), { weekStartsOn: 1 }).toString()
    setSelectedSemaine(current)
  }

  // ————————————————— Realtime (PATCH DIRECT) —————————————————
  useLiveRows<CommandeRow>({
    table: "commandes",
    onInsert: (row) => {
      setPlanning((prev) => upsertCommande(prev, row))
    },
    onUpdate: (row) => {
      setPlanning((prev) => upsertCommande(prev, row))
    },
    onDelete: (row) => {
      if (!row?.id) return
      setPlanning((prev) => removeCommandeEverywhere(prev, String(row.id)))
    },
  })

  useLiveRows<DispoRow>({
    table: "disponibilites",
    onInsert: (row) => {
      setPlanning((prev) => upsertDispo(prev, row))
    },
    onUpdate: (row) => {
      setPlanning((prev) => upsertDispo(prev, row))
    },
    onDelete: (row) => {
      setPlanning((prev) => removeDispo(prev, row))
    },
  })

  // ———————————————— Écoute les événements locaux pour actualiser 1 journée ————————————————
  useEffect(() => {
    const onDispoUpdated = (e: Event) => {
      const ce = e as CustomEvent<{ candidatId?: string; date?: string }>
      const { candidatId, date } = ce.detail || {}
      if (candidatId && date) {
        refreshOne(candidatId, date)
      } else {
        fetchPlanning()
      }
    }
    const onPlanifUpdated = (e: Event) => {
      const ce = e as CustomEvent<{ candidatId?: string; date?: string }>
      const { candidatId, date } = ce.detail || {}
      if (candidatId && date) {
        refreshOne(candidatId, date)
      } else {
        fetchPlanning()
      }
    }
    const onAdaptelRefresh = (e: Event) => {
      const ce = e as CustomEvent<{ candidatId?: string; date?: string }>
      const { candidatId, date } = ce.detail || {}
      if (candidatId && date) {
        refreshOne(candidatId, date)
      } else {
        fetchPlanning()
      }
    }

    window.addEventListener("dispos:updated", onDispoUpdated as EventListener)
    window.addEventListener("planif:updated", onPlanifUpdated as EventListener)
    window.addEventListener("adaptel:refresh-planning-candidat", onAdaptelRefresh as EventListener)

    return () => {
      window.removeEventListener("dispos:updated", onDispoUpdated as EventListener)
      window.removeEventListener("planif:updated", onPlanifUpdated as EventListener)
      window.removeEventListener("adaptel:refresh-planning-candidat", onAdaptelRefresh as EventListener)
    }
  }, [refreshOne, fetchPlanning])

  // ————————————————— Rendu —————————————————
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
        setRefreshTrigger={() => {}} // plus de refresh global (tout passe par Realtime + refreshOne)
      />

      <PlanningCandidateTable
        planning={filteredPlanning}
        selectedSecteurs={selectedSecteurs}
        selectedSemaine={selectedSemaine}
        onRefresh={() => {}} // tout passe par Realtime + refreshOne()
      />
    </MainLayout>
  )
}
