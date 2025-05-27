import { Check } from "lucide-react"
import { secteursList } from "@/lib/secteurs"

interface ColonneCandidateProps {
  nomComplet: string
  secteur: string
  service: string
  semaine: string
  statutGlobal: "Dispo" | "Non Dispo"
  candidatId: string
}

export function ColonneCandidate({
  nomComplet,
  secteur,
  service,
  semaine,
  statutGlobal,
}: ColonneCandidateProps) {
  const secteurInfo = secteursList.find((s) => s.value === secteur)

  const pastilleColor =
    statutGlobal === "Dispo" ? "#8ea9db" : "#4b5563"

  return (
    <div className="p-4 border-r bg-gray-50">
      <div className="flex justify-between items-center">
        <span className="font-semibold">{nomComplet}</span>
        <div
          className="h-5 w-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: pastilleColor }}
        >
          {statutGlobal === "Dispo" ? (
            <span className="text-white text-xs font-bold">✓</span>
          ) : (
            <Check className="h-3 w-3 text-white" />
          )}
        </div>
      </div>

      {/* Étiquette secteur toujours visible en-dessous du nom */}
      {secteurInfo && (
        <div className="mt-2 text-[13px] font-semibold px-2 py-1 rounded border bg-white text-gray-800 inline-flex items-center gap-1">
          <secteurInfo.icon className="h-3 w-3" />
          {secteurInfo.label}
        </div>
      )}

      {/* Étiquette service si présent */}
      {service && (
        <div className="mt-1 text-[13px] px-2 py-1 rounded border bg-white text-gray-800">
          {service}
        </div>
      )}

      {/* Semaine toujours en bas */}
      <div className="text-[13px] text-gray-500 mt-1">{`Semaine ${semaine}`}</div>
    </div>
  )
}
