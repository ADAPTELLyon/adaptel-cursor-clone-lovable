import CardPlanningStatut from "@/components/ui/CardPlanningStatut"
import { indicateurColors } from "@/lib/colors"

type Props = {
  stats: {
    Dispo: number
    "Non Dispo": number
    Planifié: number
  }
}

export default function SectionStatutPlanning({ stats }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <CardPlanningStatut
        statut="Dispo"
        count={stats.Dispo}
      />
      <CardPlanningStatut
        statut="Non Dispo"
        count={stats["Non Dispo"]}
      />
      <CardPlanningStatut
        statut="Planifié"
        count={stats.Planifié}
      />
    </div>
  )
}
