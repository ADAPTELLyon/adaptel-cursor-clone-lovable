import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { PosteType } from "@/types/types-front";

interface CommandeFormDroiteProps {
  joursSemaine: { jour: string; key: string }[];
  joursState: Record<string, boolean>;
  setJoursState: (val: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  heuresParJour: Record<string, any>;
  setHeuresParJour: (val: Record<string, any>) => void;
  selectedPosteType?: PosteType;
  secteur: string;
  handleSave: () => void;
}

export default function CommandeFormDroite({
  joursSemaine,
  joursState,
  setJoursState,
  heuresParJour,
  setHeuresParJour,
  selectedPosteType,
  secteur,
  handleSave,
}: CommandeFormDroiteProps) {
  const toggleJour = (key: string) => {
    setJoursState((prev) => {
      const newState = { ...prev, [key]: !prev[key] };

      if (!prev[key] && selectedPosteType) {
        const isReception = secteur.toLowerCase().includes("réception");
        const isNightAudit =
          selectedPosteType.poste_base?.nom
            .toLowerCase()
            .includes("night audit");

        let debutMatin = selectedPosteType.heure_debut_matin || "";
        let finMatin = selectedPosteType.heure_fin_matin || "";
        let debutSoir = selectedPosteType.heure_debut_soir || "";
        let finSoir = selectedPosteType.heure_fin_soir || "";

        if (isReception && isNightAudit) {
          debutMatin = "";
          finMatin = "";
        }

        if (secteur.toLowerCase() === "etages") {
          debutSoir = "";
          finSoir = "";
        }

        setHeuresParJour((prevHeures) => ({
          ...prevHeures,
          [key]: {
            debutMatin,
            finMatin,
            debutSoir,
            finSoir,
            nbPersonnes: 1,
          },
        }));
      }

      return newState;
    });
  };

  const handleReplicateHeures = () => {
    const firstWithHours = Object.entries(heuresParJour).find(
      ([_, val]) =>
        val.debutMatin || val.finMatin || val.debutSoir || val.finSoir
    );

    if (firstWithHours) {
      const [, heures] = firstWithHours;
      const newHeures = { ...heures };

      const updated = Object.keys(joursState).reduce((acc, key) => {
        if (joursState[key]) {
          acc[key] = { ...newHeures };
        }
        return acc;
      }, {} as typeof heuresParJour);

      setHeuresParJour(updated);
    }
  };

  const activerToutesLesJournees = (val: boolean) => {
    const newState: Record<string, boolean> = {};
    joursSemaine.forEach((j) => {
      newState[j.key] = val;
    });
    setJoursState(newState);
  };

  return (
    <div className="space-y-4 border p-4 rounded-lg shadow-md bg-white max-h-[75vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm">Activer toutes les journées</div>
        <Switch onCheckedChange={activerToutesLesJournees} />
      </div>

      <Button variant="outline" size="sm" onClick={handleReplicateHeures}>
        Répliquer les heures
      </Button>

      <div className="grid grid-cols-1 gap-2">
        {joursSemaine.map((j) => {
          const isActive = joursState[j.key];

          return (
            <div
              key={j.key}
              className={`border rounded p-3 space-y-2 shadow-sm ${
                isActive ? "bg-[#f3f4f6]" : "bg-gray-100"
              }`}
              onClick={(e) => {
                // Si le clic vient d’un champ interne, ne pas toggler
                const target = e.target as HTMLElement;
                if (
                  ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName) ||
                  target.closest("input") ||
                  target.closest("button") ||
                  target.closest("select") ||
                  target.closest("textarea")
                ) {
                  return;
                }
                toggleJour(j.key);
              }}
            >
              <div className="text-sm font-medium">{j.jour}</div>

              {isActive && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input
                    type="time"
                    placeholder="Heure début matin"
                    value={heuresParJour[j.key]?.debutMatin || ""}
                    onChange={(e) =>
                      setHeuresParJour((prev) => ({
                        ...prev,
                        [j.key]: {
                          ...prev[j.key],
                          debutMatin: e.target.value,
                        },
                      }))
                    }
                  />
                  <Input
                    type="time"
                    placeholder="Heure fin matin"
                    value={heuresParJour[j.key]?.finMatin || ""}
                    onChange={(e) =>
                      setHeuresParJour((prev) => ({
                        ...prev,
                        [j.key]: {
                          ...prev[j.key],
                          finMatin: e.target.value,
                        },
                      }))
                    }
                  />
                  <Input
                    type="time"
                    placeholder="Heure début soir"
                    value={heuresParJour[j.key]?.debutSoir || ""}
                    onChange={(e) =>
                      setHeuresParJour((prev) => ({
                        ...prev,
                        [j.key]: {
                          ...prev[j.key],
                          debutSoir: e.target.value,
                        },
                      }))
                    }
                  />
                  <Input
                    type="time"
                    placeholder="Heure fin soir"
                    value={heuresParJour[j.key]?.finSoir || ""}
                    onChange={(e) =>
                      setHeuresParJour((prev) => ({
                        ...prev,
                        [j.key]: {
                          ...prev[j.key],
                          finSoir: e.target.value,
                        },
                      }))
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Nb de personnes"
                    min={1}
                    value={heuresParJour[j.key]?.nbPersonnes || 1}
                    onChange={(e) =>
                      setHeuresParJour((prev) => ({
                        ...prev,
                        [j.key]: {
                          ...prev[j.key],
                          nbPersonnes: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-4">
        <Button
          className="w-full bg-[#840404] hover:bg-[#750303] text-white"
          onClick={handleSave}
        >
          Valider
        </Button>
      </div>
    </div>
  );
}
