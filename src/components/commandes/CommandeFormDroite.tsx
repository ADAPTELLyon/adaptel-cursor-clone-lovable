import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Clock, PlusCircle } from "lucide-react"
import { statutColors } from "@/lib/colors"

interface CommandeFormDroiteProps {
  joursSemaine: { jour: string; key: string }[]
  joursState: Record<string, boolean>
  setJoursState: (val: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
  heuresParJour: Record<string, any>
  setHeuresParJour: (val: Record<string, any>) => void
  selectedPosteType?: any
  secteur: string
  handleSave: () => void
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
  const isEtages = secteur.toLowerCase() === "etages"
  const orangeBg = statutColors["En recherche"].bg

  const toggleJour = (key: string) => {
    setJoursState((prev) => {
      const newState = { ...prev, [key]: !prev[key] }

      if (!prev[key] && selectedPosteType) {
        const isReception = secteur.toLowerCase().includes("réception")
        const isNightAudit = selectedPosteType.poste_base?.nom?.toLowerCase().includes("night audit")

        let debutMatin = selectedPosteType.heure_debut_matin?.slice(0, 5) || ""
        let finMatin = selectedPosteType.heure_fin_matin?.slice(0, 5) || ""
        let debutSoir = selectedPosteType.heure_debut_soir?.slice(0, 5) || ""
        let finSoir = selectedPosteType.heure_fin_soir?.slice(0, 5) || ""

        if (isReception && isNightAudit) {
          debutMatin = ""
          finMatin = ""
        }

        if (isEtages) {
          debutSoir = ""
          finSoir = ""
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
        }))
      }

      return newState
    })
  }

  const activerToutesLesJournees = (val: boolean) => {
    const newState: Record<string, boolean> = {}
    joursSemaine.forEach((j) => {
      newState[j.key] = val
    })
    setJoursState(newState)
  }

  const handleReplicateHeures = () => {
    const firstWithHours = Object.entries(heuresParJour).find(
      ([_, val]) => val.debutMatin || val.finMatin || val.debutSoir || val.finSoir
    )

    if (firstWithHours) {
      const [, heures] = firstWithHours
      const newHeures = { ...heures }

      const updated = Object.keys(joursState).reduce((acc, key) => {
        if (joursState[key]) {
          acc[key] = { ...newHeures }
        }
        return acc
      }, {} as typeof heuresParJour)

      setHeuresParJour(updated)
    }
  }

  return (
    <div className="flex flex-col border p-4 rounded-lg shadow-md bg-white max-h-[80vh]">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-sm">Activer toutes les journées</div>
        <Switch onCheckedChange={activerToutesLesJournees} />
      </div>

      <div className="mb-3">
        <Button variant="outline" size="sm" onClick={handleReplicateHeures}>
          Répliquer les heures
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        {joursSemaine.map((j) => {
          const isActive = joursState[j.key]
          const heures = heuresParJour[j.key] || {}

          return (
            <div
              key={j.key}
              className={`relative border rounded px-3 py-2 min-h-[120px] transition-all duration-200 ${
                isActive
                  ? "bg-white border-2 ring-1 ring-offset-0"
                  : "bg-gray-100 border"
              }`}
              style={{
                borderColor: isActive ? orangeBg : "#d1d5db",
                boxShadow: isActive ? `inset -4px 0 0 ${orangeBg}` : undefined,
              }}
              onClick={(e) => {
                const target = e.target as HTMLElement
                if (
                  ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName) ||
                  target.closest("input") ||
                  target.closest("button") ||
                  target.closest("select") ||
                  target.closest("textarea")
                ) return
                toggleJour(j.key)
              }}
            >
              {/* Indication à cliquer */}
              {!isActive && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-10">
                  <PlusCircle className="w-8 h-8" />
                </div>
              )}

              {/* Date + Nb personnes */}
              <div className="flex justify-between items-start mb-1">
                <div className="text-sm font-medium">{j.jour}</div>
                {isActive && (
                  <select
                    value={heures.nbPersonnes || 1}
                    onChange={(e) => setHeuresParJour((prev) => ({
                      ...prev,
                      [j.key]: {
                        ...prev[j.key],
                        nbPersonnes: Number(e.target.value),
                      },
                    }))}
                    className="text-sm px-1 py-0.5 border rounded w-14"
                  >
                    {Array.from({ length: 21 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Contenu des horaires */}
              {isActive && (
                <div className="text-sm space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="--:--"
                      value={heures.debutMatin || ""}
                      className="w-20 h-8 text-center"
                      onChange={(e) =>
                        setHeuresParJour((prev) => ({
                          ...prev,
                          [j.key]: { ...prev[j.key], debutMatin: e.target.value },
                        }))
                      }
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="--:--"
                      value={heures.finMatin || ""}
                      className="w-20 h-8 text-center"
                      onChange={(e) =>
                        setHeuresParJour((prev) => ({
                          ...prev,
                          [j.key]: { ...prev[j.key], finMatin: e.target.value },
                        }))
                      }
                    />
                  </div>

                  {!isEtages && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="--:--"
                        value={heures.debutSoir || ""}
                        className="w-20 h-8 text-center"
                        onChange={(e) =>
                          setHeuresParJour((prev) => ({
                            ...prev,
                            [j.key]: { ...prev[j.key], debutSoir: e.target.value },
                          }))
                        }
                      />
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="--:--"
                        value={heures.finSoir || ""}
                        className="w-20 h-8 text-center"
                        onChange={(e) =>
                          setHeuresParJour((prev) => ({
                            ...prev,
                            [j.key]: { ...prev[j.key], finSoir: e.target.value },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="pt-4 mt-4 border-t">
        <Button
          className="w-full bg-[#840404] hover:bg-[#750303] text-white"
          onClick={handleSave}
        >
          Valider
        </Button>
      </div>
    </div>
  )
}
