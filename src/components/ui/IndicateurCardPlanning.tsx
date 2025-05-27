import IndicateurCard from "@/components/ui/IndicateurCard"

type Props = {
  label: string
  value: number
  color: string
}

export default function IndicateurCardPlanning({ label, value, color }: Props) {
  return (
    <div className="relative">
      <IndicateurCard
        label={label}
        value={value}
        total={0}
        color={color}
      />

      {/* ✅ Correction ici */}
      <style>{`
        .relative > div > .absolute.top-2.right-3 {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
