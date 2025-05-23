import CardSecteur from "@/components/ui/CardSecteur"
import type { JourPlanning } from "@/types/types-front"
import { getWeek } from "date-fns"

type Props = {
  planning: Record<string, JourPlanning[]>
}

export function SectionSecteurs({ planning }: Props) {
  const secteurs = ["Étages", "Cuisine", "Salle", "Plonge", "Réception"]
  const semaineCourante = getWeek(new Date(), { weekStartsOn: 1 }).toString()

  const data = secteurs.map((secteur) => {
    let recherche = 0
    let validees = 0

    Object.values(planning).forEach((jours) => {
      jours.forEach((j) => {
        const week = getWeek(new Date(j.date), { weekStartsOn: 1 }).toString()
        if (j.secteur === secteur && week === semaineCourante) {
          j.commandes.forEach((cmd) => {
            if (cmd.statut === "En recherche") recherche++
            if (cmd.statut === "Validé") validees++
          })
        }
      })
    })

    return { secteur, recherche, validees }
  })

  return (
    <div className="grid grid-cols-5 gap-4 w-full">
      {data.map((s) => (
        <CardSecteur
          key={s.secteur}
          secteur={s.secteur}
          recherche={s.recherche}
          validees={s.validees}
        />
      ))}
    </div>
  )
}
