import { indicateurColors } from "@/lib/colors"
import { secteursList } from "@/lib/secteurs"

type Props = {
  secteur: string
  recherche: number
  validees: number
}

export default function CardSecteur({ secteur, recherche, validees }: Props) {
  const config = secteursList.find((s) => s.label === secteur)
  const isValidé = recherche === 0
  const color = isValidé
    ? indicateurColors["Validées"]
    : indicateurColors["En recherche"]

  return (
    <div className="w-full h-[64px] flex items-center justify-between px-4 py-2">
      {/* Marqueur vertical + nom secteur */}
      <div className="flex items-center gap-2">
        <div
          className="w-1 h-4 rounded-sm"
          style={{ backgroundColor: color }}
        />
        {config?.icon && <config.icon className="w-4 h-4 text-muted-foreground" />}
        <span className="text-sm font-medium">{secteur}</span>
      </div>

      {/* Données cercles */}
      <div className="flex gap-2">
        <div
          className="w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center"
          style={{
            borderColor: indicateurColors["En recherche"],
            color: indicateurColors["En recherche"],
            borderWidth: "2px",
          }}
        >
          {recherche}
        </div>
        <div
          className="w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center"
          style={{
            borderColor: indicateurColors["Validées"],
            color: indicateurColors["Validées"],
            borderWidth: "2px",
          }}
        >
          {validees}
        </div>
      </div>
    </div>
  )
}
