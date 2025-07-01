import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getWeek, getYear, startOfWeek, endOfWeek, parseISO, differenceInHours } from "date-fns"

type DashboardStats = {
  statsByStatus: Record<string, number>
  missionsSemaine: number
  missionsSemaineN1: number
  missionsByDay: { day: string; missions: number; missionsN1: number }[]
  repartitionSecteurs: { secteur: string; missions: number; missionsN1: number }[]
  positionSemaine: number
  topClients: { name: string; missions: number }[]
  tempsTraitementMoyen: string
  isLoading: boolean
}

export function useStatsDashboard(): DashboardStats {
  const [stats, setStats] = useState<DashboardStats>({
    statsByStatus: {},
    missionsSemaine: 0,
    missionsSemaineN1: 0,
    missionsByDay: [],
    repartitionSecteurs: [],
    positionSemaine: 0,
    topClients: [],
    tempsTraitementMoyen: "-",
    isLoading: true,
  })

  useEffect(() => {
    const fetchStats = async () => {
      setStats((s) => ({ ...s, isLoading: true }))
      try {
        const today = new Date()
        const currentWeek = getWeek(today, { weekStartsOn: 1 })
        const currentYear = getYear(today)
        const weekStart = startOfWeek(today, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 })

        const { data: commandes } = await supabase
          .from("commandes")
          .select("id, statut, secteur, date, clients (nom)")
          .gte("date", weekStart.toISOString())
          .lte("date", weekEnd.toISOString())

        let totalValid = 0
        let totalRecherche = 0
        let totalNonPourvue = 0
        let totalDemandees = 0
        let annuleClient = 0
        let annuleInt = 0
        let annuleAda = 0
        let absence = 0

        const missionsByDay: Record<string, number> = {}
        const repartitionSecteurs: Record<string, number> = {}
        const topClientsCount: Record<string, number> = {}

        const commandeIdsValid = commandes?.filter(c => c.statut === "Validé").map(c => c.id) ?? []

        commandes?.forEach((cmd) => {
          if (cmd.statut === "Validé") totalValid++
          if (cmd.statut === "En recherche") totalRecherche++
          if (cmd.statut === "Non pourvue") totalNonPourvue++
          if (cmd.statut === "Annule Client") annuleClient++
          if (cmd.statut === "Annule Int") annuleInt++
          if (cmd.statut === "Annule ADA") annuleAda++
          if (cmd.statut === "Absence") absence++

          if (["Validé", "En recherche", "Non pourvue"].includes(cmd.statut)) {
            totalDemandees++
          }

          if (cmd.statut === "Validé") {
            const day = new Date(cmd.date).toLocaleDateString("fr-FR", { weekday: "long" }).toLowerCase()
            missionsByDay[day] = (missionsByDay[day] ?? 0) + 1

            const clientName = cmd.clients?.nom ?? "Inconnu"
            topClientsCount[clientName] = (topClientsCount[clientName] ?? 0) + 1

            const secteurKey = cmd.secteur?.toLowerCase() ?? "inconnu"
            repartitionSecteurs[secteurKey] = (repartitionSecteurs[secteurKey] ?? 0) + 1
          }
        })

        const { data: secteursN1 } = await supabase
          .from("donnees_secteur_semaine")
          .select("secteur,total_valides")
          .eq("annee", currentYear - 1)
          .eq("semaine", currentWeek)

        const secteurs = ["étages", "cuisine", "salle", "plonge", "réception"]
        const repartitionSecteursArray = secteurs.map((secteur) => ({
          secteur,
          missions: repartitionSecteurs[secteur] ?? 0,
          missionsN1: secteursN1?.find(
            (s) =>
              s.secteur.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "") ===
              secteur.normalize("NFD").replace(/\p{Diacritic}/gu, "")
          )?.total_valides ?? 0,
        }))

        const missionsSemaineN1 = repartitionSecteursArray.reduce((sum, s) => sum + s.missionsN1, 0)

        const { data: posData } = await supabase
          .from("donnees_statut_semaine")
          .select("semaine,total")
          .eq("annee", currentYear)
          .eq("statut", "Validé")

        const allWeeks = posData?.map((r) => r.total) ?? []
        const sorted = [...allWeeks, totalValid].sort((a, b) => b - a)
        const positionSemaine = sorted.findIndex((v) => v === totalValid) + 1

        const { data: joursN1 } = await supabase
          .from("donnees_jour_semaine")
          .select("jour,total_valides")
          .eq("annee", currentYear - 1)
          .eq("semaine", currentWeek)

        const orderedDays = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"]
        const missionsByDayArray = orderedDays.map((day) => ({
          day,
          missions: missionsByDay[day] ?? 0,
          missionsN1: joursN1?.find((j) => j.jour.toLowerCase() === day)?.total_valides ?? 0,
        }))

        const topClients = Object.entries(topClientsCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, missions]) => ({
            name,
            missions,
          }))
// 7️⃣ temps de traitement basé sur historique (action)
let totalHeures = 0
let nbValid = 0

if (commandeIdsValid.length) {
  const { data: historique } = await supabase
    .from("historique")
    .select("ligne_id, action, date_action")
    .in("ligne_id", commandeIdsValid)

  commandeIdsValid.forEach((id) => {
    const creation = historique?.find(
      (h) => h.ligne_id === id && h.action === "creation"
    )
    const planification = historique?.find(
      (h) => h.ligne_id === id && h.action === "planification"
    )
    if (creation && planification) {
      const d1 = parseISO(creation.date_action)
      const d2 = parseISO(planification.date_action)
      const diffH = differenceInHours(d2, d1)
      if (diffH >= 0) {
        totalHeures += diffH
        nbValid++
      }
    }
  })
}

const tempsMoyen = nbValid > 0 ? Math.round(totalHeures / nbValid) : null

        setStats({
          statsByStatus: {
            "Demandées": totalDemandees,
            "Validé": totalValid,
            "En recherche": totalRecherche,
            "Non pourvue": totalNonPourvue,
            "Annule Client": annuleClient,
            "Annule Int": annuleInt,
            "Annule ADA": annuleAda,
            "Absence": absence,
          },
          missionsSemaine: totalValid,
          missionsSemaineN1,
          missionsByDay: missionsByDayArray,
          repartitionSecteurs: repartitionSecteursArray,
          positionSemaine,
          topClients,
          tempsTraitementMoyen: tempsMoyen !== null ? `${tempsMoyen}h` : "-",
          isLoading: false,
        })
      } catch (e) {
        console.error("❌ Erreur useStatsDashboard", e)
        setStats((s) => ({ ...s, isLoading: false }))
      }
    }
    fetchStats()
  }, [])

  return stats
}
