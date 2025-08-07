import { useEffect, useState } from "react"
import { usePlanning } from "@/contexts/PlanningContext"
import MainLayout from "@/components/main-layout"
import { SectionFixeCommandes } from "@/components/commandes/section-fixe-commandes"
import { PlanningClientTable } from "@/components/commandes/PlanningClientTable"
import NouvelleCommandeDialog from "@/components/commandes/NouvelleCommandeDialog"
import { supabase } from "@/lib/supabase"
import { addDays, format, startOfWeek, getWeek } from "date-fns"
import type { JourPlanning } from "@/types/types-front"
import { CommandesIndicateurs } from "@/components/commandes/CommandesIndicateurs"
import { ClientEditDialog } from "@/components/clients/ClientEditDialog"


export default function Commandes() {
  const [selectedSecteurs, setSelectedSecteurs] = useState<string[]>(() => {
    const stored = localStorage.getItem("selectedSecteurs")
    return stored ? JSON.parse(stored) : []
  })

  const [planning, setPlanning] = useState<Record<string, JourPlanning[]>>({})
  const [filteredPlanning, setFilteredPlanning] = useState<Record<string, JourPlanning[]>>({})
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
  const [stats, setStats] = useState({ demandées: 0, validées: 0, enRecherche: 0, nonPourvue: 0 })
  const [openDialog, setOpenDialog] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [clientIdToEdit, setClientIdToEdit] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const { planning: planningContext, refreshPlanning } = usePlanning()

  useEffect(() => {
    localStorage.setItem("selectedSecteurs", JSON.stringify(selectedSecteurs))
  }, [selectedSecteurs])

  useEffect(() => {
    localStorage.setItem("selectedSemaine", selectedSemaine)
  }, [selectedSemaine])

  useEffect(() => {
    localStorage.setItem("semaineEnCours", JSON.stringify(semaineEnCours))
  }, [semaineEnCours])


  const fetchPlanning = async () => {
    const lundi = startOfWeek(new Date(), { weekStartsOn: 1 })
    const semaineCourante = getWeek(lundi).toString()

    const { data, error } = await supabase
      .from("commandes")
      .select(`
        id, date, statut, secteur, service, mission_slot, client_id,
        heure_debut_matin, heure_fin_matin,
        heure_debut_soir, heure_fin_soir,
        commentaire, created_at,
        candidats (id, nom, prenom),
        clients (nom)
      `)

    if (error || !data) {
      console.error("❌ Erreur Supabase :", error)
      return
    }

    const map: Record<string, JourPlanning[]> = {}
    for (const item of data as any[]) {
      const nomClient = item.clients?.nom || item.client_id || "Client inconnu"
      if (!map[nomClient]) map[nomClient] = []

      const jour: JourPlanning = {
        date: item.date,
        secteur: item.secteur,
        service: item.service,
        mission_slot: item.mission_slot ?? 0,
        commandes: [
          {
            id: item.id,
            date: item.date,
            statut: item.statut,
            secteur: item.secteur,
            service: item.service,
            mission_slot: item.mission_slot ?? 0,
            client_id: item.client_id,
            candidat_id: item.candidat?.id ?? null,
            heure_debut_matin: item.heure_debut_matin,
            heure_fin_matin: item.heure_fin_matin,
            heure_debut_soir: item.heure_debut_soir,
            heure_fin_soir: item.heure_fin_soir,
            commentaire: item.commentaire,
            created_at: item.created_at,
            candidat:
              item.candidats
                ? {
                    nom: item.candidats.nom ?? "–",
                    prenom: item.candidats.prenom ?? "–",
                  }
                : null,
            client: item.clients?.nom ? { nom: item.clients.nom } : null,
          },
        ],
      }

      map[nomClient].push(jour)
    }

    const mapTrie = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)))
    setPlanning(mapTrie)
    setRefreshTrigger((v) => v + 1)

    // Appliquer les filtres courants à nouveau (pas de réinitialisation)
    const filtered: Record<string, JourPlanning[]> = {};
    Object.entries(mapTrie).forEach(([clientNom, jours]) => {
      const joursFiltres = jours.filter((j) => {
        const semaineDuJour = getWeek(new Date(j.date), { weekStartsOn: 1 }).toString()
        const matchSecteur = selectedSecteurs.includes(j.secteur)
        const matchSemaine = semaineEnCours ? semaineDuJour === getWeek(new Date(), { weekStartsOn: 1 }).toString() : true
        return matchSecteur && matchSemaine
      })
      if (joursFiltres.length > 0) {
        filtered[clientNom] = joursFiltres
      }
    })

    setFilteredPlanning(filtered)
    console.log("✅ fetchPlanning – données reçues :", Object.keys(mapTrie))
  }

  useEffect(() => {
    fetchPlanning()
  }, [])

  useEffect(() => {
    if (Object.keys(planningContext).length === 0) return
    const map: Record<string, JourPlanning[]> = {}

    for (const item of planningContext) {
      const nomClient = item.client?.nom || item.client_id || "Client inconnu"
      if (!map[nomClient]) map[nomClient] = []

      const jourIndex = map[nomClient].findIndex(
        (j) =>
          j.date === item.date &&
          j.secteur === item.secteur &&
          j.service === item.service &&
          j.mission_slot === item.mission_slot
      )

      const commande = {
        id: item.id,
        date: item.date,
        statut: item.statut,
        secteur: item.secteur,
        service: item.service,
        mission_slot: item.mission_slot ?? 0,
        client_id: item.client_id,
        candidat_id: item.candidat_id ?? null,
        heure_debut_matin: item.heure_debut_matin,
        heure_fin_matin: item.heure_fin_matin,
        heure_debut_soir: item.heure_debut_soir,
        heure_fin_soir: item.heure_fin_soir,
        commentaire: item.commentaire,
        created_at: item.created_at,
        candidat:
          item.candidat
            ? {
                nom: item.candidat.nom ?? "–",
                prenom: item.candidat.prenom ?? "–",
              }
            : null,
        client: item.client?.nom ? { nom: item.client.nom } : null,
      }


      if (jourIndex !== -1) {
        map[nomClient][jourIndex].commandes.push(commande)
      } else {
        map[nomClient].push({
          date: item.date,
          secteur: item.secteur,
          service: item.service,
          mission_slot: item.mission_slot || 0,
          commandes: [commande],
        })
      }
    }

    const matchSearchTerm = (val: string) =>
      search.trim().toLowerCase().split(" ").every((term) =>
        val.toLowerCase().includes(term)
      )

    const newFiltered: Record<string, JourPlanning[]> = {}

    Object.entries(map).forEach(([clientNom, jours]) => {
      const joursFiltres = jours.filter((j) => {
        const semaineDuJour = getWeek(new Date(j.date), { weekStartsOn: 1 }).toString()
        const matchSecteur = selectedSecteurs.includes(j.secteur)
        const matchClient = client ? clientNom === client : true
        const matchRecherche = enRecherche
          ? j.commandes.some((cmd) => cmd.statut === "En recherche")
          : true
        const matchSemaine =
          selectedSemaine === "Toutes" || selectedSemaine === semaineDuJour

        const searchFields = [
          clientNom,
          j.secteur,
          semaineDuJour,
          ...j.commandes.map(
            (cmd) => `${cmd.candidat?.prenom || ""} ${cmd.candidat?.nom || ""}`
          ),
        ].join(" ")

        const matchSearch = matchSearchTerm(searchFields)

        return (
          matchSecteur &&
          matchClient &&
          matchRecherche &&
          matchSemaine &&
          matchSearch
        )
      })

      if (joursFiltres.length > 0) {
        newFiltered[clientNom] = joursFiltres
      }
    })

    setFilteredPlanning(newFiltered)

    let d = 0,
      v = 0,
      r = 0,
      np = 0

    Object.values(newFiltered).forEach((jours) =>
      jours.forEach((j) =>
        j.commandes.forEach((cmd) => {
          if (cmd.statut !== "Annule Client" && cmd.statut !== "Annule ADA") {
            d++
            if (cmd.statut === "Validé") v++
            if (cmd.statut === "En recherche") r++
            if (cmd.statut === "Non pourvue") np++
          }
        })
      )
    )

    setStats({ demandées: d, validées: v, enRecherche: r, nonPourvue: np })
  }, [
    planningContext,
    selectedSecteurs,
    selectedSemaine,
    client,
    search,
    enRecherche,
    toutAfficher,
  ])

  const resetFiltres = () => {
    const semaineActuelle = getWeek(new Date(), { weekStartsOn: 1 }).toString()

    setSelectedSecteurs(["Étages"])
    setClient("")
    setSearch("")
    setEnRecherche(false)
    setToutAfficher(false)
    setSemaineEnCours(true)
    setSemaine(format(new Date(), "yyyy-MM-dd"))
    setSelectedSemaine(semaineActuelle)

    localStorage.setItem("selectedSecteurs", JSON.stringify(["Étages"]))
    localStorage.setItem("selectedSemaine", semaineActuelle)
    localStorage.setItem("semaineEnCours", JSON.stringify(true))
  }


  const semainesDisponibles = Array.from(
    new Set(
      Object.values(planning).flat().map((j) =>
        getWeek(new Date(j.date), { weekStartsOn: 1 }).toString()
      )
    )
  ).sort()

  const clientsDisponibles = Object.keys(planning)

  const semaineCourante = getWeek(new Date(), { weekStartsOn: 1 }).toString()
  const totauxSemaine = { demandées: 0, validées: 0, enRecherche: 0, nonPourvue: 0 }

  Object.values(planning).forEach((jours) => {
    jours.forEach((j) => {
      const week = getWeek(new Date(j.date), { weekStartsOn: 1 }).toString()
      if (week === semaineCourante) {
        j.commandes.forEach((cmd) => {
          if (cmd.statut !== "Annule Client" && cmd.statut !== "Annule ADA") {
            totauxSemaine.demandées++
            if (cmd.statut === "Validé") totauxSemaine.validées++
            if (cmd.statut === "En recherche") totauxSemaine.enRecherche++
            if (cmd.statut === "Non pourvue") totauxSemaine.nonPourvue++
          }
        })
      }
    })
  })

  const lignes = Object.keys(filteredPlanning).length === 1 ? Object.values(filteredPlanning)[0] : []

  useEffect(() => {
    const channel = supabase
      .channel('realtime:commandes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'commandes',
        },
        (payload) => {
          console.log("🔄 Changement en live sur 'commandes' :", payload)
          fetchPlanning()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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
          resetFiltres={resetFiltres}
          semainesDisponibles={semainesDisponibles}
          clientsDisponibles={clientsDisponibles}
          refreshTrigger={refreshTrigger}
          onRefresh={refreshPlanning}
          planningContext={planningContext}
        />
      </div>

      <PlanningClientTable
        planning={filteredPlanning}
        selectedSecteurs={selectedSecteurs}
        selectedSemaine={selectedSemaine}
        onRefresh={refreshPlanning}
        refreshTrigger={refreshTrigger}
        onOpenClientEdit={(id) => {
          setClientIdToEdit(id)
          setShowEditDialog(true)
        }}
      />

      <NouvelleCommandeDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        onRefreshDone={refreshPlanning}
      />

{clientIdToEdit && (
        <ClientEditDialog
          clientId={clientIdToEdit}
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open)
            if (!open) setClientIdToEdit(null)
          }}
          onRefresh={refreshPlanning}
        />
      )}
    </MainLayout>
  )
}
