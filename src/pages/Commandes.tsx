import { useEffect, useState } from "react"
import MainLayout from "@/components/main-layout"
import { SectionFixeCommandes } from "@/components/commandes/section-fixe-commandes"
import { PlanningClientTable } from "@/components/commandes/PlanningClientTable"
import { supabase } from "@/lib/supabase"
import { addDays, format, startOfWeek, getWeek } from "date-fns"
import { Commande, JourPlanning } from "@/types"

export default function Commandes() {
  const [planning, setPlanning] = useState<Record<string, JourPlanning[]>>({})
  const [filteredPlanning, setFilteredPlanning] = useState<Record<string, JourPlanning[]>>({})
  const [selectedSecteurs, setSelectedSecteurs] = useState(["Étages"])
  const [semaineEnCours, setSemaineEnCours] = useState(true)
  const [semaine, setSemaine] = useState(format(new Date(), "yyyy-MM-dd"))
  const [selectedSemaine, setSelectedSemaine] = useState("Toutes")
  const [semaineDates, setSemaineDates] = useState<Date[]>([])
  const [client, setClient] = useState("")
  const [search, setSearch] = useState("")
  const [toutAfficher, setToutAfficher] = useState(false)
  const [enRecherche, setEnRecherche] = useState(false)
  const [stats, setStats] = useState({ demandées: 0, validées: 0, enRecherche: 0, nonPourvue: 0 })

  useEffect(() => {
    const baseDate = new Date(semaine || new Date())
    const dates = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(baseDate, { weekStartsOn: 1 }), i))
    setSemaineDates(dates)
  }, [semaine])

  useEffect(() => {
    const fetchPlanning = async () => {
      const lundi = startOfWeek(new Date(), { weekStartsOn: 1 })
      const { data, error } = await supabase
        .from("commandes")
        .select(`
          id, date, statut, secteur, service, client_id,
          heure_debut_matin, heure_fin_matin,
          heure_debut_soir, heure_fin_soir,
          candidats (nom, prenom),
          client:client_id (nom)
        `)
        .gte("date", lundi.toISOString().slice(0, 10))

      if (error || !data) {
        console.error("Erreur Supabase :", error)
        return
      }

      const map: Record<string, JourPlanning[]> = {}
      for (const item of data as any[]) {
        const nomClient = item.client?.nom || item.client_id || "Client inconnu"
        if (!map[nomClient]) map[nomClient] = []

        const jour: JourPlanning = {
          date: item.date,
          secteur: item.secteur,
          service: item.service,
          commandes: [{
            id: item.id,
            date: item.date,
            statut: item.statut,
            secteur: item.secteur,
            service: item.service,
            client_id: item.client_id,
            heure_debut_matin: item.heure_debut_matin,
            heure_fin_matin: item.heure_fin_matin,
            heure_debut_soir: item.heure_debut_soir,
            heure_fin_soir: item.heure_fin_soir,
            candidats: item.candidats ? { nom: item.candidats.nom, prenom: item.candidats.prenom } : undefined,
            clients: item.client ? { nom: item.client.nom } : undefined,
          }]
        }

        map[nomClient].push(jour)
      }

      setPlanning(map)
    }

    fetchPlanning()
  }, [])

  useEffect(() => {
    const semaineActuelle = getWeek(new Date())

    const matchSearchTerm = (val: string) => {
      return search.trim().toLowerCase().split(" ").every(term => val.toLowerCase().includes(term))
    }

    const newFiltered: typeof planning = {}

    if (search.trim()) {
      Object.entries(planning).forEach(([clientNom, jours]) => {
        const joursMatch = jours.filter((j) => {
          const dateStr = format(new Date(j.date), "dd/MM/yyyy")
          const semaineStr = getWeek(new Date(j.date)).toString()

          return (
            matchSearchTerm(clientNom) ||
            matchSearchTerm(j.secteur) ||
            (j.service && matchSearchTerm(j.service)) ||
            matchSearchTerm(semaineStr) ||
            matchSearchTerm(dateStr) ||
            j.commandes.some((cmd) =>
              [cmd.candidats?.nom, cmd.candidats?.prenom, cmd.statut].filter(Boolean).some((val) =>
                val ? matchSearchTerm(val) : false
              )
            )
          )
        })
        if (joursMatch.length > 0) {
          newFiltered[clientNom] = joursMatch
        }
      })
      setFilteredPlanning(newFiltered)
      return
    }

    Object.entries(planning).forEach(([clientNom, jours]) => {
      const joursFiltres = jours.filter((j) => {
        const semaineDuJour = getWeek(new Date(j.date))
        const matchSecteur = selectedSecteurs.includes(j.secteur)
        const matchClient = client ? clientNom === client : true
        const matchRecherche = enRecherche ? j.commandes.some((cmd) => cmd.statut?.toLowerCase() === "en recherche") : true
        const matchSemaine = selectedSemaine === "Toutes" || selectedSemaine === semaineDuJour.toString()
        return matchSecteur && matchClient && matchRecherche && matchSemaine
      })
      if (joursFiltres.length > 0) {
        newFiltered[clientNom] = joursFiltres
      }
    })

    if (toutAfficher) {
      const allVisible = Object.entries(planning).reduce((acc, [clientNom, jours]) => {
        const joursFuturs = jours.filter((j) => getWeek(new Date(j.date)) >= semaineActuelle)
        const matchClient = client ? clientNom === client : true
        if (joursFuturs.length > 0 && matchClient) {
          acc[clientNom] = joursFuturs
        }
        return acc
      }, {} as Record<string, JourPlanning[]>)
      setFilteredPlanning(allVisible)
    } else {
      setFilteredPlanning(newFiltered)
    }

    let d = 0,
      v = 0,
      r = 0,
      np = 0
    Object.values(toutAfficher ? planning : newFiltered).forEach((jours) =>
      jours.forEach((j) =>
        j.commandes.forEach((cmd) => {
          d++
          if (cmd.statut === "Validé") v++
          else if (cmd.statut === "En recherche") r++
          else np++
        })
      )
    )
    setStats({ demandées: d, validées: v, enRecherche: r, nonPourvue: np })
  }, [planning, selectedSecteurs, selectedSemaine, client, search, enRecherche, toutAfficher])

  const resetFiltres = () => {
    setSelectedSecteurs(["Étages"])
    setClient("")
    setSearch("")
    setEnRecherche(false)
    setToutAfficher(false)
    setSemaineEnCours(true)
    setSemaine(format(new Date(), "yyyy-MM-dd"))
    setSelectedSemaine("Toutes")
  }

  const taux = stats.demandées > 0 ? Math.round((stats.validées / stats.demandées) * 100) : 0

  const semainesDisponibles = Array.from(
    new Set(
      Object.values(planning)
        .flat()
        .map((j) => getWeek(new Date(j.date)).toString())
    )
  ).sort((a, b) => parseInt(a) - parseInt(b))

  const clientsDisponibles = Object.keys(planning)

  return (
    <MainLayout>
      <SectionFixeCommandes
        selectedSecteurs={selectedSecteurs}
        setSelectedSecteurs={setSelectedSecteurs}
        stats={stats}
        taux={taux}
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
      />
    </MainLayout>
  )
}
