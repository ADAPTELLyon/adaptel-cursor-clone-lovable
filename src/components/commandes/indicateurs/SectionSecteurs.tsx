import { CheckCircle } from "lucide-react"
import { getWeek } from "date-fns"
import type { JourPlanning } from "@/types/types-front"
import { secteursList } from "@/lib/secteurs"
import { statutColors } from "@/lib/colors"

type Props = {
  planning: Record<string, JourPlanning[]>
}

export function SectionSecteurs({ planning }: Props) {
  const semaineCourante = getWeek(new Date(), { weekStartsOn: 1 }).toString()

  const data = secteursList.map(({ label, icon: Icon }) => {
    let recherche = 0
    let validees = 0

    Object.values(planning).forEach((jours) => {
      jours.forEach((j) => {
        const week = getWeek(new Date(j.date), { weekStartsOn: 1 }).toString()
        if (j.secteur === label && week === semaineCourante) {
          j.commandes.forEach((cmd) => {
            if (cmd.statut === "En recherche") recherche++
            if (cmd.statut === "Validé") validees++
          })
        }
      })
    })

    return { secteur: label, Icon, recherche, validees }
  })

  return (
    <div className="grid grid-cols-5 gap-2 w-full">
      {data.map(({ secteur, Icon, recherche }) => {
        const isOk = recherche === 0
        const bgColor = isOk
          ? statutColors["Validé"].bg
          : statutColors["En recherche"].bg
        const textColor = isOk
          ? statutColors["Validé"].text
          : statutColors["En recherche"].text

        return (
          <div
            key={secteur}
            className="flex items-center justify-between px-3 h-[44px] rounded-lg shadow-sm"
            style={{ backgroundColor: bgColor, color: textColor }}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Icon className="w-4 h-4" />
              {secteur}
            </div>
            <div className="text-sm font-bold">
              {isOk ? (
                <CheckCircle className="w-4 h-4 text-green-700" />
              ) : (
                <span className="text-sm">{recherche}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
