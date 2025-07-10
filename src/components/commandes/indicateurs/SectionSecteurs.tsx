import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import { getWeek, getYear } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { secteursList } from "@/lib/secteurs";
import { statutColors } from "@/lib/colors";

type Props = {
  refreshTrigger: number;
};

export function SectionSecteurs({ refreshTrigger }: Props) {
  const [stats, setStats] = useState<Record<string, { recherche: number; validees: number }>>({});

  useEffect(() => {
    const fetchData = async () => {
      // on récupère toutes les commandes +/- 8 jours autour d'aujourd'hui
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 7);

      const { data, error } = await supabase
        .from("commandes")
        .select("secteur, statut, date")
        .gte("date", startDate.toISOString().slice(0,10))
        .lte("date", endDate.toISOString().slice(0,10));

      if (error || !data) {
        console.error("Erreur chargement indicateurs secteurs", error);
        return;
      }

      const semaineActuelle = getWeek(today, { weekStartsOn: 1, locale: fr });
      const anneeActuelle = getYear(today);

      const filteredData = data.filter(cmd => {
        const d = new Date(cmd.date);
        return (
          getWeek(d, { weekStartsOn: 1, locale: fr }) === semaineActuelle &&
          getYear(d) === anneeActuelle
        );
      });

      const counts: Record<string, { recherche: number; validees: number }> = {};

      secteursList.forEach(({ label }) => {
        counts[label] = { recherche: 0, validees: 0 };
      });

      filteredData.forEach((cmd) => {
        const secteur = cmd.secteur || "";
        if (secteursList.some((s) => s.label === secteur)) {
          if (cmd.statut === "En recherche") counts[secteur].recherche++;
          if (cmd.statut === "Validé") counts[secteur].validees++;
        }
      });

      setStats(counts);
    };

    fetchData();
  }, [refreshTrigger]);

  return (
    <div className="grid grid-cols-5 gap-2 w-full">
      {secteursList.map(({ label, icon: Icon }) => {
        const secteurData = stats[label] || { recherche: 0, validees: 0 };
        const isOk = secteurData.recherche === 0;
        const bgColor = isOk
          ? statutColors["Validé"].bg
          : statutColors["En recherche"].bg;
        const textColor = isOk
          ? statutColors["Validé"].text
          : statutColors["En recherche"].text;

        return (
          <div
            key={label}
            className="flex items-center justify-between px-3 h-[44px] rounded-lg shadow-sm"
            style={{ backgroundColor: bgColor, color: textColor }}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Icon className="w-4 h-4" />
              {label}
            </div>
            <div className="text-sm font-bold">
              {isOk ? (
                <CheckCircle className="w-4 h-4 text-green-700" />
              ) : (
                <span className="text-sm">{secteurData.recherche}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
