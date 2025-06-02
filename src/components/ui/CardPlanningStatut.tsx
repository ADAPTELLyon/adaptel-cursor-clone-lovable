import { cn } from "@/lib/utils"
import { indicateurColors } from "@/lib/colors"

export default function CardPlanningStatut({
  statut,
  count,
}: {
  statut: "Dispo" | "Non Dispo" | "Planifié"
  count: number
}) {
  const color = indicateurColors[statut] || "#ccc"

  return (
    <div className="relative bg-white shadow-sm border rounded-md flex flex-col justify-between px-4 py-3 h-[80px]">
      {/* Liseré vertical gauche */}
      <div
        className="absolute top-0 left-0 h-full w-2 rounded-l-md"
        style={{ backgroundColor: color }}
      />

      {/* Libellé statut */}
      <div className="text-sm font-semibold mb-1" style={{ color }}>
        {statut}
      </div>

      {/* Valeur principale */}
      <div className="text-3xl font-bold ml-4" style={{ color }}>
        {count}
      </div>
    </div>
  )
}
