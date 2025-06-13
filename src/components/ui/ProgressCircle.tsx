import { Check } from "lucide-react"

export default function ProgressCircle({
  validées,
  enRecherche,
}: {
  validées: number
  enRecherche: number
}) {
  const total = validées + enRecherche
  const hasNoData = total === 0
  const allValidées = total > 0 && enRecherche === 0

  const radius = 80
  const stroke = 14
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI

  const pourcentage = total > 0 ? (validées / total) * 100 : 0
  const strokeDashoffset = circumference - (pourcentage / 100) * circumference

  return (
    <div className="relative w-[200px] h-[200px] flex items-center justify-center">
      <svg width="180" height="180" className="drop-shadow-sm">
        <circle
          stroke="#e5e7eb"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx="90"
          cy="90"
        />
        <circle
          stroke="#a9d08e"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          r={normalizedRadius}
          cx="90"
          cy="90"
          transform="rotate(-90 90 90)"
        />
      </svg>

      <div className="absolute flex items-center justify-center text-xl font-semibold">
        {hasNoData ? (
          <span className="text-gray-400">–</span>
        ) : allValidées ? (
          <Check className="w-12 h-12 text-[#a9d08e]" />
        ) : (
          <span className="text-[#a9d08e]">{Math.round(pourcentage)}%</span>
        )}
      </div>
    </div>
  )
}
