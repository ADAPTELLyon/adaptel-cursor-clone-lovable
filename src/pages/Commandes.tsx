import { useCallback, useEffect, useMemo, useState, useDeferredValue } from "react"
import MainLayout from "@/components/main-layout"
import { SectionFixeCommandes } from "@/components/commandes/section-fixe-commandes"
import { PlanningClientTable } from "@/components/commandes/PlanningClientTable"
import NouvelleCommandeDialog from "@/components/commandes/NouvelleCommandeDialog"
import { supabase } from "@/lib/supabase"
import { addDays, format, getWeek, startOfWeek } from "date-fns"
import type { JourPlanning, CommandeWithCandidat } from "@/types/types-front"
import { CommandesIndicateurs } from "@/components/commandes/CommandesIndicateurs"
import { ClientEditDialog } from "@/components/clients/ClientEditDialog"
import { useLiveRows } from "@/hooks/useLiveRows"

// ——————————————————————————————————————————————————————————————
// PAGE Commandes : fetch initial (semaine/secteur via SQL) + patchs Realtime ciblés
// ——————————————————————————————————————————————————————————————

type CommandeRow = {
  id: string
  date: string
  statut: string
  secteur: string
  service?: string | null
  mission_slot: number
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
  motif_contrat?: string | null
  complement_motif?: string | null
}

// ✅ Seuls ces statuts sont comptabilisés dans les indicateurs
const COUNTABLE = new Set(["Validé", "En recherche", "Non pourvue"])

export default function Commandes() {
  // Filtres & états d’UI
  const [selectedSecteurs, setSelectedSecteurs] = useState<string[]>(() => {
    const stored = localStorage.getItem("selectedSecteurs")
    return stored ? JSON.parse(stored) : []
  })
  const [semaineEnCours, setSemaineEnCours] = useState(() => {
    const stored = localStorage.getItem("semaineEnCours")
    return stored ? JSON.parse(stored) : true
  })
  const [semaine, setSemaine] = useState(format(new Date(), "yyyy-MM-dd"))
  const [selectedSemaine, setSelectedSemaine] = useState(() => {
    const stored = localStorage.getItem("selectedSemaine")
    return stored ?? "Toutes"
  })
  const [client, setClient] = useState("")
  const [search, setSearch] = useState("")
  const [toutAfficher, setToutAfficher] = useState(false)
  const [enRecherche, setEnRecherche] = useState(false)

  // Déferrement pour un rendu fluide pendant la saisie
  const deferredSearch = useDeferredValue(search)
  const deferredClient = useDeferredValue(client)
  const deferredEnRecherche = useDeferredValue(enRecherche)

  // Données
  const [planning, setPlanning] = useState<Record<string, JourPlanning[]>>({})
  const [filteredPlanning, setFilteredPlanning] = useState<Record<string, JourPlanning[]>>({})
  const [stats, setStats] = useState({ demandées: 0, validées: 0, enRecherche: 0, nonPourvue: 0 })

  // Cache noms clients (pour éviter "Client inconnu" lors des updates Realtime)
  const [clientNames, setClientNames] = useState<Record<string, string>>({})

  // UI modales
  const [openDialog, setOpenDialog] = useState(false)
  const [clientIdToEdit, setClientIdToEdit] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)

  // 🔹 Semaines dispo
  const [semainesDisponibles, setSemainesDisponibles] = useState<string[]>([])

  // Persistance de filtres
  useEffect(() => { localStorage.setItem("selectedSecteurs", JSON.stringify(selectedSecteurs)) }, [selectedSecteurs])
  useEffect(() => { localStorage.setItem("selectedSemaine", selectedSemaine) }, [selectedSemaine])
  useEffect(() => { localStorage.setItem("semaineEnCours", JSON.stringify(semaineEnCours)) }, [semaineEnCours])

  // ——————— Helpers semaine (borne SQL pour une semaine unique) ———————
  const computeWeekRange = useCallback(() => {
    const now = new Date()
    const mondayCurrent = startOfWeek(now, { weekStartsOn: 1 })
    const weekCurrent = getWeek(now, { weekStartsOn: 1 })

    const targetWeek = (semaineEnCours || selectedSemaine === "Toutes")
      ? weekCurrent
      : parseInt(selectedSemaine || String(weekCurrent), 10)

    const deltaWeeks = targetWeek - weekCurrent
    const mondayTarget = addDays(mondayCurrent, deltaWeeks * 7)
    const sundayTarget = addDays(mondayTarget, 6)

    const dmin = format(mondayTarget, "yyyy-MM-dd")
    const dmax = format(sundayTarget, "yyyy-MM-dd")
    return { dmin, dmax }
  }, [semaineEnCours, selectedSemaine])

  // ——————— Helpers de transformation ———————
  const buildCommandeFromRow = useCallback((item: any): CommandeWithCandidat => {
    return {
      id: item.id,
      date: item.date,
      statut: item.statut,
      secteur: item.secteur,
      service: item.service ?? null,
      mission_slot: item.mission_slot ?? 0,
      client_id: item.client_id,
      candidat_id: item.candidat_id ?? null,
      heure_debut_matin: item.heure_debut_matin ?? null,
      heure_fin_matin: item.heure_fin_matin ?? null,
      heure_debut_soir: item.heure_debut_soir ?? null,
      heure_fin_soir: item.heure_fin_soir ?? null,
      heure_debut_nuit: item.heure_debut_nuit ?? null,
      heure_fin_nuit: item.heure_fin_nuit ?? null,
      commentaire: item.commentaire ?? null,
      created_at: item.created_at,
      updated_at: item.updated_at ?? undefined,
      candidat: item.candidats ? { nom: item.candidats.nom ?? "–", prenom: item.candidats.prenom ?? "–" } : null,
      client: item.clients?.nom
        ? { nom: item.clients.nom }
        : (clientNames[item.client_id] ? { nom: clientNames[item.client_id] } : { nom: item.client_id || "Client inconnu" }),
      motif_contrat: item.motif_contrat ?? null,
      complement_motif: item.complement_motif ?? null,
    }
  }, [clientNames])

  const upsertCommandeInPlanning = useCallback((
    base: Record<string, JourPlanning[]>,
    item: any
  ): Record<string, JourPlanning[]> => {
    const c = buildCommandeFromRow(item)
    const clientNom =
      item.clients?.nom ||
      clientNames[c.client_id] ||
      item.client_id ||
      "Client inconnu"

    const mapCopy: Record<string, JourPlanning[]> = {}
    for (const [cNom, jours] of Object.entries(base)) {
      const newJours: JourPlanning[] = []
      for (const j of jours) {
        const reste = j.commandes.filter((x) => x.id !== c.id)
        if (reste.length > 0) newJours.push({ ...j, commandes: reste })
      }
      if (newJours.length > 0) mapCopy[cNom] = newJours
    }

    const jourKeyMatch = (j: JourPlanning) =>
      j.date === c.date &&
      j.secteur === c.secteur &&
      (j.service ?? null) === (c.service ?? null) &&
      (j.mission_slot ?? 0) === (c.mission_slot ?? 0)

    const joursClient = mapCopy[clientNom] ?? []
    const idx = joursClient.findIndex(jourKeyMatch)

    if (idx >= 0) {
      const jour = joursClient[idx]
      joursClient[idx] = { ...jour, commandes: [...jour.commandes, c] }
    } else {
      joursClient.push({
        date: c.date,
        secteur: c.secteur,
        service: c.service ?? null,
        mission_slot: c.mission_slot ?? 0,
        commandes: [c],
      })
    }

    const next: Record<string, JourPlanning[]> = { ...mapCopy, [clientNom]: joursClient }
    const entries = Object.entries(next).sort(([a], [b]) => a.localeCompare(b))
    const sorted: Record<string, JourPlanning[]> = {}
    for (const [k, v] of entries) sorted[k] = v
    return sorted
  }, [buildCommandeFromRow, clientNames])

  const removeCommandeFromPlanning = useCallback((
    base: Record<string, JourPlanning[]>,
    id: string
  ): Record<string, JourPlanning[]> => {
    const next: Record<string, JourPlanning[]> = {}
    for (const [clientNom, jours] of Object.entries(base)) {
      const newJours: JourPlanning[] = []
      for (const j of jours) {
        const reste = j.commandes.filter((c) => c.id !== id)
        if (reste.length > 0) newJours.push({ ...j, commandes: reste })
      }
      if (newJours.length > 0) next[clientNom] = newJours
    }
    return next
  }, [])

  // ——————— Filtre léger (client / recherche / drapeau enRecherche) ———————
  const applyFiltersLight = useCallback((
    source: Record<string, JourPlanning[]>,
    {
      client, search, enRecherche,
    }: {
      client: string,
      search: string,
      enRecherche: boolean,
    }
  ) => {
    const matchSearchTerm = (val: string) =>
      search.trim().toLowerCase().split(" ").every((term) => val.toLowerCase().includes(term))

    const newFiltered: Record<string, JourPlanning[]> = {}

    Object.entries(source).forEach(([clientNom, jours]) => {
      if (client && clientNom !== client) return

      const joursFiltres = jours.filter((j) => {
        const searchFields = [
          clientNom,
          j.secteur,
          ...j.commandes.map((cmd) => `${cmd.candidat?.prenom || ""} ${cmd.candidat?.nom || ""}`),
        ].join(" ")
        const matchSearch = matchSearchTerm(searchFields)
        const matchRecherche = enRecherche ? j.commandes.some((cmd) => cmd.statut === "En recherche") : true
        return matchSearch && matchRecherche
      })

      if (joursFiltres.length > 0) newFiltered[clientNom] = joursFiltres
    })

    let d = 0, v = 0, r = 0, np = 0
    Object.values(newFiltered).forEach((jours) =>
      jours.forEach((j) =>
        j.commandes.forEach((cmd) => {
          if (!COUNTABLE.has(cmd.statut)) return
          d++
          if (cmd.statut === "Validé") v++
          else if (cmd.statut === "En recherche") r++
          else if (cmd.statut === "Non pourvue") np++
        })
      )
    )

    return { newFiltered, stats: { demandées: d, validées: v, enRecherche: r, nonPourvue: np } }
  }, [])

  // ——————— Chargement (borne SEMAINE OU toutes à partir de la semaine courante) ———————
  const fetchPlanning = useCallback(async () => {
    // Lundi de la semaine courante
    const mondayCurrent = startOfWeek(new Date(), { weekStartsOn: 1 })
    const dminToutes = format(mondayCurrent, "yyyy-MM-dd")
    // borne max défensive
    const dmaxToutes = format(addDays(mondayCurrent, 180), "yyyy-MM-dd")

    // Borne pour une semaine unique
    const { dmin, dmax } = computeWeekRange()

    let query = supabase
      .from("commandes")
      .select(`
        id, date, statut, secteur, service, mission_slot, client_id, candidat_id,
        heure_debut_matin, heure_fin_matin,
        heure_debut_soir, heure_fin_soir,
        heure_debut_nuit, heure_fin_nuit,
        commentaire, created_at, updated_at,
        motif_contrat, complement_motif,
        candidats (id, nom, prenom),
        clients (nom)
      `)

    // 🟢 “Toutes les semaines” => [lundi courant .. +180j]
    if (selectedSemaine === "Toutes") {
      query = query.gte("date", dminToutes).lte("date", dmaxToutes)
    } else {
      query = query.gte("date", dmin).lte("date", dmax)
    }

    query = query
      .order("date", { ascending: true })
      .order("client_id", { ascending: true })
      .order("secteur", { ascending: true })
      .order("service", { ascending: true, nullsFirst: true })
      .order("mission_slot", { ascending: true })

    if (selectedSecteurs.length > 0) {
      query = query.in("secteur", selectedSecteurs)
    }

    const { data, error } = await query

    if (error || !data) {
      console.error("❌ Erreur Supabase :", error)
      setPlanning({})
      setFilteredPlanning({})
      setStats({ demandées: 0, validées: 0, enRecherche: 0, nonPourvue: 0 })
      return
    }

    // Construit la map {client -> jours[]} + cache noms clients
    let map: Record<string, JourPlanning[]> = {}
    const nameCache: Record<string, string> = {}

    for (const item of data as any[]) {
      if (item.client_id && item.clients?.nom) nameCache[item.client_id] = item.clients.nom

      const clientNom = item.clients?.nom || item.client_id || "Client inconnu"
      const commande = buildCommandeFromRow(item)

      const jourKey = (j: JourPlanning) =>
        j.date === item.date &&
        j.secteur === item.secteur &&
        (j.service ?? null) === (item.service ?? null) &&
        (j.mission_slot ?? 0) === (item.mission_slot ?? 0)

      const arr = map[clientNom] ?? []
      const idx = arr.findIndex(jourKey)
      if (idx >= 0) {
        const jour = arr[idx]
        arr[idx] = { ...jour, commandes: [...jour.commandes, commande] }
      } else {
        arr.push({
          date: item.date,
          secteur: item.secteur,
          service: item.service ?? null,
          mission_slot: item.mission_slot ?? 0,
          commandes: [commande],
        })
      }
      map[clientNom] = arr
    }

    // Tri typé
    const entries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
    const sorted: Record<string, JourPlanning[]> = {}
    for (const [k, v] of entries) sorted[k] = v

    setClientNames(nameCache)
    setPlanning(sorted)
    // ⚠️ NE PAS filtrer ici — filtrage local dans l’effet ci-dessous
  }, [computeWeekRange, selectedSemaine, selectedSecteurs, buildCommandeFromRow])

  useEffect(() => { fetchPlanning() }, [fetchPlanning])

  // ——————— fetch ultra-léger des semaines disponibles ———————
  const fetchSemainesDisponibles = useCallback(async () => {
    try {
      // Fenêtre glissante : 52 semaines passées / 26 futures
      const now = new Date()
      const mondayNow = startOfWeek(now, { weekStartsOn: 1 })
      const startWindow = addDays(mondayNow, -52 * 7)
      const endWindow = addDays(mondayNow, 26 * 7 + 6)

      let q = supabase
        .from("commandes")
        .select("date")
        .gte("date", format(startWindow, "yyyy-MM-dd"))
        .lte("date", format(endWindow, "yyyy-MM-dd"))

      if (selectedSecteurs.length > 0) {
        q = q.in("secteur", selectedSecteurs)
      }

      const { data, error } = await q
      if (error || !data) {
        console.error("❌ Erreur Semaines Disponibles :", error)
        setSemainesDisponibles([])
        return
      }

      const weeks = new Set<string>()
      ;(data as { date: string }[]).forEach((row) => {
        const w = getWeek(new Date(row.date), { weekStartsOn: 1 }).toString()
        weeks.add(w)
      })

      const sorted = Array.from(weeks).sort((a, b) => parseInt(a) - parseInt(b))
      setSemainesDisponibles(sorted)
    } catch (e) {
      console.error("fetchSemainesDisponibles exception:", e)
      setSemainesDisponibles([])
    }
  }, [selectedSecteurs])

  useEffect(() => { fetchSemainesDisponibles() }, [fetchSemainesDisponibles])

  // ——————— Recalcule filteredPlanning quand planning OU filtres changent (local/deferred) ———————
  useEffect(() => {
    const { newFiltered, stats } = applyFiltersLight(planning, {
      client: deferredClient,
      search: deferredSearch,
      enRecherche: deferredEnRecherche,
    })
    setFilteredPlanning(newFiltered)
    setStats(stats)
  }, [planning, deferredClient, deferredSearch, deferredEnRecherche, applyFiltersLight])

  // ——————— Patchs Realtime ciblés (pas de refetch global) ———————
  useLiveRows<CommandeRow>({
    table: "commandes",
    onInsert: (row) => {
      if (!row?.id) return
      setPlanning((prev) => upsertCommandeInPlanning(prev, row))
    },
    onUpdate: (row) => {
      if (!row?.id) return
      setPlanning((prev) => upsertCommandeInPlanning(prev, row))
    },
    onDelete: (row) => {
      if (!row?.id) return
      setPlanning((prev) => removeCommandeFromPlanning(prev, row.id))
    },
  })

  // ——————— Données dérivées (totaux semaine courante) ———————
  const semaineCourante = getWeek(new Date(), { weekStartsOn: 1 }).toString()
  const totauxSemaine = useMemo(() => {
    const res = { demandées: 0, validées: 0, enRecherche: 0, nonPourvue: 0 }
    Object.values(planning).forEach((jours) => {
      jours.forEach((j) => {
        const week = getWeek(new Date(j.date), { weekStartsOn: 1 }).toString()
        if (week === semaineCourante) {
          j.commandes.forEach((cmd) => {
            if (!COUNTABLE.has(cmd.statut)) return
            res.demandées++
            if (cmd.statut === "Validé") res.validées++
            else if (cmd.statut === "En recherche") res.enRecherche++
            else if (cmd.statut === "Non pourvue") res.nonPourvue++
          })
        }
      })
    })
    return res
  }, [planning, semaineCourante])

  return (
    <MainLayout>
      <div className="sticky top-[64px] z-20 bg-white shadow-md space-y-6 pb-4">
        <CommandesIndicateurs
          stats={stats}
          totauxSemaine={totauxSemaine}
          planning={planning}
          filteredPlanning={filteredPlanning}
        />

        <SectionFixeCommandes
          selectedSecteurs={selectedSecteurs}
          setSelectedSecteurs={setSelectedSecteurs}
          stats={stats}
          totauxSemaine={totauxSemaine}
          taux={
            stats.demandées > 0
              ? Math.round((stats.validées / stats.demandées) * 100)
              : 0
          }
          semaine={semaine}
          setSemaine={setSemaine}
          selectedSemaine={selectedSemaine}
          setSelectedSemaine={setSelectedSemaine}
          client={client}
          setClient={setClient}
          search={search}
          setSearch={setSearch}
          toutAfficher={toutAfficher}
          setToutAfficher={setToutAfficher}
          enRecherche={enRecherche}
          setEnRecherche={setEnRecherche}
          semaineEnCours={semaineEnCours}
          setSemaineEnCours={setSemaineEnCours}
          resetFiltres={() => {
            const semActuelle = getWeek(new Date(), { weekStartsOn: 1 }).toString()
            setSelectedSecteurs(["Étages"])
            setClient("")
            setSearch("")
            setEnRecherche(false)
            setToutAfficher(false)
            setSemaineEnCours(true)
            setSemaine(format(new Date(), "yyyy-MM-dd"))
            setSelectedSemaine(semActuelle)
            localStorage.setItem("selectedSecteurs", JSON.stringify(["Étages"]))
            localStorage.setItem("selectedSemaine", semActuelle)
            localStorage.setItem("semaineEnCours", JSON.stringify(true))
            // refetch explicite
            fetchPlanning()
          }}
          semainesDisponibles={semainesDisponibles}
          clientsDisponibles={Object.keys(planning)}
          refreshTrigger={0}
          onRefresh={() => { fetchPlanning() }}
          planningContext={{}}
        />
      </div>

      <PlanningClientTable
        planning={filteredPlanning}
        selectedSecteurs={selectedSecteurs}
        selectedSemaine={selectedSemaine}
        onRefresh={() => fetchPlanning()}
        refreshTrigger={0}
        onOpenClientEdit={(id) => {
          setClientIdToEdit(id)
          setShowEditDialog(true)
        }}
      />

      <NouvelleCommandeDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        onRefreshDone={() => fetchPlanning()}
      />

      {clientIdToEdit && (
        <ClientEditDialog
          clientId={clientIdToEdit}
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open)
            if (!open) setClientIdToEdit(null)
          }}
          onRefresh={() => fetchPlanning()}
        />
      )}
    </MainLayout>
  )
}
