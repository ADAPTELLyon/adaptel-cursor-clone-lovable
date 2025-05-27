import IndicateurCard from "@/components/ui/IndicateurCard"
import type { JourPlanningCandidat } from "@/types/types-front"

type Props = {
  planning: Record<string, JourPlanningCandidat[]>
}

export function CandidatsIndicateurs({ planning }: Props) {
  let dispo = 0
  let nonDispo = 0
  let planifie = 0

  Object.values(planning).forEach((jours) => {
    jours.forEach((j) => {
      if (j.disponibilite?.statut === "Dispo") dispo++
      else if (j.disponibilite?.statut === "Non Dispo") nonDispo++
      if (j.commande?.candidat_id) planifie++
    })
  })

  return (
    <div className="grid grid-cols-3 gap-4">
      <IndicateurCard label="Dispo" value={dispo} total={dispo} color="Dispo" />
      <IndicateurCard label="Non Dispo" value={nonDispo} total={nonDispo} color="Non Dispo" />
      <IndicateurCard label="Planifié" value={planifie} total={planifie} color="Planifié" />
    </div>
  )
}
