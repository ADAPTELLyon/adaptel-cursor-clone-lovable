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
  format,
} from "date-fns"
import { fr } from "date-fns/locale"

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
  return raw ?? "inconnu"
}

/** Mappe un libellé de statut archive vers nos clés internes */
function canonStatut(raw?: string | null): string {
  const n = norm(raw)
  if (n.startsWith("valide")) return "Validé"
  if (n === "en recherche") return "En recherche"
  if (n.startsWith("non pourvue")) return "Non pourvue"
  if (n === "annule client") return "Annule Client"
  if (n === "annule int") return "Annule Int"
  if (n === "annule ada") return "Annule ADA"
  if (n === "absence") return "Absence"
  if (n.startsWith("demande")) return "Demandées"
  return raw ?? ""
}

/** True si (year, week) est AVANT la bascule (= archives) */
function isLegacyWeek(year: number, week: number) {
  return (
    year < SWITCH_WEEK.year ||
    (year === SWITCH_WEEK.year && week < SWITCH_WEEK.week)
  )
}

/** Jour (texte FR) stable depuis une date YYYY-MM-DD sans effet fuseau */
function dayKeyFromDate(dateStr: string) {
  // on colle T12:00:00 pour éviter tout décalage UTC/local
  const d = parseISO(`${dateStr}T12:00:00`)
  return norm(format(d, "eeee", { locale: fr })) // "lundi", "mardi", ...
}

type StatsState = {
  // Cartes statuts
  statsByStatus: Record<string, number>
  // Cartes “Total missions semaine” (N et N-1)
  missionsSemaine: number
  missionsSemaineN1: number
  // Graph “validées par jour” (N et N-1)
  missionsByDay: { day: string; missions: number; missionsN1: number }[]
  // Comparatif secteur (N et N-1)
  repartitionSecteurs: { secteur: string; missions: number; missionsN1: number }[]
  // Rang sur l’année (facultatif, inchangé)
  positionSemaine: number
  // Top clients (inchangé)
  topClients: { name: string; missions: number }[]
  // Temps de traitement (inchangé)
  tempsTraitementMoyen: string
  // Métriques mois (inchangées pour l’instant)
  missionsMois: number
  missionsMoisN1: number
  positionMois: number
  isLoading: boolean
}

/**
 * Hook des stats “semaine”.
 * - selectedWeek : numéro de SEMAINE ISO (sinon semaine courante).
 * - Avant S33/2025 => toutes les données via tables d’archives.
 * - À partir de S33/2025 => N via “commandes” ; N-1 via tables d’archives.
 * - Règles demandées :
 *   • Demandées = Validé + En recherche + Non pourvue
 *   • Comparatif secteur = nombre de Validé par secteur (N) et via donnees_secteur_semaine (N-1)
 *   • Répartition secteur = même base que comparatif (le composant peut faire le %)
 *   • Total missions semaine = Validé (N) ; N-1 = somme des total_valides des archives
 *   • Statuts annexes (Annule*, Absence) = compte direct sur “commandes” (N)
 *   • Graph jours = Validé par jour (N) ; N-1 via donnees_jour_semaine
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

        const weekNumber = selectedWeek ?? getWeek(today, { weekStartsOn: 1 })
        const legacy = isLegacyWeek(currentYear, weekNumber)

        // ==========================
        // ========= ARCHIVES =======
        // ==========================
        if (legacy) {
          // Stats par statut (Demandées/Validé/En recherche/Non pourvue/Annule*/Absence)
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

          // Comparatif secteurs (N et N-1) → total_valides
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

          // Jours (N et N-1) via archives : total_valides
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
            const k = norm(j?.jour)
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

          // Position (rang) parmi les semaines Validé de l’année courante (archives)
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

          const missionsSemaine = totalValidArchive
          const missionsSemaineN1 = repartitionSecteursArray.reduce((acc, s) => acc + s.missionsN1, 0)

          setStats({
            statsByStatus: {
              // Demandées “archives” si fournie, sinon fallback = Validé + En recherche + Non pourvue
              Demandées:
                statsMap["Demandées"] ??
                ((statsMap["Validé"] ?? 0) +
                  (statsMap["En recherche"] ?? 0) +
                  (statsMap["Non pourvue"] ?? 0)),
              Validé: statsMap["Validé"] ?? 0,
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
        // ========= LIVE =======
        // ======================

        // Lundi ISO de la semaine 1 (semaine du 4 janv)
        const yearN = currentYear
        const week1Monday = startOfWeek(new Date(yearN, 0, 4), { weekStartsOn: 1 })
        const weekStartDate = addDays(week1Monday, (weekNumber - 1) * 7)
        const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 })

        // bornes “date” en YYYY-MM-DD (la colonne est typée date)
        const weekStartStr = format(weekStartDate, "yyyy-MM-dd")
        const weekEndStr = format(weekEndDate, "yyyy-MM-dd")

        // Commandes de la semaine sélectionnée (N)
        const { data: commandes } = await supabase
          .from("commandes")
          .select("id, statut, secteur, date, clients (nom)")
          .gte("date", weekStartStr)
          .lte("date", weekEndStr)

        // Compteurs
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

          // Compteurs statut
          if (st === "Validé") totalValid++
          else if (st === "En recherche") totalRecherche++
          else if (st === "Non pourvue") totalNonPourvue++
          else if (st === "Annule Client") annuleClient++
          else if (st === "Annule Int") annuleInt++
          else if (st === "Annule ADA") annuleAda++
          else if (st === "Absence") absence++

          // Demandées = Validé + En recherche + Non pourvue
          if (st === "Validé" || st === "En recherche" || st === "Non pourvue") {
            totalDemandees++
          }

          // Par jour / par secteur / top clients : uniquement “Validé”
          if (st === "Validé") {
            const dayKey = dayKeyFromDate(String(cmd.date))
            missionsByDay[dayKey] = (missionsByDay[dayKey] ?? 0) + 1

            const clientName = cmd.clients?.nom ?? "Inconnu"
            topClientsCount[clientName] = (topClientsCount[clientName] ?? 0) + 1

            const key = canonSecteurKey(cmd.secteur)
            repartitionSecteursCount[key] = (repartitionSecteursCount[key] ?? 0) + 1
          }
        })

        // N-1 (même semaine) via archives (donnees_secteur_semaine)
        const { data: secteursN1 } = await supabase
          .from("donnees_secteur_semaine")
          .select("secteur,total_valides")
          .eq("annee", yearN - 1)
          .eq("semaine", weekNumber)

        const n1Map: Record<string, number> = {}
        ;(secteursN1 ?? []).forEach((s: any) => {
          const key = canonSecteurKey(s?.secteur)
          n1Map[key] = (n1Map[key] ?? 0) + (Number(s?.total_valides) || 0)
        })

        const repartitionSecteursArray = CANON_SECTEURS.map((secteur) => ({
          secteur,
          missions: repartitionSecteursCount[secteur] ?? 0, // N (live)
          missionsN1: n1Map[secteur] ?? 0,                  // N-1 (archives)
        }))

        const missionsSemaineN1 = repartitionSecteursArray.reduce(
          (sum, s) => sum + s.missionsN1,
          0
        )

        // Position (rang) parmi les semaines de l’année courante (archives, colonne "Validé")
        const { data: posData } = await supabase
          .from("donnees_statut_semaine")
          .select("semaine,total,statut")
          .eq("annee", yearN)

        const allWeeksValid = (posData ?? [])
          .filter((r: any) => canonStatut(r?.statut) === "Validé")
          .map((r: any) => Number(r?.total) || 0)

        const sorted = [...allWeeksValid, totalValid].sort((a, b) => b - a)
        const positionSemaine = sorted.findIndex((v) => v === totalValid) + 1

        // Jours N-1 (archives)
        const { data: joursN1 } = await supabase
          .from("donnees_jour_semaine")
          .select("jour,total_valides")
          .eq("annee", yearN - 1)
          .eq("semaine", weekNumber)

        const n1Days: Record<string, number> = {}
        ;(joursN1 ?? []).forEach((j: any) => {
          const k = norm(j?.jour)
          n1Days[k] = (n1Days[k] ?? 0) + (Number(j?.total_valides) || 0)
        })

        const orderedDays = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"]
        const missionsByDayArray = orderedDays.map((day) => ({
          day,
          missions: missionsByDay[day] ?? 0, // N (live)
          missionsN1: n1Days[day] ?? 0,      // N-1 (archives)
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

        // Sortie finale alignée avec tes règles
        setStats({
          statsByStatus: {
            Demandées: totalDemandees,      // = Validé + En recherche + Non pourvue
            Validé: totalValid,
            "En recherche": totalRecherche,
            "Non pourvue": totalNonPourvue,
            "Annule Client": annuleClient,
            "Annule Int": annuleInt,
            "Annule ADA": annuleAda,
            Absence: absence,
          },
          missionsSemaine: totalValid,       // = card “Total missions semaine”
          missionsSemaineN1,                 // somme secteurs N-1 (archives)
          missionsByDay: missionsByDayArray, // graph jours (N live / N-1 archives)
          repartitionSecteurs: repartitionSecteursArray, // comparatif secteurs (N / N-1)
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
