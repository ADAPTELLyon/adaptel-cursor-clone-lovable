import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getMonth,
  getYear,
  startOfMonth,
  endOfMonth,
  parseISO,
  differenceInMinutes,
} from "date-fns";
import { DashboardStats } from "../types/types-front";

export function useStatsDashboardMonth(): DashboardStats {
  const [stats, setStats] = useState<DashboardStats>({
    statsByStatus: {},
    repartitionSecteurs: [],
    missionsByDay: [],
    topClients: [],
    tempsTraitementMoyen: "-",
    missionsSemaine: 0,
    missionsSemaineN1: 0,
    positionSemaine: 0,
    missionsMois: 0,
    missionsMoisN1: 0,
    positionMois: 0,
    isLoading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      setStats((s) => ({ ...s, isLoading: true }));
      try {
        const today = new Date();
        const currentMonth = getMonth(today) + 1; // JS 0-based
        const currentYear = getYear(today);
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);

        // données du mois en cours
        const { data: commandes } = await supabase
          .from("commandes")
          .select("id, statut, secteur, date, clients (nom)")
          .gte("date", monthStart.toISOString())
          .lte("date", monthEnd.toISOString());

        let totalValid = 0;
        let totalRecherche = 0;
        let totalNonPourvue = 0;
        let totalDemandees = 0;
        let annuleClient = 0;
        let annuleInt = 0;
        let annuleAda = 0;
        let absence = 0;

        const missionsByDay: Record<string, number> = {};
        const repartitionSecteurs: Record<string, number> = {};
        const topClientsCount: Record<string, number> = {};

        const commandeIdsValid = commandes?.filter(c => c.statut === "Validé").map(c => c.id) ?? [];

        commandes?.forEach((cmd) => {
          if (cmd.statut === "Validé") totalValid++;
          if (cmd.statut === "En recherche") totalRecherche++;
          if (cmd.statut === "Non pourvue") totalNonPourvue++;
          if (cmd.statut === "Annule Client") annuleClient++;
          if (cmd.statut === "Annule Int") annuleInt++;
          if (cmd.statut === "Annule ADA") annuleAda++;
          if (cmd.statut === "Absence") absence++;

          if (["Validé", "En recherche", "Non pourvue"].includes(cmd.statut)) {
            totalDemandees++;
          }

          if (cmd.statut === "Validé") {
            const day = new Date(cmd.date).toLocaleDateString("fr-FR", {
              weekday: "long",
            }).toLowerCase();
            missionsByDay[day] = (missionsByDay[day] ?? 0) + 1;

            const clientName = cmd.clients?.nom ?? "Inconnu";
            topClientsCount[clientName] = (topClientsCount[clientName] ?? 0) + 1;

            const secteurKey = cmd.secteur?.toLowerCase() ?? "inconnu";
            repartitionSecteurs[secteurKey] = (repartitionSecteurs[secteurKey] ?? 0) + 1;
          }
        });

        // données mois N-1
        const { data: moisN1 } = await supabase
          .from("donnees_mois")
          .select("*")
          .eq("annee", currentYear - 1)
          .eq("mois", currentMonth)
          .single();

        const repartitionSecteursArray = ["étages","cuisine","salle","plonge","réception"].map((secteur) => ({
          secteur,
          missions: repartitionSecteurs[secteur] ?? 0,
          missionsN1: moisN1?.repartition?.[secteur] ?? 0,
        }));

        const orderedDays = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
        const missionsByDayArray = orderedDays.map((day) => ({
          day,
          missions: missionsByDay[day] ?? 0,
          missionsN1: moisN1?.repartition_jours?.[day] ?? 0,
        }));

        const missionsMoisN1 = moisN1?.total_valides ?? 0;

        // calcul position
        const { data: posData } = await supabase
          .from("donnees_mois")
          .select("mois,total_valides")
          .eq("annee", currentYear);

        const allMonths = posData?.map((m) => m.total_valides ?? 0) ?? [];

        // corrige position : s'il n'y a qu'un seul mois connu, c'est rang 1
        const filtered = allMonths.filter(v => v > 0);
        const sorted = [...filtered, totalValid].sort((a, b) => b - a);
        const positionMois = sorted.findIndex((v) => v === totalValid) + 1;

        const topClients = Object.entries(topClientsCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, missions]) => ({ name, missions }));

        let totalMinutes = 0;
        let nbValid = 0;

        if (commandeIdsValid.length) {
          const { data: historique } = await supabase
            .from("historique")
            .select("ligne_id, action, date_action")
            .in("ligne_id", commandeIdsValid);

          commandeIdsValid.forEach((id) => {
            const creation = historique?.find(
              (h) => h.ligne_id === id && h.action === "creation"
            );
            const planif = historique?.find(
              (h) => h.ligne_id === id && h.action === "planification"
            );
            if (creation && planif) {
              const d1 = parseISO(creation.date_action);
              const d2 = parseISO(planif.date_action);
              const diffMin = differenceInMinutes(d2, d1);
              if (diffMin >= 0) {
                totalMinutes += diffMin;
                nbValid++;
              }
            }
          });
        }

        let tempsMoyen = "-";
        if (nbValid > 0) {
          const avgMin = Math.round(totalMinutes / nbValid);
          const jours = Math.floor(avgMin / 1440);
          const heures = Math.floor((avgMin % 1440) / 60);
          const minutes = avgMin % 60;
          if (jours > 0) {
            tempsMoyen = `${jours}j ${heures}h${minutes > 0 ? ` ${minutes}min` : ""}`;
          } else {
            tempsMoyen = `${heures}h${minutes > 0 ? ` ${minutes}min` : ""}`;
          }
        }

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
          repartitionSecteurs: repartitionSecteursArray,
          missionsByDay: missionsByDayArray,
          missionsMois: totalValid,
          missionsMoisN1,
          positionMois,
          topClients,
          tempsTraitementMoyen: tempsMoyen,
          missionsSemaine: 0,
          missionsSemaineN1: 0,
          positionSemaine: 0,
          isLoading: false,
        });
      } catch (e) {
        console.error("❌ Erreur useStatsDashboardMonth", e);
        setStats((s) => ({ ...s, isLoading: false }));
      }
    };

    fetchStats();
  }, []);

  return stats;
}
