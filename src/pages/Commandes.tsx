import { useCallback, useEffect, useMemo, useState } from "react"
import MainLayout from "@/components/main-layout"
import { SectionFixeCommandes } from "@/components/commandes/section-fixe-commandes"
import { PlanningClientTable } from "@/components/commandes/PlanningClientTable"
import NouvelleCommandeDialog from "@/components/commandes/NouvelleCommandeDialog"
import { supabase } from "@/lib/supabase"
import { format, getWeek } from "date-fns"
import type { JourPlanning, CommandeWithCandidat } from "@/types/types-front"
import { CommandesIndicateurs } from "@/components/commandes/CommandesIndicateurs"
import { ClientEditDialog } from "@/components/clients/ClientEditDialog"
import { useLiveRows } from "@/hooks/useLiveRows"

// ——————————————————————————————————————————————————————————————
// PAGE Commandes : fetch initial + patchs Realtime ciblés, sans refetch global
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
    return stored ? JSON.parse(stored) : false
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

  // Persistance de filtres
  useEffect(() => { localStorage.setItem("selectedSecteurs", JSON.stringify(selectedSecteurs)) }, [selectedSecteurs])
  useEffect(() => { localStorage.setItem("selectedSemaine", selectedSemaine) }, [selectedSemaine])
  useEffect(() => { localStorage.setItem("semaineEnCours", JSON.stringify(semaineEnCours)) }, [semaineEnCours])

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
      // ⚠️ Le payload Realtime n'inclut pas les joints ; on reconstruit via caches/état
      candidat: null,
      client: item.clients?.nom
        ? { nom: item.clients.nom }
        : (clientNames[item.client_id] ? { nom: clientNames[item.client_id] } : null),
      motif_contrat: item.motif_contrat ?? null,
      complement_motif: item.complement_motif ?? null, 
    }
  }, [clientNames])

  // Insère/remplace une commande dans la map { clientNom -> Jour[] } (et supprime son ancienne position si nécessaire)
  const upsertCommandeInPlanning = useCallback((
    base: Record<string, JourPlanning[]>,
    item: any
  ): Record<string, JourPlanning[]> => {
    const commande = buildCommandeFromRow(item)
    const clientNom =
      item.clients?.nom ||
      clientNames[commande.client_id] ||
      item.client_id ||
      "Client inconnu"

    // 1) supprimer si la commande existait ailleurs
    const mapCopy: Record<string, JourPlanning[]> = {}
    for (const [cNom, jours] of Object.entries(base)) {
      const newJours: JourPlanning[] = []
      for (const j of jours) {
        const reste = j.commandes.filter((c) => c.id !== commande.id)
        if (reste.length > 0) newJours.push({ ...j, commandes: reste })
      }
      if (newJours.length > 0) mapCopy[cNom] = newJours
    }

    // 2) ajouter dans le bon groupe (date + secteur + service + slot) sous le bon client
    const jourKeyMatch = (j: JourPlanning) =>
      j.date === commande.date &&
      j.secteur === commande.secteur &&
      (j.service ?? null) === (commande.service ?? null) &&
      (j.mission_slot ?? 0) === (commande.mission_slot ?? 0)

    const joursClient = mapCopy[clientNom] ?? []
    const idx = joursClient.findIndex(jourKeyMatch)

    if (idx >= 0) {
      const jour = joursClient[idx]
      joursClient[idx] = { ...jour, commandes: [...jour.commandes, commande] }
    } else {
      joursClient.push({
        date: commande.date,
        secteur: commande.secteur,
        service: commande.service ?? null,
        mission_slot: commande.mission_slot ?? 0,
        commandes: [commande],
      })
    }

    // 3) réinjecter + trier
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

  // Recalcule filteredPlanning + stats à partir de planning + filtres (aucune “vue par défaut” forcée)
  const applyFilters = useCallback((
    source: Record<string, JourPlanning[]>,
    {
      selectedSecteurs,
      selectedSemaine,
      client,
      search,
      enRecherche,
      semaineEnCours,
    }: {
      selectedSecteurs: string[],
      selectedSemaine: string,
      client: string,
      search: string,
      enRecherche: boolean,
      semaineEnCours: boolean,
    }
  ) => {
    const matchSearchTerm = (val: string) =>
      search.trim().toLowerCase().split(" ").every((term) => val.toLowerCase().includes(term))

    const newFiltered: Record<string, JourPlanning[]> = {}

    Object.entries(source).forEach(([clientNom, jours]) => {
      const joursFiltres = jours.filter((j) => {
        const semaineDuJour = getWeek(new Date(j.date), { weekStartsOn: 1 }).toString()
        const matchSecteur = selectedSecteurs.includes(j.secteur)
        const matchClient = client ? clientNom === client : true
        const matchRecherche = enRecherche ? j.commandes.some((cmd) => cmd.statut === "En recherche") : true
        const matchSemaine =
          semaineEnCours
            ? semaineDuJour === getWeek(new Date(), { weekStartsOn: 1 }).toString()
            : (selectedSemaine === "Toutes" || selectedSemaine === semaineDuJour)

        const searchFields = [
          clientNom,
          j.secteur,
          semaineDuJour,
          ...j.commandes.map((cmd) => `${cmd.candidat?.prenom || ""} ${cmd.candidat?.nom || ""}`),
        ].join(" ")

        const matchSearch = matchSearchTerm(searchFields)
        return matchSecteur && matchClient && matchRecherche && matchSemaine && matchSearch
      })

      if (joursFiltres.length > 0) {
        newFiltered[clientNom] = joursFiltres
      }
    })

    // ✅ Stats basées uniquement sur les statuts COUNTABLE
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

  // ——————— Chargement initial (UN SEUL fetch) ———————
  const fetchPlanning = useCallback(async () => {
    const { data, error } = await supabase
      .from("commandes")
      .select(`
        id, date, statut, secteur, service, mission_slot, client_id, candidat_id,
        heure_debut_matin, heure_fin_matin,
        heure_debut_soir, heure_fin_soir,
        commentaire, created_at, updated_at,
        motif_contrat, complement_motif,   
        candidats (id, nom, prenom),
        clients (nom)
      `)

    if (error || !data) {
      console.error("❌ Erreur Supabase :", error)
      return
    }

    // Construit la map {client -> jours[]} + cache noms clients
    let map: Record<string, JourPlanning[]> = {}
    const nameCache: Record<string, string> = {}

    for (const item of data as any[]) {
      if (item.client_id && item.clients?.nom) nameCache[item.client_id] = item.clients.nom

      const clientNom = item.clients?.nom || item.client_id || "Client inconnu"
      const commande = {
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
        client: item.clients?.nom ? { nom: item.clients.nom } : null,
        motif_contrat: item.motif_contrat ?? null,
        complement_motif: item.complement_motif ?? null,
      } as CommandeWithCandidat

      const jourKey = (j: JourPlanning) =>
        j.date === item.date && j.secteur === item.secteur && (j.service ?? null) === (item.service ?? null) && (j.mission_slot ?? 0) === (item.mission_slot ?? 0)

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

    const { newFiltered, stats } = applyFilters(sorted, {
      selectedSecteurs,
      selectedSemaine,
      client,
      search,
      enRecherche,
      semaineEnCours,
    })
    setFilteredPlanning(newFiltered)
    setStats(stats)
  }, [applyFilters, selectedSecteurs, selectedSemaine, client, search, enRecherche, semaineEnCours])

  useEffect(() => { fetchPlanning() }, [fetchPlanning])

  // ——————— Recalcule filteredPlanning quand filtres OU planning changent ———————
  useEffect(() => {
    const { newFiltered, stats } = applyFilters(planning, {
      selectedSecteurs,
      selectedSemaine,
      client,
      search,
      enRecherche,
      semaineEnCours,
    })
    setFilteredPlanning(newFiltered)
    setStats(stats)
  }, [planning, selectedSecteurs, selectedSemaine, client, search, enRecherche, semaineEnCours, applyFilters])

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

  // ——————— Données dérivées (semaines / clients disponibles) ———————
  const semainesDisponibles = useMemo(() => {
    return Array.from(
      new Set(
        Object.values(planning).flat().map((j) =>
          getWeek(new Date(j.date), { weekStartsOn: 1 }).toString()
        )
      )
    ).sort()
  }, [planning])

  const clientsDisponibles = useMemo(() => Object.keys(planning), [planning])

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
          }}
          semainesDisponibles={semainesDisponibles}
          clientsDisponibles={clientsDisponibles}
          // ❌ On ne déclenche PLUS de refresh global côté UI
          refreshTrigger={0}
          onRefresh={() => {}}
          planningContext={{}}
        />
      </div>

      <PlanningClientTable
        planning={filteredPlanning}
        selectedSecteurs={selectedSecteurs}
        selectedSemaine={selectedSemaine}
        // ❌ Pas de refetch global au succès d’une action
        onRefresh={() => {}}
        refreshTrigger={0}
        onOpenClientEdit={(id) => {
          setClientIdToEdit(id)
          setShowEditDialog(true)
        }}
      />

      <NouvelleCommandeDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        // ❌ plus de refetch global — on laisse Realtime patcher
        onRefreshDone={() => {}}
      />

      {clientIdToEdit && (
        <ClientEditDialog
          clientId={clientIdToEdit}
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open)
            if (!open) setClientIdToEdit(null)
          }}
          // ❌ plus de refetch global
          onRefresh={() => {}}
        />
      )}
    </MainLayout>
  )
}
