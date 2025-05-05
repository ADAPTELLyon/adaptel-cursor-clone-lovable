import { useState } from "react";
import { cn } from "@/lib/utils";
import { Pencil, Check, Plus } from "lucide-react";
import { format, startOfWeek, addDays, getWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { statutColors, indicateurColors } from "@/lib/colors";
import { secteursList } from "@/lib/secteurs";
import type { CommandeWithCandidat, JourPlanning } from "@/types/types-front";
import { Input } from "@/components/ui/input";

export function PlanningClientTable({
  planning,
  selectedSecteurs,
  selectedSemaine,
}: {
  planning: Record<string, JourPlanning[]>;
  selectedSecteurs: string[];
  selectedSemaine: string;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [heureTemp, setHeureTemp] = useState<Record<string, string>>({});

  const groupesParSemaine: Record<
    string,
    Record<string, (JourPlanning | null)[]>
  > = {};

  Object.entries(planning).forEach(([client, jours]) => {
    jours.forEach((jour) => {
      const semaine = getWeek(new Date(jour.date), { weekStartsOn: 1 }).toString();
      if (!groupesParSemaine[semaine]) groupesParSemaine[semaine] = {};
      const cle = `${client}||${jour.secteur}||${jour.service || ""}`;

      if (!groupesParSemaine[semaine][cle]) {
        const newRow = Array(7).fill(null) as (JourPlanning | null)[];
        const dayIndex = new Date(jour.date).getDay() === 0 ? 6 : new Date(jour.date).getDay() - 1;
        newRow[dayIndex] = jour;
        groupesParSemaine[semaine][cle] = [newRow];
      } else {
        const lignesExistantes = groupesParSemaine[semaine][cle];
        const dayIndex = new Date(jour.date).getDay() === 0 ? 6 : new Date(jour.date).getDay() - 1;
        let placé = false;

        for (const ligne of lignesExistantes) {
          if (!ligne[dayIndex]) {
            ligne[dayIndex] = jour;
            placé = true;
            break;
          }
        }

        if (!placé) {
          const newRow = Array(7).fill(null) as (JourPlanning | null)[];
          newRow[dayIndex] = jour;
          lignesExistantes.push(newRow);
        }
      }
    });
  });

  return (
    <div className="space-y-8 mt-8">
      {Object.entries(groupesParSemaine).map(([semaine, groupes]) => {
        const semaineTexte = `Semaine ${semaine}`;
        const baseDate = startOfWeek(new Date(), { weekStartsOn: 1 });
        const semaineDifference = parseInt(semaine) - getWeek(baseDate, { weekStartsOn: 1 });
        const lundiSemaine = addDays(baseDate, semaineDifference * 7);

        const jours = Array.from({ length: 7 }, (_, i) => {
          const jour = addDays(lundiSemaine, i);
          return {
            date: jour,
            dateStr: format(jour, "yyyy-MM-dd"),
            label: format(jour, "eeee dd MMMM", { locale: fr }),
          };
        });

        const groupesFiltres = Object.entries(groupes).filter(([cle]) => {
          const secteur = cle.split("||")[1];
          return selectedSecteurs.includes(secteur);
        });

        return (
          <div key={semaine} className="border rounded-lg overflow-hidden shadow-sm">
            <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white">
              <div className="p-3 border-r flex items-center justify-center">{semaineTexte}</div>
              {jours.map((jour, index) => {
                const commandesJour = groupesFiltres.flatMap(([_, lignes]) =>
                  lignes
                    .flat()
                    .filter((j) => j?.date && format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr)
                    .flatMap((j) => j?.commandes || [])
                );
                const nbEnRecherche = commandesJour.filter((cmd) => cmd.statut === "En recherche").length;
                const totalMissions = commandesJour.length;

                return (
                  <div key={index} className="p-3 border-r text-center relative leading-tight">
                    <div>{jour.label.split(" ")[0]}</div>
                    <div className="text-xs">{jour.label.split(" ").slice(1).join(" ")}</div>
                    {totalMissions === 0 ? (
                      <div className="absolute top-1 right-1">
                        <div className="h-5 w-5 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">–</div>
                      </div>
                    ) : nbEnRecherche > 0 ? (
                      <div
                        className="absolute top-1 right-1 h-5 w-5 text-xs rounded-full flex items-center justify-center"
                        style={{ backgroundColor: indicateurColors["En recherche"], color: "white" }}
                      >
                        {nbEnRecherche}
                      </div>
                    ) : (
                      <div className="absolute top-1 right-1">
                        <div className="h-5 w-5 rounded-full bg-[#a9d08e] flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {groupesFiltres.map(([key, lignes]) => {
              const [clientNom, secteur, service] = key.split("||");
              const secteurInfo = secteursList.find((s) => s.value === secteur);

              return lignes.map((ligne, idx) => (
                <div
                  key={`${key}-ligne-${idx}`}
                  className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] border-t text-sm"
                >
                  <div className="p-4 border-r space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{clientNom}</span>
                      <Pencil className="h-4 w-4 text-gray-400 cursor-pointer" />
                    </div>
                    <div className="flex items-start gap-2 flex-wrap text-sm">
                      {secteurInfo && (
                        <div className="text-[13px] px-2 py-1 rounded bg-gray-100 text-gray-800 flex items-center gap-1">
                          <secteurInfo.icon className="h-3 w-3" /> {secteurInfo.label}
                        </div>
                      )}
                      {service && (
                        <div className="text-[13px] px-2 py-1 rounded bg-gray-100 text-gray-800 italic">
                          {service}
                        </div>
                      )}
                    </div>
                    <div className="text-[13px] text-gray-500">{semaineTexte}</div>
                  </div>

                  {ligne.map((jour, index) => {
                    const commande = jour?.commandes[0];
                    const isEtages = secteur === "Étages";

                    return (
                      <div key={index} className="border-r p-2 h-28 relative">
                        {!commande ? (
                          <div className="h-full bg-gray-100 rounded flex items-center justify-center">
                            <Plus className="h-4 w-4 text-gray-400" />
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "h-full rounded p-2 text-xs flex flex-col justify-start gap-1 border relative"
                            )}
                            style={{
                              backgroundColor: statutColors[commande.statut]?.bg || "#e5e7eb",
                              color: statutColors[commande.statut]?.text || "#000000",
                            }}
                          >
                            <div className="leading-tight font-semibold">
                              {commande.statut === "Validé" && commande.candidat ? (
                                <>
                                  <span>{commande.candidat.nom}</span>
                                  <span className="block text-xs font-normal">{commande.candidat.prenom}</span>
                                </>
                              ) : (
                                <>
                                  <span className="font-medium">{commande.statut}</span>
                                  <span className="block text-xs font-normal h-[1.25rem]"></span>
                                </>
                              )}
                            </div>

                            <div className="text-[13px] font-semibold mt-1 space-y-1">
                              {["matin", ...(isEtages ? [] : ["soir"])].map((creneau) => {
                                const heureDebut = commande[`heure_debut_${creneau}` as keyof CommandeWithCandidat] ?? "";
                                const heureFin = commande[`heure_fin_${creneau}` as keyof CommandeWithCandidat] ?? "";

                                return (
                                  <div key={creneau} className="flex gap-1 items-center">
                                    <span>{heureDebut ? `${heureDebut.slice(0, 5)} - ${heureFin.slice(0, 5)}` : "–"}</span>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="absolute top-1 right-1">
                              <div className="rounded-full p-1 bg-white/40">
                                <Plus className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ));
            })}
          </div>
        );
      })}
    </div>
  );
}
