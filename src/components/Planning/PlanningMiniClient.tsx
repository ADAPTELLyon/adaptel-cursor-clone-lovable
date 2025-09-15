import { useEffect, useMemo, useState } from "react";
import { format, startOfWeek, addDays, getWeek, subWeeks, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { PlanningClientTable } from "@/components/commandes/PlanningClientTable";
import type { JourPlanning, CommandeWithCandidat } from "@/types/types-front";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { secteursList } from "@/lib/secteurs";

/**
 * Mini planning client conforme au planning principal :
 * - 1ère colonne : NOM DU CLIENT uniquement (secteur/service en badges par la table).
 * - Une ligne par SLOT (secteur, service, mission_slot).
 * - Les clés de lignes sont rendues uniques via un suffixe 100% invisible (zéro-largeur),
 *   ainsi l’UI n’affiche que le nom du client.
 */

// Encodage d’une clé “meta” (secteur|service|slot) en suffixe 100% invisible.
// On fait un hash DJB2, puis on map les bits sur 0→ZWSP (U+200B), 1→ZWNJ (U+200C).
function invisibleKeySuffix(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i); // hash * 33 + c
    hash |= 0; // 32-bit
  }
  // On encode 32 bits en 32 chars invisibles : 0 → \u200B, 1 → \u200C
  const zero = "\u200B"; // ZERO WIDTH SPACE
  const one  = "\u200C"; // ZERO WIDTH NON-JOINER
  let bits = "";
  for (let i = 0; i < 32; i++) {
    const bit = (hash >>> i) & 1;
    bits += bit ? one : zero;
  }
  // Petit séparateur invisible devant pour éviter collision avec un nom finissant par le même char
  const sep = "\u2060"; // WORD JOINER (invisible)
  return sep + bits;
}

export default function PlanningMiniClient({ clientId }: { clientId: string }) {
  const [planning, setPlanning] = useState<Record<string, JourPlanning[]>>({});
  const [currentStartDate, setCurrentStartDate] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [refreshTick, setRefreshTick] = useState(0);

  const weekStartStr = useMemo(() => format(currentStartDate, "yyyy-MM-dd"), [currentStartDate]);
  const weekEndStr = useMemo(
    () => format(addDays(currentStartDate, 6), "yyyy-MM-dd"),
    [currentStartDate]
  );
  const numeroSemaine = useMemo(
    () => getWeek(currentStartDate, { weekStartsOn: 1 }),
    [currentStartDate]
  );

  useEffect(() => {
    const fetchPlanning = async () => {
      if (!clientId) {
        setPlanning({});
        return;
      }

      // Commandes du client sur la semaine (lun → dim)
      const { data, error } = await supabase
        .from("commandes")
        .select(`
          id, date, statut, secteur, service, client_id, mission_slot,
          heure_debut_matin, heure_fin_matin,
          heure_debut_soir,  heure_fin_soir,
          heure_debut_nuit,  heure_fin_nuit,
          candidat:candidat_id ( nom, prenom ),
          client:client_id ( nom )
        `)
        .eq("client_id", clientId)
        .gte("date", weekStartStr)
        .lte("date", weekEndStr);

      if (error) {
        console.error("Erreur chargement commandes (mini planning client):", error);
        setPlanning({});
        return;
      }

      const commandes = (data || []) as unknown as CommandeWithCandidat[];

      // === GROUPEMENT PAR SLOT (client x secteur x service x mission_slot) ===
      type Key = string;
      const bySlot: Record<Key, JourPlanning[]> = {};

      for (const c of commandes) {
        const clientNom = (c as any)?.client?.nom || (c as any)?.clients?.nom || "Client ?";
        const secteur = (c as any)?.secteur || "Inconnu";
        const service = (c as any)?.service || null;
        const slot = (c as any)?.mission_slot ?? 0;

        // Libellé affiché en 1ère colonne : uniquement le nom du client.
        const visibleLabel = clientNom;

        // Clé de ligne unique 100% invisible après le libellé (aucun texte lisible ajouté).
        // Le suffixe encode (secteur|service|slot) en zéro-largeur.
        const meta = `${secteur}|${service ?? ""}|${slot}`;
        const rowKey = visibleLabel + invisibleKeySuffix(meta);

        if (!bySlot[rowKey]) bySlot[rowKey] = [];

        const nom = (c as any)?.candidat?.nom || (c as any)?.candidats?.nom || "";
        const prenom = (c as any)?.candidat?.prenom || (c as any)?.candidats?.prenom || "";

        bySlot[rowKey].push({
          date: (c as any).date, // ISO yyyy-MM-dd
          secteur,
          service,
          commandes: [
            {
              id: (c as any).id,
              date: (c as any).date,
              statut: (c as any).statut,
              secteur,
              service,
              client_id: (c as any).client_id,
              mission_slot: slot,
              heure_debut_matin: (c as any).heure_debut_matin,
              heure_fin_matin: (c as any).heure_fin_matin,
              heure_debut_soir: (c as any).heure_debut_soir,
              heure_fin_soir: (c as any).heure_fin_soir,
              heure_debut_nuit: (c as any).heure_debut_nuit,
              heure_fin_nuit: (c as any).heure_fin_nuit,
              // Important : pour l’affichage Nom/Prénom si Validé (comme le principal)
              candidat: (nom || prenom) ? { nom, prenom } : undefined,
              // Compat éventuelle si la table lit "candidats"/"client(s)"
              candidats: (nom || prenom) ? { nom, prenom } : undefined,
              client: clientNom ? { nom: clientNom } : undefined,
              clients: clientNom ? { nom: clientNom } : undefined,
            } as any,
          ],
        } as JourPlanning);
      }

      setPlanning(bySlot);
    };

    fetchPlanning();
  }, [clientId, weekStartStr, weekEndStr, refreshTick]);

  return (
    <div className="border rounded-lg overflow-hidden shadow-sm mt-8 bg-white">
      {/* Navigation semaine */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-100">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentStartDate((prev) => subWeeks(prev, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-sm font-medium text-gray-800">
          Semaine {numeroSemaine} • du {format(currentStartDate, "dd MMM", { locale: fr })} au{" "}
          {format(addDays(currentStartDate, 6), "dd MMM yyyy", { locale: fr })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentStartDate((prev) => addWeeks(prev, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Planning — une ligne par SLOT (client × secteur × service × mission_slot) */}
      <div className="p-4 overflow-x-auto">
        <PlanningClientTable
          planning={planning}                                // { [rowKey]: JourPlanning[] } ; visuel = nom client
          selectedSecteurs={secteursList.map((s) => s.label)} // tous secteurs
          selectedSemaine={`${numeroSemaine}`}
          onRefresh={() => setRefreshTick((x) => x + 1)}
          clientId={clientId}
        />
      </div>
    </div>
  );
}
