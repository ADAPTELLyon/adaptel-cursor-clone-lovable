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
    <div className="relative bg-white shadow-sm border rounded-md flex flex-col justify-between px-4 py-3 h-[80px]">
      {/* Liseré couleur à gauche */}
      <div
        className="absolute top-0 left-0 h-full w-2 rounded-l-md"
        style={{ backgroundColor: color }}
      />

      {/* Libellé */}
      <div className="text-sm font-semibold mb-1" style={{ color }}>
        {label}
      </div>

      {/* Valeur principale : légèrement décalée */}
      <div className="text-3xl font-bold ml-4" style={{ color }}>
        {value}
      </div>

      {/* Total semaine : plus grand */}
      <div
        className="absolute top-2 right-3 text-sm font-semibold"
        style={{ color }}
      >
        {total}
      </div>
    </div>
  )
}
