import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Clock, PlusCircle, Users } from "lucide-react"
import { statutColors } from "@/lib/colors"
import InputMask from "react-input-mask"
import { PlanifCandidatsCreationPopover } from "./PlanifCandidatsCreationPopover"

interface CommandeFormDroiteProps {
  joursSemaine: { jour: string; key: string }[]
  joursState: Record<string, boolean>
  setJoursState: (val: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
  heuresParJour: Record<string, any>
  setHeuresParJour: (val: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void
  selectedPosteType?: any
  secteur: string
  handleSave: () => void
  clientId: string
  plannedByDay: Record<string, string[]>
  setPlannedByDay: (val: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => void
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
  clientId,
  plannedByDay,
  setPlannedByDay,
}: CommandeFormDroiteProps) {
  const isEtages = secteur.toLowerCase() === "etages"
  const orangeBg = statutColors["En recherche"].bg

  const ensureArrayLen = (day: string, len: number) => {
    setPlannedByDay((prev) => {
      const arr = (prev[day] || []).slice()
      if (arr.length === len) return prev
      const next = arr.slice(0, len)
      while (next.length < len) next.push("")
      return { ...prev, [day]: next }
    })
  }

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

        if (isReception && isNightAudit) { debutMatin = ""; finMatin = "" }
        if (isEtages) { debutSoir = ""; finSoir = "" }

        setHeuresParJour((prevHeures) => ({
          ...prevHeures,
          [key]: {
            debutMatin, finMatin, debutSoir, finSoir,
            nbPersonnes: 1,
          },
        }))
        ensureArrayLen(key, 1)
      }

      if (prev[key] === true) {
        setPlannedByDay((p) => {
          const clone = { ...p }
          delete clone[key]
          return clone
        })
      }

      return newState
    })
  }

  const activerToutesLesJournees = (val: boolean) => {
    const newState: Record<string, boolean> = {}
    joursSemaine.forEach((j) => { newState[j.key] = val })
    setJoursState(newState)
    if (val) {
      const add: Record<string, string[]> = {}
      joursSemaine.forEach((j) => { add[j.key] = [""] })
      setPlannedByDay(add)
    } else {
      setPlannedByDay({})
    }
  }

  const handleReplicateHeures = () => {
    const firstWithHours = Object.entries(heuresParJour).find(
      ([_, val]) => val?.debutMatin || val?.finMatin || val?.debutSoir || val?.finSoir
    )
    if (firstWithHours) {
      const [, heures] = firstWithHours
      const newHeures = { ...heures }
      const updated = Object.keys(joursState).reduce((acc, key) => {
        if (joursState[key]) { acc[key] = { ...newHeures } }
        return acc
      }, {} as typeof heuresParJour)
      setHeuresParJour((prev) => ({ ...prev, ...updated }))

      const nb = newHeures.nbPersonnes || 1
      Object.keys(joursState).forEach((key) => { if (joursState[key]) ensureArrayLen(key, nb) })
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

      <div
        className="flex-1 overflow-y-auto pr-1 space-y-3 overscroll-contain"
        onWheel={(e) => e.stopPropagation()}
      >
        {joursSemaine.map((j) => {
          const isActive = joursState[j.key]
          const heures = heuresParJour[j.key] || {}
          const nb = heures.nbPersonnes || 1
          const chosen = (plannedByDay[j.key] || []).filter(Boolean).length

          return (
            <div
              key={j.key}
              className={`relative border rounded px-3 py-2 min-h-[120px] transition-all duration-200 ${
                isActive ? "bg-white border-2 ring-1 ring-offset-0" : "bg-gray-100 border"
              }`}
              style={{
                borderColor: isActive ? orangeBg : "#d1d5db",
                boxShadow: isActive ? `inset -4px 0 0 ${orangeBg}` : undefined,
              }}
              onClick={(e) => {
                const target = e.target as HTMLElement
                if (
                  ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "svg", "path"].includes(target.tagName) ||
                  target.closest("input") || target.closest("button") || target.closest("select") ||
                  target.closest("textarea") || target.closest("[data-stop-prop]")
                ) return
                toggleJour(j.key)
              }}
            >
              {!isActive && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10">
                  <PlusCircle className="w-8 h-8" />
                </div>
              )}

              {/* Ligne 1 : Date + sélecteur nb */}
              <div className="flex justify-between items-start mb-1">
                <div className="text-sm font-medium">{j.jour}</div>
                {isActive && (
                  <div className="flex items-center gap-2" data-stop-prop>
                    <select
                      value={heures.nbPersonnes || 1}
                      onChange={(e) => {
                        const nbNew = Number(e.target.value)
                        setHeuresParJour((prev) => ({
                          ...prev,
                          [j.key]: { ...prev[j.key], nbPersonnes: nbNew },
                        }))
                        const arr = plannedByDay[j.key] || []
                        const next = arr.slice(0, nbNew)
                        while (next.length < nbNew) next.push("")
                        setPlannedByDay((prev) => ({ ...prev, [j.key]: next }))
                      }}
                      className="text-sm px-1 py-0.5 border rounded w-12 text-center"
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {isActive && (
                <>
                  {/* Ligne 2 : Matin à gauche + icône popover à droite (léger retrait) */}
                  <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <InputMask
                        mask="99:99"
                        maskPlaceholder="__:__"
                        value={heures.debutMatin || ""}
                        onChange={(e) =>
                          setHeuresParJour((prev) => ({ ...prev, [j.key]: { ...prev[j.key], debutMatin: e.target.value } }))
                        }
                      >
                        {(inputProps) => <Input {...inputProps} className="w-20 h-8 text-center" inputMode="numeric" />}
                      </InputMask>
                      <InputMask
                        mask="99:99"
                        maskPlaceholder="__:__"
                        value={heures.finMatin || ""}
                        onChange={(e) =>
                          setHeuresParJour((prev) => ({ ...prev, [j.key]: { ...prev[j.key], finMatin: e.target.value } }))
                        }
                      >
                        {(inputProps) => <Input {...inputProps} className="w-20 h-8 text-center" inputMode="numeric" />}
                      </InputMask>
                    </div>

                    <div className="pr-1" data-stop-prop>
                      <PlanifCandidatsCreationPopover
                        trigger={
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="relative h-8 w-8"
                            aria-label="Sélection candidats"
                          >
                            <Users className="w-4 h-4" />
                            {chosen > 0 && (
                              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4 flex items-center justify-center">
                                {chosen}
                              </span>
                            )}
                          </Button>
                        }
                        secteur={secteur}
                        clientId={clientId}
                        date={j.key}
                        nbPersonnes={nb}
                        heures={heures}
                        value={plannedByDay[j.key] || Array.from({ length: nb }, () => "")}
                        onChange={(arr) => setPlannedByDay((prev) => ({ ...prev, [j.key]: arr }))}
                      />
                    </div>
                  </div>

                  {/* Ligne 3 : Soir à gauche (si non Étages) */}
                  {!isEtages && (
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <InputMask
                        mask="99:99"
                        maskPlaceholder="__:__"
                        value={heures.debutSoir || ""}
                        onChange={(e) =>
                          setHeuresParJour((prev) => ({ ...prev, [j.key]: { ...prev[j.key], debutSoir: e.target.value } }))
                        }
                      >
                        {(inputProps) => <Input {...inputProps} className="w-20 h-8 text-center" inputMode="numeric" />}
                      </InputMask>
                      <InputMask
                        mask="99:99"
                        maskPlaceholder="__:__"
                        value={heures.finSoir || ""}
                        onChange={(e) =>
                          setHeuresParJour((prev) => ({ ...prev, [j.key]: { ...prev[j.key], finSoir: e.target.value } }))
                        }
                      >
                        {(inputProps) => <Input {...inputProps} className="w-20 h-8 text-center" inputMode="numeric" />}
                      </InputMask>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="pt-4 mt-4 border-t">
        <Button className="w-full bg-[#840404] hover:bg-[#750303] text-white" onClick={handleSave}>
          Valider
        </Button>
      </div>
    </div>
  )
}
