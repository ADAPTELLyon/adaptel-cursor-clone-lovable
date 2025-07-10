import { useEffect, useState } from "react";
import { format, startOfWeek, addDays, getWeek, subWeeks, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { PlanningClientTable } from "@/components/commandes/PlanningClientTable";
import type { JourPlanning, CommandeWithCandidat } from "@/types/types-front";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { secteursList } from "@/lib/secteurs";

export default function PlanningMiniClient({ clientId }: { clientId: string }) {
  const [planning, setPlanning] = useState<Record<string, JourPlanning[]>>({});
  const [currentStartDate, setCurrentStartDate] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const numeroSemaine = getWeek(currentStartDate, { weekStartsOn: 1 });

  useEffect(() => {
    const fetchPlanning = async () => {
      const dates = Array.from({ length: 7 }).map((_, i) =>
        format(addDays(currentStartDate, i), "yyyy-MM-dd")
      );

      const { data: commandes } = await supabase
        .from("commandes")
        .select("*, client:client_id(nom), candidat:candidat_id(nom, prenom)")
        .eq("client_id", clientId)
        .in("date", dates);

      const planningMap: Record<string, JourPlanning[]> = {};

      dates.forEach((date) => {
        const commandesDuJour = commandes?.filter((c) => c.date === date) || [];
        planningMap[date] = [
          {
            date,
            secteur: commandesDuJour[0]?.secteur || "Étages",
            commandes: commandesDuJour as CommandeWithCandidat[],
          },
        ];
      });

      setPlanning(planningMap);
    };

    if (clientId) {
      fetchPlanning();
    }
  }, [clientId, currentStartDate]);

  return (
    <div className="border rounded-lg overflow-hidden shadow-sm mt-8 bg-white">
      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-100">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentStartDate((prev) => subWeeks(prev, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-sm font-medium text-gray-800">Semaine {numeroSemaine}</div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentStartDate((prev) => addWeeks(prev, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Planning */}
      <div className="p-4 overflow-x-auto">
        <PlanningClientTable
          planning={planning}
          selectedSecteurs={secteursList.map((s) => s.label)}
          selectedSemaine={"Toutes"}
          onRefresh={() => {}}
          clientId={clientId}
        />
      </div>
    </div>
  );
}
