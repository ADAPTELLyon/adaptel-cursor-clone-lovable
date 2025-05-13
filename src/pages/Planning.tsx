import { useEffect, useState } from "react"
import MainLayout from "@/components/main-layout"
import { SectionFixeCandidates } from "@/components/Planning/section-fixe-candidates"
import { PlanningCandidateTable } from "@/components/Planning/PlanningCandidateTable"
import { getPlanningCandidats } from "@/integrations/supabase/planning"
import { addDays, format, startOfWeek, getWeek } from "date-fns"
import type { JourPlanningCandidat } from "@/types/types-front"

export default function Planning() {
  const [planning, setPlanning] = useState<Record<string, JourPlanningCandidat[]>>({})
  const [filteredPlanning, setFilteredPlanning] = useState<Record<string, JourPlanningCandidat[]>>({})
  const [selectedSecteurs, setSelectedSecteurs] = useState(["Étages"])
  const [semaineEnCours, setSemaineEnCours] = useState(true)
  const [semaine, setSemaine] = useState(format(new Date(), "yyyy-MM-dd"))
  const [selectedSemaine, setSelectedSemaine] = useState("Toutes")
  const [candidat, setCandidat] = useState("")
  const [search, setSearch] = useState("")
  const [toutAfficher, setToutAfficher] = useState(false)
  const [dispo, setDispo] = useState(false)

  const [stats, setStats] = useState({
    "Non renseigné": 0,
    "Dispo": 0,
    "Non Dispo": 0,
    "Planifié": 0,
  })

  const fetchPlanning = async () => {
    const data = await getPlanningCandidats()
    setPlanning(data)
    setFilteredPlanning(data)

    const semaines = Array.from(
      new Set(
        Object.values(data)
          .flat()
          .map((j) => getWeek(new Date(j.date), { weekStartsOn: 1 }).toString())
      )
    )
    if (semaineEnCours) {
      const current = getWeek(new Date(), { weekStartsOn: 1 }).toString()
      setSelectedSemaine(current)
    } else if (!semaines.includes(selectedSemaine)) {
      setSelectedSemaine("Toutes")
    }
  }

  useEffect(() => {
    fetchPlanning()
  }, [])

  useEffect(() => {
    const matchSearchTerm = (val: string) => {
      return search
        .trim()
        .toLowerCase()
        .split(" ")
        .every((term) => val.toLowerCase().includes(term))
    }

    const newFiltered: typeof planning = {}

    if (search.trim()) {
      Object.entries(planning).forEach(([candidatNom, jours]) => {
        const joursMatch = jours.filter((j) => {
          const dateStr = format(new Date(j.date), "dd/MM/yyyy")
          const semaineStr = getWeek(new Date(j.date), { weekStartsOn: 1 }).toString()
          return (
            matchSearchTerm(candidatNom) ||
            matchSearchTerm(j.secteur) ||
            (j.service && matchSearchTerm(j.service)) ||
            matchSearchTerm(semaineStr) ||
            matchSearchTerm(dateStr) ||
            (j.disponibilite?.statut && matchSearchTerm(j.disponibilite.statut))
          )
        })
        if (joursMatch.length > 0) {
          newFiltered[candidatNom] = joursMatch
        }
      })
      setFilteredPlanning(newFiltered)
      return
    }

    Object.entries(planning).forEach(([candidatNom, jours]) => {
      const joursFiltres = jours.filter((j) => {
        const semaineDuJour = getWeek(new Date(j.date), { weekStartsOn: 1 })
        const matchSecteur = selectedSecteurs.includes(j.secteur)
        const matchCandidat = candidat ? candidatNom === candidat : true
        const matchDispo = dispo ? j.disponibilite?.statut === "Dispo" : true
        const matchSemaine =
          selectedSemaine === "Toutes" || selectedSemaine === semaineDuJour.toString()
        return matchSecteur && matchCandidat && matchDispo && matchSemaine
      })
      if (joursFiltres.length > 0) {
        newFiltered[candidatNom] = joursFiltres
      }
    })

    setFilteredPlanning(newFiltered)

    let nr = 0,
      d = 0,
      nd = 0,
      p = 0

    Object.values(newFiltered).forEach((jours) =>
      jours.forEach((j) => {
        const s = j.disponibilite?.statut || "Non renseigné"
        if (s === "Dispo") d++
        else if (s === "Non Dispo") nd++
        else nr++
      })
    )

    setStats({
      "Non renseigné": nr,
      "Dispo": d,
      "Non Dispo": nd,
      "Planifié": p,
    })
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

  const semainesDisponibles = Array.from(
    new Set(
      Object.values(planning)
        .flat()
        .map((j) => getWeek(new Date(j.date), { weekStartsOn: 1 }).toString())
    )
  ).sort((a, b) => parseInt(a) - parseInt(b))

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
