import { useEffect, useState } from "react"
import MainLayout from "@/components/main-layout"
import { SectionFixeCommandes } from "@/components/commandes/section-fixe-commandes"
import { PlanningClientTable } from "@/components/commandes/PlanningClientTable"
import NouvelleCommandeDialog from "@/components/commandes/NouvelleCommandeDialog"
import { supabase } from "@/lib/supabase"
import { addDays, format, startOfWeek, getWeek } from "date-fns"
import type { JourPlanning, CommandeWithCandidat } from "@/types/types-front"

export default function Commandes() {
  const [planning, setPlanning] = useState<Record<string, JourPlanning[]>>({})
  const [filteredPlanning, setFilteredPlanning] = useState<Record<string, JourPlanning[]>>({})
  const [selectedSecteurs, setSelectedSecteurs] = useState(["Étages"])
  const [semaineEnCours, setSemaineEnCours] = useState(true)
  const [semaine, setSemaine] = useState(format(new Date(), "yyyy-MM-dd"))
  const [selectedSemaine, setSelectedSemaine] = useState(getWeek(new Date()).toString())
  const [client, setClient] = useState("")
  const [search, setSearch] = useState("")
  const [toutAfficher, setToutAfficher] = useState(false)
  const [enRecherche, setEnRecherche] = useState(false)
  const [stats, setStats] = useState({ demandées: 0, validées: 0, enRecherche: 0, nonPourvue: 0 })
  const [openDialog, setOpenDialog] = useState(false)

  useEffect(() => {
    const baseDate = new Date(semaine)
    const dates = Array.from({ length: 7 }, (_, i) =>
      addDays(startOfWeek(baseDate, { weekStartsOn: 1 }), i)
    )
  }, [semaine])

  const fetchPlanning = async () => {
    const lundi = startOfWeek(new Date(), { weekStartsOn: 1 })
    const semaineCourante = getWeek(lundi, { weekStartsOn: 1 }).toString()

    const { data, error } = await supabase
      .from("commandes")
      .select(`
        id, date, statut, secteur, service, client_id,
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
        commandes: [
          {
            id: item.id,
            date: item.date,
            statut: item.statut,
            secteur: item.secteur,
            service: item.service,
            client_id: item.client_id,
            candidat_id: item.candidats?.id ?? null,
            heure_debut_matin: item.heure_debut_matin,
            heure_fin_matin: item.heure_fin_matin,
            heure_debut_soir: item.heure_debut_soir,
            heure_fin_soir: item.heure_fin_soir,
            commentaire: item.commentaire,
            created_at: item.created_at,
            candidat:
              item.candidats &&
              typeof item.candidats.nom === "string" &&
              typeof item.candidats.prenom === "string"
                ? {
                    nom: item.candidats.nom,
                    prenom: item.candidats.prenom,
                  }
                : null,
          },
        ],
      }

      map[nomClient].push(jour)
    }

    const mapTrie: Record<string, JourPlanning[]> = Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
    )

    setPlanning(mapTrie)
    setFilteredPlanning(mapTrie)
    setSelectedSemaine(semaineCourante)
  }

  useEffect(() => {
    fetchPlanning()
  }, [])

  useEffect(() => {
    const currentWeek = getWeek(new Date(), { weekStartsOn: 1 })
    const matchSearchTerm = (val: string) =>
      search.trim().toLowerCase().split(" ").every((term) => val.toLowerCase().includes(term))

    const newFiltered: typeof planning = {}

    Object.entries(planning).forEach(([clientNom, jours]) => {
      const joursFiltres = jours.filter((j) => {
        const semaineDuJour = getWeek(new Date(j.date), { weekStartsOn: 1 }).toString()
        const matchSecteur = selectedSecteurs.includes(j.secteur)
        const matchClient = client ? clientNom === client : true
        const matchRecherche = enRecherche
          ? j.commandes.some((cmd) => cmd.statut === "En recherche")
          : true
        const matchSemaine =
          selectedSemaine === "Toutes" || selectedSemaine === semaineDuJour
        return matchSecteur && matchClient && matchRecherche && matchSemaine
      })
      if (joursFiltres.length > 0) {
        newFiltered[clientNom] = joursFiltres
      }
    })

    setFilteredPlanning(newFiltered)

    let d = 0, v = 0, r = 0, np = 0

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

    setStats({
      demandées: d,
      validées: v,
      enRecherche: r,
      nonPourvue: np,
    })
  }, [planning, selectedSecteurs, selectedSemaine, client, search, enRecherche, toutAfficher])

  const resetFiltres = () => {
    setSelectedSecteurs(["Étages"])
    setClient("")
    setSearch("")
    setEnRecherche(false)
    setToutAfficher(false)
    setSemaineEnCours(true)
    setSemaine(format(new Date(), "yyyy-MM-dd"))
    const current = getWeek(new Date(), { weekStartsOn: 1 }).toString()
    setSelectedSemaine(current)
  }

  const semainesDisponibles = Array.from(
    new Set(
      Object.values(planning).flat().map((j) =>
        getWeek(new Date(j.date), { weekStartsOn: 1 }).toString()
      )
    )
  ).sort()

  const clientsDisponibles = Object.keys(planning)

  // ✅ Ajout totaux semaine en cours (pour tous secteurs)
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

  return (
    <MainLayout>
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
      />

      <PlanningClientTable
        planning={filteredPlanning}
        selectedSecteurs={selectedSecteurs}
        selectedSemaine={selectedSemaine}
        onRefresh={fetchPlanning}
      />

      <NouvelleCommandeDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        onRefresh={fetchPlanning}
        onRefreshDone={() => {}}
      />
    </MainLayout>
  )
}
