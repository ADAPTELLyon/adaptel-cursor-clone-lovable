import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { disponibiliteColors, statutColors } from "@/lib/colors"
import { Info } from "lucide-react"

interface Props {
  joursSemaine: {
    key: string
    jour: string
    isPast: boolean
    planifies?: {
      client: string
      horaire: string
      statut?: string
    }[]
  }[]
  dispos: Record<
    string,
    { statut: "dispo" | "absence" | "non"; matin: boolean; soir: boolean }
  >
  toggleStatut: (key: string) => void
  handleToggleMatin: (key: string) => void
  handleToggleSoir: (key: string) => void
  appliquerMatinSoir: (creneau: "matin" | "soir", value: boolean) => void
  allMatin: boolean
  setAllMatin: (val: boolean) => void
  allSoir: boolean
  setAllSoir: (val: boolean) => void
  handleSave: () => void
  appliquerTous: (statut: "dispo" | "absence") => void
}

export default function DispoSemainePanel({
  joursSemaine,
  dispos,
  toggleStatut,
  handleToggleMatin,
  handleToggleSoir,
  appliquerMatinSoir,
  allMatin,
  setAllMatin,
  allSoir,
  setAllSoir,
  handleSave,
  appliquerTous,
}: Props) {
  return (
    <div className="space-y-4 border p-4 rounded-lg shadow-md bg-white">
      <div className="grid grid-cols-2 gap-4">
        <Button
          className="w-full bg-gray-200 text-black hover:bg-gray-300"
          onClick={() => appliquerTous("dispo")}
        >
          Toutes Dispo
        </Button>
        <Button
          className="w-full bg-gray-200 text-black hover:bg-gray-300"
          onClick={() => appliquerTous("absence")}
        >
          Non Dispo
        </Button>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">Matin / Midi</span>
          <Switch
            checked={allMatin}
            onCheckedChange={(val) => {
              setAllMatin(val)
              appliquerMatinSoir("matin", val)
            }}
            className="scale-90"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Soir</span>
          <Switch
            checked={allSoir}
            onCheckedChange={(val) => {
              setAllSoir(val)
              appliquerMatinSoir("soir", val)
            }}
            className="scale-90"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {joursSemaine.map((j) => {
          const dispo = dispos[j.key]?.statut || "non"
          const planifies = j.planifies || []

          const firstMission = planifies[0]
          const secondMission = planifies.length > 1 ? planifies[1] : null

          const statut = firstMission?.statut
          const isAnnexe =
            statut &&
            ["Absence", "Annule Int", "Annule Client", "Annule ADA"].includes(statut)

          const isBlocked = statut === "Validé"

          const secteur = firstMission?.client?.toLowerCase() || ""
          const isEtages = secteur.includes("etage")

          const bgColor =
            statut && statutColors[statut]
              ? statutColors[statut].bg
              : dispo === "dispo"
              ? disponibiliteColors["Dispo"].bg
              : dispo === "absence"
              ? disponibiliteColors["Non Dispo"].bg
              : j.isPast
              ? "#e5e7eb"
              : disponibiliteColors["Non Renseigné"].bg

          const handleClick = () => {
            if (!j.isPast && !isBlocked) {
              const actuel = dispo
              const suivant =
                actuel === "non"
                  ? "dispo"
                  : actuel === "dispo"
                  ? "absence"
                  : "non"

              const matin = suivant === "dispo" ? true : dispo === "dispo" ? dispos[j.key]?.matin ?? true : true
              const soir = suivant === "dispo"
                ? isEtages
                  ? false
                  : true
                : dispo === "dispo"
                ? dispos[j.key]?.soir ?? true
                : true

              toggleStatut(j.key)

              // simulate switch manually
              dispos[j.key] = {
                statut: suivant as "dispo" | "absence" | "non",
                matin,
                soir,
              }
            }
          }

          return (
            <div
              key={j.key}
              className="border rounded px-4 py-4 shadow-sm flex justify-between items-center cursor-pointer min-h-[70px]"
              style={{ backgroundColor: bgColor }}
              onClick={handleClick}
            >
              <div className="flex-1">
                <div className="text-sm font-medium flex items-center gap-2">
                  {j.jour}
                  {firstMission && (
                    <span className="text-xs text-gray-700 italic">
                      {isAnnexe
                        ? `${statut} – ${firstMission.client}`
                        : `${firstMission.client} – ${firstMission.horaire}`}
                    </span>
                  )}
                  {secondMission && (
                    <span
                      className="text-gray-500"
                      title={`${secondMission.client} – ${secondMission.horaire}`}
                    >
                      <Info className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </div>

              {!isBlocked && dispo === "dispo" && !j.isPast && (
                <div
                  className="flex gap-4 ml-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-xs">Matin</span>
                    <Switch
                      checked={dispos[j.key]?.matin}
                      onCheckedChange={() => handleToggleMatin(j.key)}
                      className="scale-90"
                    />
                  </div>
                  {!isEtages && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs">Soir</span>
                      <Switch
                        checked={dispos[j.key]?.soir}
                        onCheckedChange={() => handleToggleSoir(j.key)}
                        className="scale-90"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
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
  )
}
