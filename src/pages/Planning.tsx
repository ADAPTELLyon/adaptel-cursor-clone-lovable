import { useEffect, useState } from "react"
import MainLayout from "@/components/main-layout"
import { SectionFixeCandidates } from "@/components/Planning/section-fixe-candidates"
import { PlanningCandidateTable } from "@/components/Planning/PlanningCandidateTable"
import { supabase } from "@/lib/supabase"
import { format, getWeek, startOfWeek, addDays } from "date-fns"
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

    const matchSearchTerm = (val: string) =>
      searchText
        .trim()
        .toLowerCase()
        .split(" ")
        .every((term) => val.toLowerCase().includes(term))

    Object.entries(rawPlanning).forEach(([candidatNom, jours]) => {
      const joursFiltres = jours.filter((j) => {
        const semaineDuJour = getWeek(new Date(j.date), { weekStartsOn: 1 })
        const matchSecteur = secteurs.includes(j.secteur)
        const matchCandidat = candidatSelect ? candidatNom === candidatSelect : true
        const matchDispo = dispoFilter ? j.disponibilite?.statut === "Dispo" : true
        const matchSemaine =
          semaineSelect === "Toutes" || semaineSelect === semaineDuJour.toString()
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

    let nr = 0,
      d = 0,
      nd = 0,
      p = 0

    Object.values(newFiltered).forEach((jours) =>
      jours.forEach((j) => {
        if (j.commande) {
          p++
        } else {
          const s = j.disponibilite?.statut || "Non Renseigné"
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
      const lundi = startOfWeek(
        semaineEnCours ? new Date() : new Date(semaine),
        { weekStartsOn: 1 }
      )
      const dimanche = addDays(lundi, 6)

      const { data: commandesData, error: commandesError } = await supabase
        .from("commandes")
        .select(`
          *,
          client:client_id ( nom ),
          candidat:candidat_id ( nom, prenom )
        `)
        .gte("date", lundi.toISOString().slice(0, 10))
        .lte("date", dimanche.toISOString().slice(0, 10))

      if (commandesError) {
        console.error("Erreur commandes:", commandesError)
        return
      }

      const { data: dispoData, error: dispoError } = await supabase
        .from("disponibilites")
        .select(`
          *,
          candidats:candidat_id ( nom, prenom )
        `)
        .gte("date", lundi.toISOString().slice(0, 10))
        .lte("date", dimanche.toISOString().slice(0, 10))

      if (dispoError) {
        console.error("Erreur disponibilites:", dispoError)
        return
      }

      const map: Record<string, JourPlanningCandidat[]> = {}

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

        for (let i = 0; i < 7; i++) {
          const jourDate = addDays(lundi, i).toISOString().slice(0, 10)

          const commandesJour = commandesData?.filter(
            (c) => c.candidat_id === candidatId && c.date === jourDate
          ) || []

          const dispo = dispoData?.find(
            (d) => d.candidat_id === candidatId && d.date === jourDate
          )

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
              date: jourDate,
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
            if (dispo) {
              jours.push({
                date: jourDate,
                secteur: dispo.secteur,
                service: dispo.service,
                disponibilite: {
                  id: dispo.id,
                  date: dispo.date,
                  secteur: dispo.secteur,
                  statut: dispo.statut as "Dispo" | "Non Dispo" | "Non Renseigné",
                  commentaire: dispo.commentaire,
                  candidat_id: dispo.candidat_id,
                  matin: dispo.dispo_matin ?? false,
                  soir: dispo.dispo_soir ?? false,
                  nuit: dispo.dispo_nuit ?? false,
                  created_at: dispo.created_at,
                  updated_at: dispo.updated_at,
                  candidat: dispo.candidats
                    ? { nom: dispo.candidats.nom, prenom: dispo.candidats.prenom }
                    : undefined,
                },
                autresCommandes: secondaires,
              })
            } else {
              jours.push({
                date: jourDate,
                secteur: principale.secteur,
                service: principale.service,
                commande: principale,
                autresCommandes: secondaires,
              })
            }
          } else if (dispo) {
            jours.push({
              date: jourDate,
              secteur: dispo.secteur,
              service: dispo.service,
              disponibilite: {
                id: dispo.id,
                date: dispo.date,
                secteur: dispo.secteur,
                statut: dispo.statut as "Dispo" | "Non Dispo" | "Non Renseigné",
                commentaire: dispo.commentaire,
                candidat_id: dispo.candidat_id,
                matin: dispo.dispo_matin ?? false,
                soir: dispo.dispo_soir ?? false,
                nuit: dispo.dispo_nuit ?? false,
                created_at: dispo.created_at,
                updated_at: dispo.updated_at,
                candidat: dispo.candidats
                  ? { nom: dispo.candidats.nom, prenom: dispo.candidats.prenom }
                  : undefined,
              },
              autresCommandes: secondaires,
            })
          } else {
            jours.push({
              date: jourDate,
              secteur: "Inconnu",
              autresCommandes: secondaires,
            })
          }
        }

        map[candidatNom] = jours
      }

      setPlanning(map)

      const semaines = Array.from(
        new Set(
          Object.values(map)
            .flat()
            .map((j) => getWeek(new Date(j.date), { weekStartsOn: 1 }).toString())
        )
      ).sort((a, b) => parseInt(a) - parseInt(b))

      setSemainesDisponibles(semaines)

      if (semaineEnCours) {
        const current = getWeek(new Date(), { weekStartsOn: 1 }).toString()
        setSelectedSemaine(current)
      } else if (!semaines.includes(selectedSemaine)) {
        setSelectedSemaine("Toutes")
      }

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
  }

  useEffect(() => {
    fetchPlanning()
  }, [refreshTrigger, semaine, semaineEnCours])

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
