// src/hooks/useStatsDashboardMonth.ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getMonth,
  getYear,
  startOfMonth,
  endOfMonth,
  parseISO,
  differenceInMinutes,
  startOfWeek,
  addDays,
  getWeek,
  isSameMonth,
  eachDayOfInterval,
} from "date-fns";
import { fr } from "date-fns/locale";
import { DashboardStats } from "../types/types-front";

/**
 * Bascule : avant 08/2025 on lit les tables d’archives (donnees_*),
 * à partir de 08/2025 on lit la table `commandes`.
 */
const SWITCH_MONTH = { year: 2025, month: 8 } as const;

/** Secteurs de référence (format interne en minuscules, avec accents) */
const SECTEURS_REF = ["étages", "cuisine", "salle", "plonge", "réception"] as const;

/** Ordre d’affichage des jours */
const DAYS_REF = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;

/** Normalise une clé texte (casse + accents) pour comparaison robuste */
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Map JSON → Record<string, number> (en filtrant tout ce qui n’est pas numérique) */
function toNumMap(json: any, keyTransform?: (k: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  if (json && typeof json === "object" && !Array.isArray(json)) {
    for (const [k, v] of Object.entries(json)) {
      const kk = keyTransform ? keyTransform(String(k)) : String(k);
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isNaN(n)) out[kk] = n;
    }
  }
  return out;
}

/** Convertit une clé secteur JSON ("Etages","Réception",...) → clé interne ("étages","réception",...) */
function normalizeSecteurKey(jsonKey: string): string {
  const nk = norm(jsonKey);
  const map: Record<string, string> = {
    etages: "étages",
    etage: "étages",
    cuisine: "cuisine",
    salle: "salle",
    plonge: "plonge",
    reception: "réception",
    'réception': "réception",
  };
  return map[nk] ?? jsonKey.toLowerCase();
}

/** Monday ISO (weekStartsOn:1) de la semaine 1 (ancre sur 4 janvier) */
function isoWeek1Monday(year: number) {
  return startOfWeek(new Date(year, 0, 4), { weekStartsOn: 1 });
}

/** Monday ISO de la semaine donnée */
function isoMondayOfWeek(year: number, week: number) {
  return addDays(isoWeek1Monday(year), (week - 1) * 7);
}

/** Offset d’un jour fr → 0..6, pour reconstituer la date d’un (annee,semaine,jour) */
function dayOffsetFR(day: string): number {
  const d = norm(day);
  const idx = DAYS_REF.findIndex((x) => norm(x) === d);
  return idx >= 0 ? idx : 0;
}

/** True si (year, month) est avant la bascule (donc archives) */
function isArchiveMonth(year: number, month: number) {
  return year < SWITCH_MONTH.year || (year === SWITCH_MONTH.year && month < SWITCH_MONTH.month);
}

/** Ensemble des semaines ISO qui intersectent le mois [monthStart, monthEnd] */
function weeksCoveringMonth(monthStart: Date, monthEnd: Date) {
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const set = new Set<number>();
  for (const d of days) {
    const w = getWeek(d, { weekStartsOn: 1 });
    set.add(w);
  }
  return Array.from(set.values()).sort((a, b) => a - b);
}

/** Nb de jours de la semaine ISO (year,week) qui tombent dans le mois (monthStart..monthEnd) */
function overlapDaysWithMonth(year: number, week: number, monthStart: Date, monthEnd: Date) {
  const monday = isoMondayOfWeek(year, week);
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    if (d >= monthStart && d <= monthEnd) count++;
  }
  return count; // 0..7
}

export function useStatsDashboardMonth(
  selectedMonth?: number,
  selectedYear?: number
): DashboardStats {
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
    const run = async () => {
      setStats((s) => ({ ...s, isLoading: true }));

      try {
        // --- cible (mois/année) ---
        const today = new Date();
        const y = selectedYear ?? getYear(today);
        const m = selectedMonth ?? getMonth(today) + 1; // 1..12
        const monthStart = startOfMonth(new Date(y, m - 1, 1));
        const monthEnd = endOfMonth(new Date(y, m - 1, 1));
        const archived = isArchiveMonth(y, m);

        // --- helpers pour N-1 ---
        const yN1 = y - 1;
        const monthStartN1 = startOfMonth(new Date(yN1, m - 1, 1));
        const monthEndN1 = endOfMonth(new Date(yN1, m - 1, 1));

        // ---------- A) Données du MOIS affiché ----------
        let current_tot_valid = 0;
        let current_tot_rech = 0;
        let current_tot_nonp = 0;
        let current_tot_dem = 0;
        let current_tot_ann_cli = 0;
        let current_tot_ann_int = 0;
        let current_tot_ann_ada = 0;
        let current_tot_abs = 0;

        let repartitionSecteursCurrent: Record<string, number> = {};
        let missionsByDayCurrent: Record<string, number> = {};

        let topClients: { name: string; missions: number }[] = [];
        let tempsTraitementMoyen = "-";

        if (!archived) {
          // --------- 1) Mode APP : calculs sur `commandes` ----------
          const { data: commandes } = await supabase
            .from("commandes")
            .select("id, statut, secteur, date, clients (nom)")
            .gte("date", monthStart.toISOString())
            .lte("date", monthEnd.toISOString());

          const validIds: string[] = [];
          const clientsCount: Record<string, number> = {};

          commandes?.forEach((c) => {
            const st = c.statut;
            if (st === "Validé") {
              current_tot_valid++;
              validIds.push(c.id as string);

              // répartition secteurs
              const k = normalizeSecteurKey(c.secteur ?? "inconnu");
              repartitionSecteursCurrent[k] = (repartitionSecteursCurrent[k] ?? 0) + 1;

              // par jour
              const dname = new Date(c.date)
                .toLocaleDateString("fr-FR", { weekday: "long", localeMatcher: "best fit" })
                .toLowerCase();
              missionsByDayCurrent[dname] = (missionsByDayCurrent[dname] ?? 0) + 1;

              // top clients
              const cn = c.clients?.nom ?? "Inconnu";
              clientsCount[cn] = (clientsCount[cn] ?? 0) + 1;
            } else if (st === "En recherche") current_tot_rech++;
            else if (st === "Non pourvue") current_tot_nonp++;
            else if (st === "Annule Client") current_tot_ann_cli++;
            else if (st === "Annule Int") current_tot_ann_int++;
            else if (st === "Annule ADA") current_tot_ann_ada++;
            else if (st === "Absence") current_tot_abs++;
          });

          current_tot_dem = current_tot_valid + current_tot_rech + current_tot_nonp;

          // Top 5 clients
          topClients = Object.entries(clientsCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, missions]) => ({ name, missions }));

          // Temps de traitement moyen (création → planification) pour les validées
          if (validIds.length > 0) {
            const { data: hist } = await supabase
              .from("historique")
              .select("ligne_id, action, date_action")
              .in("ligne_id", validIds);

            let totalMinutes = 0;
            let n = 0;
            validIds.forEach((id) => {
              const creation = hist?.find((h) => h.ligne_id === id && h.action === "creation");
              const planif = hist?.find((h) => h.ligne_id === id && h.action === "planification");
              if (creation && planif) {
                const d1 = parseISO(creation.date_action);
                const d2 = parseISO(planif.date_action);
                const diff = differenceInMinutes(d2, d1);
                if (diff >= 0) {
                  totalMinutes += diff;
                  n++;
                }
              }
            });
            if (n > 0) {
              const avg = Math.round(totalMinutes / n);
              const j = Math.floor(avg / 1440);
              const h = Math.floor((avg % 1440) / 60);
              const min = avg % 60;
              tempsTraitementMoyen = j > 0 ? `${j}j ${h}h${min ? ` ${min}min` : ""}` : `${h}h${min ? ` ${min}min` : ""}`;
            }
          }

          // Fallback archives si aucune "validée" trouvée (rare sur data de démo)
          if (current_tot_valid === 0) {
            const { data: moisRow } = await supabase
              .from("donnees_mois")
              .select("*")
              .eq("annee", y)
              .eq("mois", m)
              .maybeSingle();

            if (moisRow) {
              const rep = toNumMap(moisRow.repartition, normalizeSecteurKey);
              const repJ = toNumMap(moisRow.repartition_jours, (k) => k.toLowerCase());

              repartitionSecteursCurrent = rep;
              missionsByDayCurrent = repJ;

              // totaux issus de la table
              current_tot_valid = Number(moisRow.total_valides ?? 0);
              current_tot_rech = Number(moisRow.total_en_recherche ?? 0);
              current_tot_nonp = Number(moisRow.total_non_pourvues ?? 0);
              current_tot_dem =
                Number(moisRow.total_demandes ?? 0) ||
                current_tot_valid + current_tot_rech + current_tot_nonp;
              current_tot_ann_cli = Number(moisRow.total_annule_client ?? 0);
              current_tot_ann_int = Number(moisRow.total_annule_int ?? 0);
              current_tot_ann_ada = Number(moisRow.total_annule_ada ?? 0);
              current_tot_abs = Number(moisRow.total_absence ?? 0);

              topClients = []; // pas dispo en archives
              tempsTraitementMoyen = "-";
            }
          }
        } else {
          // --------- 2) Mode ARCHIVES : lire donnees_mois, puis fallback semaines si besoin ----------
          const { data: moisRow } = await supabase
            .from("donnees_mois")
            .select("*")
            .eq("annee", y)
            .eq("mois", m)
            .maybeSingle();

          if (moisRow) {
            // totaux
            current_tot_valid = Number(moisRow.total_valides ?? 0);
            current_tot_rech = Number(moisRow.total_en_recherche ?? 0);
            current_tot_nonp = Number(moisRow.total_non_pourvues ?? 0);
            current_tot_dem =
              Number(moisRow.total_demandes ?? 0) ||
              current_tot_valid + current_tot_rech + current_tot_nonp;
            current_tot_ann_cli = Number(moisRow.total_annule_client ?? 0);
            current_tot_ann_int = Number(moisRow.total_annule_int ?? 0);
            current_tot_ann_ada = Number(moisRow.total_annule_ada ?? 0);
            current_tot_abs = Number(moisRow.total_absence ?? 0);

            // secteurs (priorité à la répartition archivée)
            const rep = toNumMap(moisRow.repartition, normalizeSecteurKey);
            if (Object.keys(rep).length > 0) {
              repartitionSecteursCurrent = rep;
            } else {
              // Fallback : pondération semaines
              const weeks = weeksCoveringMonth(monthStart, monthEnd);
              if (weeks.length > 0) {
                const { data: rows } = await supabase
                  .from("donnees_secteur_semaine")
                  .select("semaine, secteur, total_valides")
                  .eq("annee", y)
                  .in("semaine", weeks);

                const acc: Record<string, number> = {};
                for (const w of weeks) {
                  const overlap = overlapDaysWithMonth(y, w, monthStart, monthEnd); // 0..7
                  if (overlap === 0) continue;
                  const weight = overlap / 7;

                  rows
                    ?.filter((r) => r.semaine === w)
                    .forEach((r) => {
                      const key = normalizeSecteurKey(r.secteur);
                      const add = (Number(r.total_valides ?? 0) || 0) * weight;
                      acc[key] = (acc[key] ?? 0) + add;
                    });
                }
                // on arrondit pour rester sur des entiers
                for (const k of Object.keys(acc)) acc[k] = Math.round(acc[k]);
                repartitionSecteursCurrent = acc;
              }
            }

            // jours (priorité à la répartition archivée)
            const repJ = toNumMap(moisRow.repartition_jours, (k) => k.toLowerCase());
            if (Object.keys(repJ).length > 0) {
              missionsByDayCurrent = repJ;
            } else {
              // Fallback : reconstruction exacte depuis donnees_jour_semaine
              const weeks = weeksCoveringMonth(monthStart, monthEnd);
              const { data: rowsJ } = await supabase
                .from("donnees_jour_semaine")
                .select("semaine, jour, total_valides")
                .eq("annee", y)
                .in("semaine", weeks);

              const accJ: Record<string, number> = {};
              rowsJ?.forEach((r) => {
                const monday = isoMondayOfWeek(y, r.semaine);
                const d = addDays(monday, dayOffsetFR(r.jour));
                if (isSameMonth(d, monthStart)) {
                  const key = r.jour.toLowerCase();
                  accJ[key] = (accJ[key] ?? 0) + Number(r.total_valides ?? 0);
                }
              });
              missionsByDayCurrent = accJ;
            }

            topClients = []; // non dispo en archives
            tempsTraitementMoyen = "-";
          } else {
            // pas de ligne d’archives : valeurs nulles
            repartitionSecteursCurrent = {};
            missionsByDayCurrent = {};
            topClients = [];
            tempsTraitementMoyen = "-";
          }
        }

        // ---------- B) Données N-1 ----------
        let repartitionSecteursN1: Record<string, number> = {};
        let missionsByDayN1: Record<string, number> = {};
        let totalValidN1 = 0;

        const { data: moisN1 } = await supabase
          .from("donnees_mois")
          .select("*")
          .eq("annee", yN1)
          .eq("mois", m)
          .maybeSingle();

        if (moisN1) {
          totalValidN1 = Number(moisN1.total_valides ?? 0);

          // secteurs N-1
          const repN1 = toNumMap(moisN1.repartition, normalizeSecteurKey);
          if (Object.keys(repN1).length > 0) {
            repartitionSecteursN1 = repN1;
          } else {
            // Fallback N-1 : pondération semaines
            const weeksN1 = weeksCoveringMonth(monthStartN1, monthEndN1);
            if (weeksN1.length > 0) {
              const { data: rowsN1 } = await supabase
                .from("donnees_secteur_semaine")
                .select("semaine, secteur, total_valides")
                .eq("annee", yN1)
                .in("semaine", weeksN1);

              const accN1: Record<string, number> = {};
              for (const w of weeksN1) {
                const overlap = overlapDaysWithMonth(yN1, w, monthStartN1, monthEndN1);
                if (overlap === 0) continue;
                const weight = overlap / 7;

                rowsN1
                  ?.filter((r) => r.semaine === w)
                  .forEach((r) => {
                    const key = normalizeSecteurKey(r.secteur);
                    const add = (Number(r.total_valides ?? 0) || 0) * weight;
                    accN1[key] = (accN1[key] ?? 0) + add;
                  });
              }
              for (const k of Object.keys(accN1)) accN1[k] = Math.round(accN1[k]);
              repartitionSecteursN1 = accN1;
            }
          }

          // jours N-1
          const repJN1 = toNumMap(moisN1.repartition_jours, (k) => k.toLowerCase());
          if (Object.keys(repJN1).length > 0) {
            missionsByDayN1 = repJN1;
          } else {
            const weeksN1 = weeksCoveringMonth(monthStartN1, monthEndN1);
            const { data: rowsJN1 } = await supabase
              .from("donnees_jour_semaine")
              .select("semaine, jour, total_valides")
              .eq("annee", yN1)
              .in("semaine", weeksN1);

            const accJN1: Record<string, number> = {};
            rowsJN1?.forEach((r) => {
              const monday = isoMondayOfWeek(yN1, r.semaine);
              const d = addDays(monday, dayOffsetFR(r.jour));
              if (isSameMonth(d, monthStartN1)) {
                const key = r.jour.toLowerCase();
                accJN1[key] = (accJN1[key] ?? 0) + Number(r.total_valides ?? 0);
              }
            });
            missionsByDayN1 = accJN1;
          }
        } else {
          // pas d’archives N-1 : zeros
          repartitionSecteursN1 = {};
          missionsByDayN1 = {};
          totalValidN1 = 0;
        }

        // ---------- C) Position (rang) ----------
        let positionMois = 0;
        {
          // On se base sur `donnees_mois` de l’année courante
          const { data: posRows } = await supabase
            .from("donnees_mois")
            .select("mois,total_valides")
            .eq("annee", y);

          const known = (posRows ?? [])
            .map((r) => Number(r.total_valides ?? 0))
            .filter((v) => v >= 0);

          // On ajoute le total calculé du mois courant (au cas où non présent en archives)
          const all = [...known, current_tot_valid];
          const sorted = all.slice().sort((a, b) => b - a);
          positionMois = sorted.findIndex((v) => v === current_tot_valid) + 1;
        }

        // ---------- D) Assemblage des structures attendues par le BackOffice ----------
        // Répartition secteurs (missions + missionsN1) dans l’ordre SECTEURS_REF
        const repartitionSecteurs = SECTEURS_REF.map((key) => ({
          secteur: key,
          missions: repartitionSecteursCurrent[key] ?? 0,
          missionsN1: repartitionSecteursN1[key] ?? 0,
        }));

        // Missions par jour (comparatif)
        const missionsByDay = DAYS_REF.map((d) => ({
          day: d,
          missions: missionsByDayCurrent[d] ?? 0,
          missionsN1: missionsByDayN1[d] ?? 0,
        }));

        // Stats par statut (mois affiché)
        const statsByStatus: Record<string, number> = {
          Demandées: current_tot_dem,
          Validé: current_tot_valid,
          "En recherche": current_tot_rech,
          "Non pourvue": current_tot_nonp,
          "Annule Client": current_tot_ann_cli,
          "Annule Int": current_tot_ann_int,
          "Annule ADA": current_tot_ann_ada,
          Absence: current_tot_abs,
        };

        setStats({
          statsByStatus,
          repartitionSecteurs,
          missionsByDay,
          topClients,
          tempsTraitementMoyen,
          missionsMois: current_tot_valid,
          missionsMoisN1: totalValidN1,
          positionMois,
          missionsSemaine: 0,
          missionsSemaineN1: 0,
          positionSemaine: 0,
          isLoading: false,
        });
      } catch (e) {
        console.error("❌ useStatsDashboardMonth error", e);
        setStats((s) => ({ ...s, isLoading: false }));
      }
    };

    run();
  }, [selectedMonth, selectedYear]);

  return stats;
}
