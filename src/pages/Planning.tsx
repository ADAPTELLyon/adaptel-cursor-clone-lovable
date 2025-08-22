import { useCallback, useEffect, useMemo, useState } from "react"
import MainLayout from "@/components/main-layout"
import { SectionFixeCandidates } from "@/components/Planning/section-fixe-candidates"
import { PlanningCandidateTable } from "@/components/Planning/PlanningCandidateTable"
import { supabase } from "@/lib/supabase"
import { format, getWeek, parseISO } from "date-fns"
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
      client_id: String(c.client_id),
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
      // joints indisponibles via Realtime -> on met à null (ou on peut étendre via caches si besoin)
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
      // mappe les colonnes DB -> champs de ton type front
      matin: !!d.dispo_matin,
      soir: !!d.dispo_soir,
      nuit: !!d.dispo_nuit,
      created_at: String(d.created_at),
      updated_at: d.updated_at ?? null,
      // propriété correcte : 'candidat' (et pas 'candidats')
      candidat: d.candidats ? { nom: d.candidats.nom, prenom: d.candidats.prenom } : undefined,
    }
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
        // non assignée => on l’ignore côté planning candidat
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

  // ————————————————— Filtres —————————————————
  const applyFilters = useCallback((
    rawPlanning: Record<string, JourPlanningCandidat[]>,
    secteurs: string[],
    semaineSelect: string,
    candidatSelect: string,
    dispoFilter: boolean,
    searchText: string,
    toutAfficherBool: boolean
  ) => {
    const newFiltered: typeof rawPlanning = {}
    const currentWeek = getWeek(new Date(), { weekStartsOn: 1 }).toString()

    const matchSearchTerm = (val: string) =>
      searchText
        .trim()
        .toLowerCase()
        .split(" ")
        .every((term) => val.toLowerCase().includes(term))

    Object.entries(rawPlanning).forEach(([candidatNom, jours]) => {
      const joursFiltres = jours.filter((j) => {
        const semaineDuJour = getWeek(parseISO(j.date), { weekStartsOn: 1 }).toString()
        const matchSecteur = secteurs.includes(j.secteur)
        const matchCandidat = candidatSelect ? candidatNom === candidatSelect : true
        const matchDispo = dispoFilter ? j.disponibilite?.statut === "Dispo" : true
        const matchSemaine =
          semaineSelect === "Toutes"
            ? parseInt(semaineDuJour) >= parseInt(currentWeek)
            : semaineSelect === semaineDuJour

        return (
          matchSecteur &&
          matchCandidat &&
          matchDispo &&
          matchSemaine &&
          (searchText.trim() === "" ||
            matchSearchTerm(candidatNom) ||
            matchSearchTerm(j.secteur) ||
            matchSearchTerm(j.service || "") ||
            (j.disponibilite?.statut && matchSearchTerm(j.disponibilite.statut)))
        )
      })

      if (joursFiltres.length > 0) newFiltered[candidatNom] = joursFiltres
    })

    setFilteredPlanning(newFiltered)

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

  // ————————————————— Fetch initial —————————————————
  const fetchPlanning = useCallback(async () => {
    try {
      const [{ data: commandesData, error: commandesError }, { data: dispoData, error: dispoError }] =
        await Promise.all([
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
        ])

      if (commandesError || dispoError) {
        console.error("Erreurs:", commandesError || dispoError)
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
      setCandidateNames(nameCache)

      const map: Record<string, JourPlanningCandidat[]> = {}
      const semaines = new Set<string>()
      const currentWeek = getWeek(new Date(), { weekStartsOn: 1 }).toString()

      // Regrouper par candidat + date
      const candidatsSet = new Set<string>([
        ...((commandesData ?? []).map((c) => c.candidat_id).filter(Boolean) as string[]),
        ...((dispoData ?? []).map((d) => d.candidat_id) as string[]),
      ])

      // utilitaire timestamp
      const ts = (x?: { updated_at?: string | null; created_at?: string | null } | null) =>
        (x?.updated_at ? Date.parse(x.updated_at) : 0) || (x?.created_at ? Date.parse(x.created_at!) : 0) || 0

      for (const candId of candidatsSet) {
        const label = nameCache[candId] ?? "Candidat inconnu"
        const jours: Record<string, JourPlanningCandidat> = {}

        const commandesCandidat = (commandesData ?? []).filter((c) => c.candidat_id === candId)
        const dispoCandidat = (dispoData ?? []).filter((d) => d.candidat_id === candId)

        const dates = Array.from(new Set([
          ...commandesCandidat.map((c) => c.date),
          ...dispoCandidat.map((d) => d.date),
        ]))

        for (const dt of dates) {
          const cs = commandesCandidat.filter((c) => c.date === dt)

          const valides = cs.filter((c) => c.statut === "Validé")
          const annexes = cs.filter((c) =>
            ["Annule Int", "Annule Client", "Annule ADA", "Absence"].includes(c.statut || "")
          )

          // disponibilité brute du jour (si existante)
          const dispoJour = dispoCandidat.find((d) => d.date === dt)
          const dispoFull = dispoJour
            ? buildDispoFull({
                id: dispoJour.id,
                date: dispoJour.date,
                secteur: dispoJour.secteur,
                service: dispoJour.service,
                statut: dispoJour.statut as "Dispo" | "Non Dispo" | "Non Renseigné",
                candidat_id: dispoJour.candidat_id,
                commentaire: dispoJour.commentaire,
                dispo_matin: dispoJour.dispo_matin,
                dispo_soir: dispoJour.dispo_soir,
                dispo_nuit: dispoJour.dispo_nuit,
                created_at: dispoJour.created_at,
                updated_at: dispoJour.updated_at,
                candidats: dispoJour.candidats
                  ? { nom: dispoJour.candidats.nom, prenom: dispoJour.candidats.prenom }
                  : null,
              })
            : undefined

          let principale: CommandeFull | undefined
          let secondaires: CommandeFull[] = []
          let secteur = dispoJour?.secteur || "Inconnu"
          let service = (dispoJour?.service ?? null) as string | null

          if (valides.length > 0) {
            // ——— CAS 1 : on a au moins une planif Validé -> priorité absolue
            // repérer matin & soir
            const missionMatin = valides.find((c) => !!c.heure_debut_matin && !!c.heure_fin_matin)
            const missionSoir  = valides.find((c) => !!c.heure_debut_soir  && !!c.heure_fin_soir)

            if (missionMatin) {
              principale = buildCommandeFull(missionMatin)
              secteur = principale.secteur
              service = (principale.service ?? service) ?? null
              if (missionSoir) {
                const soirFull = buildCommandeFull(missionSoir)
                // alerte uniquement si clients différents
                if (principale.client?.nom && soirFull.client?.nom && principale.client.nom !== soirFull.client.nom) {
                  secondaires.push(soirFull)
                }
              }
            } else if (missionSoir) {
              // seulement le soir en validé
              principale = buildCommandeFull(missionSoir)
              secteur = principale.secteur
              service = (principale.service ?? service) ?? null
            } else {
              // Validé sans heures (cas rarissime) -> on prend le + récent
              const lastValide = [...valides].sort((a, b) => ts(b) - ts(a))[0]
              principale = buildCommandeFull(lastValide)
              secteur = principale.secteur
              service = (principale.service ?? service) ?? null
            }
          } else {
            // ——— CAS 2 : aucune planif Validé —> arbitrage Annexe vs Dispo au timestamp
            const lastAnnexe = annexes.length > 0 ? [...annexes].sort((a, b) => ts(b) - ts(a))[0] : null

            if (lastAnnexe && (!dispoFull || ts(lastAnnexe) >= ts(dispoFull))) {
              // on affiche l’annexe (libellé + client en italique côté cellule)
              principale = buildCommandeFull(lastAnnexe)
              secteur = principale.secteur
              service = (principale.service ?? service) ?? null
            } else {
              // sinon on n’affiche pas de commande, on laisse la dispo (ou rien si aucune info)
              principale = undefined
            }
          }

          const semaine = getWeek(parseISO(dt), { weekStartsOn: 1 }).toString()
          semaines.add(semaine)

          jours[dt] = {
            date: dt,
            secteur,
            service,
            commande: principale,
            autresCommandes: secondaires,
            disponibilite: dispoFull,
          }
        }

        const arr = Object.values(jours)
        if (arr.length > 0) map[label] = arr
      }

      setPlanning(map)

      const semainesTriees = Array.from(semaines).sort((a, b) => parseInt(b) - parseInt(a))
      setSemainesDisponibles(semainesTriees)

      // ⚠️ Conserver la vue de l'utilisateur :
      // - Si "semaineEnCours" (persistée) est true → on force la semaine courante
      // - Sinon : on respecte "selectedSemaine" déjà initialisée depuis localStorage
      if (semaineEnCours) {
        const currentWeek = getWeek(new Date(), { weekStartsOn: 1 }).toString()
        setSelectedSemaine(currentWeek)
      } else if (!semainesTriees.includes(selectedSemaine) && selectedSemaine !== "Toutes") {
        setSelectedSemaine("Toutes")
      }

      // premier calcul filtré
      applyFilters(
        map,
        selectedSecteurs,
        semaineEnCours ? getWeek(new Date(), { weekStartsOn: 1 }).toString() : selectedSemaine,
        candidat,
        dispo,
        search,
        toutAfficher
      )
    } catch (e) {
      console.error(e)
    }
  }, [
    applyFilters,
    buildDispoFull,
    buildCommandeFull,
    selectedSecteurs,
    selectedSemaine,
    candidat,
    dispo,
    search,
    toutAfficher,
    semaineEnCours,
  ])

  // ————————————————— Effets —————————————————
  useEffect(() => {
    fetchPlanning()
  }, [fetchPlanning])

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
        setRefreshTrigger={() => {}} // plus de refresh global
      />

      <PlanningCandidateTable
        planning={filteredPlanning}
        selectedSecteurs={selectedSecteurs}
        selectedSemaine={selectedSemaine}
        onRefresh={() => {}} // plus de refetch, tout passe par Realtime
      />
    </MainLayout>
  )
}
