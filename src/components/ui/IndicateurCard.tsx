import { cn } from "@/lib/utils"

export default function IndicateurCard({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  return (
    <div className="relative w-[200px] min-h-[80px] bg-white shadow-sm border rounded-md flex flex-col justify-between px-4 py-3">
      {/* Liseré couleur à gauche */}
      <div
        className="absolute top-0 left-0 h-full w-2 rounded-l-md"
        style={{ backgroundColor: color }}
      />

      {/* Terme du statut */}
      <div className="text-sm font-semibold mb-1" style={{ color }}>
        {label}
      </div>

      {/* Valeur centrale colorée */}
      <div className="text-3xl font-bold" style={{ color }}>
        {value}
      </div>

      {/* Total en haut à droite */}
      <div
        className="absolute top-2 right-3 text-xs font-semibold"
        style={{ color }}
      >
        {total}
      </div>
    </div>
  )
}
