import { SectionStatut } from "./indicateurs/SectionStatut"
import { SectionSecteurs } from "./indicateurs/SectionSecteurs"
import SectionProgress from "./indicateurs/SectionProgress"
import { SectionComparatif } from "./indicateurs/SectionComparatif"
import type { JourPlanning } from "@/types/types-front"

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
  planning: Record<string, JourPlanning[]>
  filteredPlanning: Record<string, JourPlanning[]>
}

export function CommandesIndicateurs({
  stats,
  totauxSemaine,
  planning,
  filteredPlanning,
}: Props) {
  return (
    <div className="bg-white rounded-md shadow-sm p-6 w-full">
      <div className="flex w-full gap-6 items-start">
        {/* Gauche : Cards + Secteurs */}
        <div className="flex flex-col gap-4 w-3/4">
          <SectionStatut stats={stats} totauxSemaine={totauxSemaine} />
          <SectionSecteurs planning={planning} />
        </div>

        {/* Droite : Cercle + Comparatif */}
        <div className="w-1/4 h-full">
          <div className="flex h-full gap-4">
            <div className="w-1/2 h-full flex items-center justify-center">
              <SectionProgress filteredPlanning={filteredPlanning} />
            </div>
            <div className="w-1/2 h-full flex flex-col justify-between">
              <SectionComparatif />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
