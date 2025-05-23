import { Check, AlertTriangle } from "lucide-react"

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

  const couleur = hasNoData || allValidées ? "#a9d08e" : "#fdba74"

  return (
    <div className="relative w-[200px] h-[200px] flex items-center justify-center">
      <svg width="180" height="180" className="drop-shadow-sm">
        <circle
          stroke={couleur}
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx="90"
          cy="90"
          transform="rotate(-90 90 90)"
        />
      </svg>

      <div className="absolute flex items-center justify-center">
        {hasNoData || allValidées ? (
          <Check className="w-12 h-12" style={{ color: "#a9d08e" }} />
        ) : (
          <AlertTriangle className="w-12 h-12" style={{ color: "#fdba74" }} />
        )}
      </div>
    </div>
  )
}
