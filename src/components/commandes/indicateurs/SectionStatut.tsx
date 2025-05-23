import { indicateurColors } from "@/lib/colors"
import IndicateurCard from "@/components/ui/IndicateurCard"

type Props = {
  stats: {
    demandées: number
    validées: number
    enRecherche: number
    nonPourvue: number
  }
  totauxSemaine: {
    demandées: number
    validées: number
    enRecherche: number
    nonPourvue: number
  }
}

export function SectionStatut({ stats, totauxSemaine }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4 w-full">
      <IndicateurCard
        label="Demandées"
        value={stats.demandées}
        total={totauxSemaine.demandées}
        color={indicateurColors["Demandées"]}
      />
      <IndicateurCard
        label="Validées"
        value={stats.validées}
        total={totauxSemaine.validées}
        color={indicateurColors["Validées"]}
      />
      <IndicateurCard
        label="En recherche"
        value={stats.enRecherche}
        total={totauxSemaine.enRecherche}
        color={indicateurColors["En recherche"]}
      />
      <IndicateurCard
        label="Non pourvue"
        value={stats.nonPourvue}
        total={totauxSemaine.nonPourvue}
        color={indicateurColors["Non pourvue"]}
      />
    </div>
  )
}
