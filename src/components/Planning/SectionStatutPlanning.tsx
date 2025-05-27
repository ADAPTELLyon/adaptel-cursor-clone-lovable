import { indicateurColors } from "@/lib/colors"
import IndicateurCardPlanning from "@/components/ui/IndicateurCardPlanning"

export type StatsPlanning = {
  Dispo: number
  "Non Dispo": number
  Planifié: number
}

type Props = {
  stats: StatsPlanning
}

export default function SectionStatutPlanning({ stats }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4 w-full">
      <IndicateurCardPlanning
        label="Dispo"
        value={stats.Dispo}
        color={indicateurColors["Dispo"]}
      />
      <IndicateurCardPlanning
        label="Non Dispo"
        value={stats["Non Dispo"]}
        color={indicateurColors["Non Dispo"]}
      />
      <IndicateurCardPlanning
        label="Planifié"
        value={stats.Planifié}
        color={indicateurColors["Planifié"]}
      />
    </div>
  )
}
