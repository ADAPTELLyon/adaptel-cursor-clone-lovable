import { ArrowUp, ArrowDown } from "lucide-react"
import { indicateurColors } from "@/lib/colors"

export function SectionComparatif() {
  const missionsAnneeN1 = 100
  const missionsActuelles = 85
  const joursRestants = 3

  const difference = missionsActuelles - missionsAnneeN1
  const objectifRestant = Math.max(0, Math.ceil((missionsAnneeN1 - missionsActuelles) / joursRestants))
  const isSup = difference >= 0

  const borderColor = isSup
    ? indicateurColors["Validées"]
    : indicateurColors["Non pourvue"]

  return (
    <div className="flex flex-col gap-4 h-full justify-between">
      {/* Comparatif N-1 */}
      <div
        className="flex justify-between items-center rounded-md px-4 py-2 bg-white shadow-sm h-[80px] border-l-[6px]"
        style={{ borderColor }}
      >
        <div className="flex flex-col text-sm">
          <span className="text-muted-foreground font-medium">Comparatif N-1</span>
          <span className="font-bold text-2xl">
            {Math.abs(difference)}
          </span>
        </div>
        <div className="flex items-center">
          {isSup ? (
            <ArrowUp className="w-9 h-9" style={{ color: indicateurColors["Validées"] }} />
          ) : (
            <ArrowDown className="w-9 h-9" style={{ color: indicateurColors["Non pourvue"] }} />
          )}
        </div>
      </div>

      {/* Cible journée */}
      <div
        className="flex justify-between items-center rounded-md px-4 py-2 bg-white shadow-sm h-[60px] border-l-[6px] border-gray-300"
      >
        <div className="flex flex-col text-sm">
          <span className="text-muted-foreground font-medium">Cible journée</span>
          <span className="font-bold text-xl">{objectifRestant}</span>
        </div>
      </div>
    </div>
  )
}
