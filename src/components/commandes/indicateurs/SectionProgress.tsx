import ProgressCircle from "@/components/ui/ProgressCircle"
import type { JourPlanning } from "@/types/types-front"

export default function SectionProgress({
  filteredPlanning,
}: {
  filteredPlanning: Record<string, JourPlanning[]>
}) {
  let validées = 0
  let enRecherche = 0

  Object.values(filteredPlanning).forEach((jours) =>
    jours.forEach((j) =>
      j.commandes.forEach((cmd) => {
        if (cmd.statut === "Validé") validées++
        if (cmd.statut === "En recherche") enRecherche++
      })
    )
  )

  return (
    <div className="h-[144px] w-full flex items-center justify-center">
      <ProgressCircle validées={validées} enRecherche={enRecherche} />
    </div>
  )
}
