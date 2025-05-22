import { Check } from "lucide-react"

export default function ProgressCircle({ taux }: { taux: number }) {
  const isComplete = taux === 0 || taux >= 100
  const radius = 60
  const stroke = 12
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = isComplete
    ? 0
    : circumference - (taux / 100) * circumference

  const couleur = isComplete ? "#a9d08e" : "#fdba74" // vert si 0% ou 100%, orange sinon
  const background = "#e5e7eb"

  return (
    <div className="w-[180px] h-[180px] flex items-center justify-center">
      <svg width="180" height="180" className="drop-shadow-sm">
        <circle
          stroke={background}
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx="90"
          cy="90"
        />
        <circle
          stroke={couleur}
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          r={normalizedRadius}
          cx="90"
          cy="90"
        />
      </svg>
      <div className="absolute flex items-center justify-center">
        {isComplete ? (
          <Check className="w-10 h-10 text-[#a9d08e]" />
        ) : (
          <span className="text-3xl font-bold" style={{ color: couleur }}>
            {taux}%
          </span>
        )}
      </div>
    </div>
  )
}
