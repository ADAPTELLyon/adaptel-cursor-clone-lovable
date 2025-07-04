import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type SemaineReporting = {
  annee: number;
  semaine: number;
  jours: { jour: string; total_valides: number }[];
  secteurs: { secteur: string; total_valides: number }[];
  statuts: { statut: string; total: number }[];
  total_valides: number;
  total_N1: number;
};

export const useReportingData = (annee: number) => {
  const [data, setData] = useState<SemaineReporting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        // récup jours
        const { data: jours } = await supabase
          .from("donnees_jour_semaine")
          .select("*")
          .eq("annee", annee);

        // récup secteurs
        const { data: secteurs } = await supabase
          .from("donnees_secteur_semaine")
          .select("*")
          .eq("annee", annee);

        // récup statuts
        const { data: statuts } = await supabase
          .from("donnees_statut_semaine")
          .select("*")
          .eq("annee", annee);

        // regrouper par semaine
        const semaines: SemaineReporting[] = [];

        for (let i = 1; i <= 52; i++) {
          const semaineJours = jours?.filter(j => j.semaine === i) || [];
          const semaineSecteurs = secteurs?.filter(s => s.semaine === i) || [];
          const semaineStatuts = statuts?.filter(s => s.semaine === i) || [];

          const total_valides = semaineJours.reduce(
            (sum, j) => sum + (j.total_valides ?? 0),
            0
          );

          const total_N1 = semaineStatuts
            .filter(s => s.statut === "Validé")
            .reduce((sum, s) => sum + (s.total ?? 0), 0);

          semaines.push({
            annee,
            semaine: i,
            jours: semaineJours.map(j => ({
              jour: j.jour,
              total_valides: j.total_valides
            })),
            secteurs: semaineSecteurs.map(s => ({
              secteur: s.secteur,
              total_valides: s.total_valides
            })),
            statuts: semaineStatuts.map(s => ({
              statut: s.statut,
              total: s.total
            })),
            total_valides,
            total_N1
          });
        }

        setData(semaines);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };

    fetchData();
  }, [annee]);

  return { data, loading };
};
