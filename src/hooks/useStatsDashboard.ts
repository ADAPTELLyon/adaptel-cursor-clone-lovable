import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  getWeek,
  getYear,
  startOfWeek,
  endOfWeek,
  parseISO,
  differenceInMinutes,
  addDays,
} from "date-fns"

// ===== Borne de bascule : avant S33-2025 -> archives ; à partir de S33-2025 -> live (commandes / historique)
const SWITCH_WEEK = { year: 2025, week: 33 } as const

/** Normalise une chaîne: trim + minuscules + sans accents (pour matcher “Etages”/“Étages”/“étages”). */
function norm(s?: string | null) {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

/** Canonise un secteur dans notre liste standard (ordre et clés “officielles”). */
const CANON_SECTEURS = ["étages", "cuisine", "salle", "plonge", "réception"] as const
type CanonSecteur = typeof CANON_SECTEURS[number]

function canonSecteurKey(raw?: string | null): CanonSecteur | string {
  const n = norm(raw)
  if (n === "etages") return "étages"
  if (n === "cuisine") return "cuisine"
  if (n === "salle") return "salle"
  if (n === "plonge") return "plonge"
  if (n === "reception") return "réception"
  // inconnu: on renvoie la version normalisée brute (affiché à 0 si non mappé)
  return raw ?? "inconnu"
}

/** Mappe un libellé de statut archive vers nos clés internes */
function canonStatut(raw?: string | null): string {
  const n = norm(raw)
  if (n.startsWith("valide")) return "Validé"                // "Validé", "Validées"
  if (n === "en recherche") return "En recherche"
  if (n.startsWith("non pourvue")) return "Non pourvue"      // "Non pourvue", "Non pourvues"
  if (n === "annule client") return "Annule Client"
  if (n === "annule int") return "Annule Int"
  if (n === "annule ada") return "Annule ADA"
  if (n === "absence") return "Absence"
  if (n.startsWith("demande")) return "Demandées"            // "Demandée(s)"
  return raw ?? ""
}

/** True si (year, week) est AVANT la bascule (= archives) */
function isLegacyWeek(year: number, week: number) {
  return (
    year < SWITCH_WEEK.year ||
    (year === SWITCH_WEEK.year && week < SWITCH_WEEK.week)
  )
}

type StatsState = {
  statsByStatus: Record<string, number>
  missionsSemaine: number
  missionsSemaineN1: number
  missionsByDay: { day: string; missions: number; missionsN1: number }[]
  repartitionSecteurs: { secteur: string; missions: number; missionsN1: number }[]
  positionSemaine: number
  topClients: { name: string; missions: number }[]
  tempsTraitementMoyen: string
  missionsMois: number
  missionsMoisN1: number
  positionMois: number
  isLoading: boolean
}

/**
 * Hook des stats “semaine”.
 * - `selectedWeek` : numéro de semaine à afficher (sinon semaine courante).
 * - N-1 = même numéro de semaine sur l’année précédente.
 * - Avant S33/2025 => tables d’archives (donnees_*_semaine).
 * - À partir de S33/2025 => live (commandes + historique) pour l’année en cours.
 */
export function useStatsDashboard(selectedWeek?: number) {
  const [stats, setStats] = useState<StatsState>({
    statsByStatus: {},
    missionsSemaine: 0,
    missionsSemaineN1: 0,
    missionsByDay: [],
    repartitionSecteurs: [],
    positionSemaine: 0,
    topClients: [],
    tempsTraitementMoyen: "-",
    missionsMois: 0,
    missionsMoisN1: 0,
    positionMois: 0,
    isLoading: true,
  })

  useEffect(() => {
    const fetchStats = async () => {
      setStats((s) => ({ ...s, isLoading: true }))
      try {
        const today = new Date()
        const currentYear = getYear(today)

        // Semaine cible (sélectionnée ou semaine courante)
        const weekNumber = selectedWeek ?? getWeek(today, { weekStartsOn: 1 })
        const legacy = isLegacyWeek(currentYear, weekNumber)

        // ==========================
        // ====== MODE ARCHIVES =====
        // ==========================
        if (legacy) {
          // 1) Stats par statut
          const { data: statRows } = await supabase
            .from("donnees_statut_semaine")
            .select("statut,total")
            .eq("annee", currentYear)
            .eq("semaine", weekNumber)

          const statsMap: Record<string, number> = {}
          ;(statRows ?? []).forEach((r: any) => {
            const k = canonStatut(r?.statut)
            if (!k) return
            statsMap[k] = (statsMap[k] ?? 0) + (Number(r?.total) || 0)
          })

          // 2) Répartition secteurs (courant & N-1)
          const { data: secteursCur } = await supabase
            .from("donnees_secteur_semaine")
            .select("secteur,total_valides")
            .eq("annee", currentYear)
            .eq("semaine", weekNumber)

          const { data: secteursN1 } = await supabase
            .from("donnees_secteur_semaine")
            .select("secteur,total_valides")
            .eq("annee", currentYear - 1)
            .eq("semaine", weekNumber)

          const curMap: Record<string, number> = {}
          ;(secteursCur ?? []).forEach((s: any) => {
            const key = canonSecteurKey(s?.secteur)
            curMap[key] = (curMap[key] ?? 0) + (Number(s?.total_valides) || 0)
          })

          const n1Map: Record<string, number> = {}
          ;(secteursN1 ?? []).forEach((s: any) => {
            const key = canonSecteurKey(s?.secteur)
            n1Map[key] = (n1Map[key] ?? 0) + (Number(s?.total_valides) || 0)
          })

          const repartitionSecteursArray = CANON_SECTEURS.map((secteur) => ({
            secteur,
            missions: curMap[secteur] ?? 0,
            missionsN1: n1Map[secteur] ?? 0,
          }))

          // 3) Missions par jour (courant & N-1)
          const { data: joursCur } = await supabase
            .from("donnees_jour_semaine")
            .select("jour,total_valides")
            .eq("annee", currentYear)
            .eq("semaine", weekNumber)

          const { data: joursN1 } = await supabase
            .from("donnees_jour_semaine")
            .select("jour,total_valides")
            .eq("annee", currentYear - 1)
            .eq("semaine", weekNumber)

          const curDays: Record<string, number> = {}
          ;(joursCur ?? []).forEach((j: any) => {
            const k = norm(j?.jour) // “Lundi”/“lundi” → “lundi”
            curDays[k] = (curDays[k] ?? 0) + (Number(j?.total_valides) || 0)
          })

          const n1Days: Record<string, number> = {}
          ;(joursN1 ?? []).forEach((j: any) => {
            const k = norm(j?.jour)
            n1Days[k] = (n1Days[k] ?? 0) + (Number(j?.total_valides) || 0)
          })

          const orderedDays = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"]
          const missionsByDayArray = orderedDays.map((day) => ({
            day,
            missions: curDays[day] ?? 0,
            missionsN1: n1Days[day] ?? 0,
          }))

          // 4) Position (rang) parmi les semaines Validé de l’année courante
          const { data: posData } = await supabase
            .from("donnees_statut_semaine")
            .select("semaine,total,statut")
            .eq("annee", currentYear)
          const allWeeksValid = (posData ?? [])
            .filter((r: any) => canonStatut(r?.statut) === "Validé")
            .map((r: any) => Number(r?.total) || 0)
          const totalValidArchive = statsMap["Validé"] ?? 0
          const sorted = [...allWeeksValid, totalValidArchive].sort((a, b) => b - a)
          const positionSemaine = sorted.findIndex((v) => v === totalValidArchive) + 1

          // 5) Fallback si “Validé” manquant ou mal libellé dans les stats:
          // on prend la somme des secteurs comme total validé.
          const sumSecteurs = repartitionSecteursArray.reduce((acc, s) => acc + s.missions, 0)
          const missionsSemaine = totalValidArchive > 0 ? totalValidArchive : sumSecteurs
          const missionsSemaineN1 = repartitionSecteursArray.reduce((acc, s) => acc + s.missionsN1, 0)

          setStats({
            statsByStatus: {
              Demandées: statsMap["Demandées"] ?? (missionsSemaine + (statsMap["En recherche"] ?? 0) + (statsMap["Non pourvue"] ?? 0)),
              Validé: missionsSemaine, // valeur robuste
              "En recherche": statsMap["En recherche"] ?? 0,
              "Non pourvue": statsMap["Non pourvue"] ?? 0,
              "Annule Client": statsMap["Annule Client"] ?? 0,
              "Annule Int": statsMap["Annule Int"] ?? 0,
              "Annule ADA": statsMap["Annule ADA"] ?? 0,
              Absence: statsMap["Absence"] ?? 0,
            },
            missionsSemaine,
            missionsSemaineN1,
            missionsByDay: missionsByDayArray,
            repartitionSecteurs: repartitionSecteursArray,
            positionSemaine,
            topClients: [],            // pas dispo en archives
            tempsTraitementMoyen: "-", // pas calculable en archives
            missionsMois: 0,
            missionsMoisN1: 0,
            positionMois: 0,
            isLoading: false,
          })
          return
        }

        // ======================
        // ====== MODE LIVE =====
        // ======================

        // Lundi ISO de la semaine 1 (semaine du 4 janv)
        const week1Monday = startOfWeek(new Date(currentYear, 0, 4), { weekStartsOn: 1 })
        const weekStartDate = addDays(week1Monday, (weekNumber - 1) * 7)
        const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 })

        const { data: commandes } = await supabase
          .from("commandes")
          .select("id, statut, secteur, date, clients (nom)")
          .gte("date", weekStartDate.toISOString())
          .lte("date", weekEndDate.toISOString())

        let totalValid = 0
        let totalRecherche = 0
        let totalNonPourvue = 0
        let totalDemandees = 0
        let annuleClient = 0
        let annuleInt = 0
        let annuleAda = 0
        let absence = 0

        const missionsByDay: Record<string, number> = {}
        const repartitionSecteursCount: Record<string, number> = {}
        const topClientsCount: Record<string, number> = {}

        const commandeIdsValid =
          commandes?.filter((c) => c.statut === "Validé").map((c) => c.id) ?? []

          commandes?.forEach((cmd) => {
            const st = (cmd.statut || "").trim()
          
            // Compteurs par statut — on borne explicitement chaque cas
            if (st === "Validé") {
              totalValid++
            } else if (st === "En recherche") {
              totalRecherche++
            } else if (st === "Non pourvue") {
              totalNonPourvue++
            } else if (st === "Annule Client") {
              annuleClient++
            } else if (st === "Annule Int") {
              annuleInt++
            } else if (st === "Annule ADA") {
              annuleAda++
            } else if (st === "Absence") {
              absence++
            }
          
            // "Demandées" = Validé + En recherche + Non pourvue (exclusion explicite de toute annulation/absence)
            if (st === "Validé" || st === "En recherche" || st === "Non pourvue") {
              totalDemandees++
            }
          
            // Répartition secteurs + par jour uniquement pour les missions réellement "Validé"
            if (st === "Validé") {
              const day = norm(
                new Date(cmd.date).toLocaleDateString("fr-FR", { weekday: "long" })
              )
              missionsByDay[day] = (missionsByDay[day] ?? 0) + 1
          
              const clientName = cmd.clients?.nom ?? "Inconnu"
              topClientsCount[clientName] = (topClientsCount[clientName] ?? 0) + 1
          
              const key = canonSecteurKey(cmd.secteur)
              repartitionSecteursCount[key] = (repartitionSecteursCount[key] ?? 0) + 1
            }
          })
          

        // N-1 (même semaine) via archives
        const { data: secteursN1 } = await supabase
          .from("donnees_secteur_semaine")
          .select("secteur,total_valides")
          .eq("annee", currentYear - 1)
          .eq("semaine", weekNumber)

        const n1Map: Record<string, number> = {}
        ;(secteursN1 ?? []).forEach((s: any) => {
          const key = canonSecteurKey(s?.secteur)
          n1Map[key] = (n1Map[key] ?? 0) + (Number(s?.total_valides) || 0)
        })

        const repartitionSecteursArray = CANON_SECTEURS.map((secteur) => ({
          secteur,
          missions: repartitionSecteursCount[secteur] ?? 0,
          missionsN1: n1Map[secteur] ?? 0,
        }))

        const missionsSemaineN1 = repartitionSecteursArray.reduce(
          (sum, s) => sum + s.missionsN1,
          0
        )

        // Position (rang) parmi les semaines de l’année courante
        const { data: posData } = await supabase
          .from("donnees_statut_semaine")
          .select("semaine,total,statut")
          .eq("annee", currentYear)

        const allWeeksValid = (posData ?? [])
          .filter((r: any) => canonStatut(r?.statut) === "Validé")
          .map((r: any) => Number(r?.total) || 0)

        const sorted = [...allWeeksValid, totalValid].sort((a, b) => b - a)
        const positionSemaine = sorted.findIndex((v) => v === totalValid) + 1

        // Jours N-1
        const { data: joursN1 } = await supabase
          .from("donnees_jour_semaine")
          .select("jour,total_valides")
          .eq("annee", currentYear - 1)
          .eq("semaine", weekNumber)

        const n1Days: Record<string, number> = {}
        ;(joursN1 ?? []).forEach((j: any) => {
          const k = norm(j?.jour)
          n1Days[k] = (n1Days[k] ?? 0) + (Number(j?.total_valides) || 0)
        })

        const orderedDays = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"]
        const missionsByDayArray = orderedDays.map((day) => ({
          day,
          missions: missionsByDay[day] ?? 0,
          missionsN1: n1Days[day] ?? 0,
        }))

        // Temps de traitement (creation -> planification) sur les validées
        let totalMinutes = 0
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
            const planif = historique?.find(
              (h) => h.ligne_id === id && h.action === "planification"
            )
            if (creation && planif) {
              const d1 = parseISO(creation.date_action)
              const d2 = parseISO(planif.date_action)
              const diffMin = differenceInMinutes(d2, d1)
              if (diffMin >= 0) {
                totalMinutes += diffMin
                nbValid++
              }
            }
          })
        }

        let tempsMoyen = "-"
        if (nbValid > 0) {
          const avgMin = Math.round(totalMinutes / nbValid)
          const jours = Math.floor(avgMin / 1440)
          const heures = Math.floor((avgMin % 1440) / 60)
          const minutes = avgMin % 60
          tempsMoyen =
            jours > 0
              ? `${jours}j ${heures}h${minutes ? ` ${minutes}min` : ""}`
              : `${heures}h${minutes ? ` ${minutes}min` : ""}`
        }

        const topClients = Object.entries(topClientsCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, missions]) => ({ name, missions }))

        setStats({
          statsByStatus: {
            Demandées: totalDemandees,
            Validé: totalValid,
            "En recherche": totalRecherche,
            "Non pourvue": totalNonPourvue,
            "Annule Client": annuleClient,
            "Annule Int": annuleInt,
            "Annule ADA": annuleAda,
            Absence: absence,
          },
          missionsSemaine: totalValid,
          missionsSemaineN1,
          missionsByDay: missionsByDayArray,
          repartitionSecteurs: repartitionSecteursArray,
          positionSemaine,
          topClients,
          tempsTraitementMoyen: tempsMoyen,
          missionsMois: 0,
          missionsMoisN1: 0,
          positionMois: 0,
          isLoading: false,
        })
      } catch (e) {
        console.error("❌ Erreur useStatsDashboard (switch legacy/live)", e)
        setStats((s) => ({ ...s, isLoading: false }))
      }
    }

    fetchStats()
  }, [selectedWeek])

  return stats
}
