import { format, startOfWeek, addDays, getWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { Check } from "lucide-react"
import { indicateurColors } from "@/lib/colors"
import type { JourPlanning } from "@/types/types-front"

interface Props {
  semaine: string
  secteur: string
  lignes: JourPlanning[]
  offset: number
}

export function EntetePlanningFixe({ semaine, secteur, lignes, offset }: Props) {
  const baseDate = startOfWeek(new Date(), { weekStartsOn: 1 })
  const semaineDiff = parseInt(semaine) - getWeek(baseDate, { weekStartsOn: 1 })
  const lundiSemaine = addDays(baseDate, semaineDiff * 7)

  const jours = Array.from({ length: 7 }, (_, i) => {
    const jour = addDays(lundiSemaine, i)
    const dateStr = format(jour, "yyyy-MM-dd")
    return {
      date: jour,
      dateStr,
      label: format(jour, "eeee dd MMMM", { locale: fr }),
    }
  })

  return (
    <div
      className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] text-sm font-medium text-white shadow sticky z-[10] bg-white border-b"
      style={{ top: `${offset}px` }}
    >
      <div className="p-3 border-r text-center text-gray-800 bg-gray-100">
        {`Semaine ${semaine} • ${secteur}`}
      </div>
      {jours.map((jour, index) => {
        let total = 0
        let enRecherche = 0

        lignes.forEach((j) => {
          if (format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr) {
            total += j.commandes.length
            enRecherche += j.commandes.filter((c) => c.statut === "En recherche").length
          }
        })

        return (
          <div
            key={index}
            className="p-3 border-r text-center relative text-gray-800 bg-gray-100"
          >
            <div>{jour.label.split(" ")[0]}</div>
            <div className="text-xs">{jour.label.split(" ").slice(1).join(" ")}</div>
            {total === 0 ? (
              <div className="absolute top-1 right-1">
                <div className="h-5 w-5 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">–</div>
              </div>
            ) : enRecherche > 0 ? (
              <div
                className="absolute top-1 right-1 h-5 w-5 text-xs rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: indicateurColors["En recherche"],
                  color: "white",
                }}
              >
                {enRecherche}
              </div>
            ) : (
              <div className="absolute top-1 right-1">
                <div className="h-5 w-5 rounded-full bg-[#a9d08e] flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
