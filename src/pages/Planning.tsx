import { useEffect, useState } from "react"
import MainLayout from "@/components/main-layout"
import { SectionFixeCandidates } from "@/components/Planning/section-fixe-candidates"
import { PlanningCandidateTable } from "@/components/Planning/PlanningCandidateTable"
import { supabase } from "@/lib/supabase"
import { format, getWeek, startOfWeek, addDays, parseISO } from "date-fns"
import type { JourPlanningCandidat, CommandeFull, StatutCommande } from "@/types/types-front"

export default function Planning() {
  const [planning, setPlanning] = useState<Record<string, JourPlanningCandidat[]>>({})
  const [filteredPlanning, setFilteredPlanning] = useState<Record<string, JourPlanningCandidat[]>>({})
  const [selectedSecteurs, setSelectedSecteurs] = useState<string[]>(["Étages"])
  const [semaineEnCours, setSemaineEnCours] = useState(true)
  const [semaine, setSemaine] = useState(format(new Date(), "yyyy-MM-dd"))
  const [selectedSemaine, setSelectedSemaine] = useState("Toutes")
  const [candidat, setCandidat] = useState("")
  const [search, setSearch] = useState("")
  const [toutAfficher, setToutAfficher] = useState(false)
  const [dispo, setDispo] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [semainesDisponibles, setSemainesDisponibles] = useState<string[]>([])

  const [stats, setStats] = useState({
    "Non renseigné": 0,
    "Dispo": 0,
    "Non Dispo": 0,
    "Planifié": 0,
  })

  const applyFilters = (
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

      if (joursFiltres.length > 0) {
        newFiltered[candidatNom] = joursFiltres
      }
    })

    setFilteredPlanning(newFiltered)

    let nr = 0, d = 0, nd = 0, p = 0

    Object.values(newFiltered).forEach((jours) =>
      jours.forEach((j) => {
        if (j.commande) {
          p++
        } else {
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
  }

  const fetchPlanning = async () => {
    try {
      // Récupérer toutes les données sans restriction de date
      const { data: commandesData, error: commandesError } = await supabase
        .from("commandes")
        .select(`
          *,
          client:client_id ( nom ),
          candidat:candidat_id ( nom, prenom )
        `)

      const { data: dispoData, error: dispoError } = await supabase
        .from("disponibilites")
        .select(`
          *,
          candidats:candidat_id ( nom, prenom )
        `)

      if (commandesError || dispoError) {
        console.error("Erreurs:", commandesError || dispoError)
        return
      }

      const map: Record<string, JourPlanningCandidat[]> = {}
      const semainesAvecDonnees = new Set<string>()
      const currentWeek = getWeek(new Date(), { weekStartsOn: 1 }).toString()

      const candidatsSet = new Set([
        ...((commandesData ?? []).map((c) => c.candidat_id).filter(Boolean) as string[]),
        ...((dispoData ?? []).map((d) => d.candidat_id) as string[]),
      ])

      for (const candidatId of candidatsSet) {
        const candidatNom =
          dispoData?.find((d) => d.candidat_id === candidatId)?.candidats?.nom ||
          commandesData?.find((c) => c.candidat_id === candidatId)?.candidat?.nom ||
          "Candidat inconnu"

        const jours: JourPlanningCandidat[] = []

        // On traite toutes les commandes et disponibilités pour ce candidat
        const commandesCandidat = commandesData?.filter(c => c.candidat_id === candidatId) || []
        const dispoCandidat = dispoData?.filter(d => d.candidat_id === candidatId) || []

        // Fusionner les dates uniques
        const datesUniques = Array.from(new Set([
          ...commandesCandidat.map(c => c.date),
          ...dispoCandidat.map(d => d.date)
        ]))

        for (const dateStr of datesUniques) {
          const commandesJour = commandesCandidat.filter(c => c.date === dateStr)
          const dispoJour = dispoCandidat.find(d => d.date === dateStr)

          let principale: CommandeFull | undefined
          const secondaires: CommandeFull[] = []

          commandesJour.forEach((c) => {
            const cFull: CommandeFull = {
              ...c,
              statut: c.statut as StatutCommande,
              client: c.client ? { nom: c.client.nom } : undefined,
              candidat: c.candidat
                ? { nom: c.candidat.nom, prenom: c.candidat.prenom }
                : undefined,
            }
            if (!principale) {
              principale = cFull
            } else if (
              principale.client?.nom &&
              cFull.client?.nom &&
              principale.client.nom !== cFull.client.nom
            ) {
              secondaires.push(cFull)
            }
          })

          if (principale && principale.statut === "Validé") {
            jours.push({
              date: dateStr,
              secteur: principale.secteur,
              service: principale.service,
              commande: principale,
              autresCommandes: secondaires,
            })
          } else if (
            principale &&
            ["Annule Int", "Annule Client", "Annule ADA", "Absence", "Non pourvue"].includes(
              principale.statut
            )
          ) {
            if (dispoJour) {
              jours.push({
                date: dateStr,
                secteur: dispoJour.secteur,
                service: dispoJour.service,
                disponibilite: {
                  id: dispoJour.id,
                  date: dispoJour.date,
                  secteur: dispoJour.secteur,
                  statut: dispoJour.statut as "Dispo" | "Non Dispo" | "Non Renseigné",
                  commentaire: dispoJour.commentaire,
                  candidat_id: dispoJour.candidat_id,
                  matin: dispoJour.dispo_matin ?? false,
                  soir: dispoJour.dispo_soir ?? false,
                  nuit: dispoJour.dispo_nuit ?? false,
                  created_at: dispoJour.created_at,
                  updated_at: dispoJour.updated_at,
                  candidat: dispoJour.candidats
                    ? { nom: dispoJour.candidats.nom, prenom: dispoJour.candidats.prenom }
                    : undefined,
                },
                autresCommandes: secondaires,
              })
            } else {
              jours.push({
                date: dateStr,
                secteur: principale.secteur,
                service: principale.service,
                commande: principale,
                autresCommandes: secondaires,
              })
            }
          } else if (dispoJour) {
            jours.push({
              date: dateStr,
              secteur: dispoJour.secteur,
              service: dispoJour.service,
              disponibilite: {
                id: dispoJour.id,
                date: dispoJour.date,
                secteur: dispoJour.secteur,
                statut: dispoJour.statut as "Dispo" | "Non Dispo" | "Non Renseigné",
                commentaire: dispoJour.commentaire,
                candidat_id: dispoJour.candidat_id,
                matin: dispoJour.dispo_matin ?? false,
                soir: dispoJour.dispo_soir ?? false,
                nuit: dispoJour.dispo_nuit ?? false,
                created_at: dispoJour.created_at,
                updated_at: dispoJour.updated_at,
                candidat: dispoJour.candidats
                  ? { nom: dispoJour.candidats.nom, prenom: dispoJour.candidats.prenom }
                  : undefined,
              },
              autresCommandes: secondaires,
            })
          } else {
            jours.push({
              date: dateStr,
              secteur: "Inconnu",
              autresCommandes: secondaires,
            })
          }

          // Ajouter la semaine aux semaines disponibles
          const semaine = getWeek(parseISO(dateStr), { weekStartsOn: 1 }).toString()
          semainesAvecDonnees.add(semaine)
        }

        if (jours.length > 0) {
          map[candidatNom] = jours
        }
      }

      setPlanning(map)

      // Trier les semaines par ordre décroissant
      const semainesTriees = Array.from(semainesAvecDonnees)
        .sort((a, b) => parseInt(b) - parseInt(a))

      setSemainesDisponibles(semainesTriees)

      // Si semaine en cours est cochée, forcer la semaine actuelle
      if (semaineEnCours) {
        setSelectedSemaine(currentWeek)
      } else if (!semainesTriees.includes(selectedSemaine) && selectedSemaine !== "Toutes") {
        setSelectedSemaine("Toutes")
      }

      applyFilters(
        map,
        selectedSecteurs,
        semaineEnCours ? currentWeek : selectedSemaine,
        candidat,
        dispo,
        search,
        toutAfficher
      )
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchPlanning()
  }, [refreshTrigger])

  useEffect(() => {
    applyFilters(planning, selectedSecteurs, selectedSemaine, candidat, dispo, search, toutAfficher)
  }, [planning, selectedSecteurs, selectedSemaine, candidat, search, dispo, toutAfficher])

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

  const candidatsDisponibles = Object.keys(planning)

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
        setRefreshTrigger={setRefreshTrigger}
      />
      <PlanningCandidateTable
        planning={filteredPlanning}
        selectedSecteurs={selectedSecteurs}
        selectedSemaine={selectedSemaine}
        onRefresh={fetchPlanning}
      />
    </MainLayout>
  )
}