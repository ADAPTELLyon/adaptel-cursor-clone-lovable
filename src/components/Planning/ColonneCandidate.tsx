import { Clock, Check } from "lucide-react"
import { secteursList } from "@/lib/secteurs"

export interface ColonneCandidateProps {
  nomComplet: string
  secteur: string
  semaine: string
  statutGlobal: string
  candidatId: string
  totalHeures: string
}

export function ColonneCandidate({
  nomComplet,
  secteur,
  semaine,
  statutGlobal,
  totalHeures,
}: ColonneCandidateProps) {
  const secteurInfo = secteursList.find((s) => s.value === secteur)

  return (
    <div className="p-3 border-r bg-gray-50 h-full flex flex-col justify-between text-sm leading-tight relative">
      {/* Ligne 1 : Nom candidat + pastille statut */}
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-[14px] leading-snug break-words">{nomComplet}</span>
        <div
          className="h-5 w-5 rounded-full flex items-center justify-center text-white text-xs font-bold shadow"
          style={{ backgroundColor: statutGlobal === "Dispo" ? "#8ea9db" : "#4b5563" }}
        >
          {statutGlobal === "Dispo" ? <Check className="w-3 h-3" /> : "–"}
        </div>
      </div>

      {/* Ligne 2 : étiquette secteur */}
      <div className="flex flex-wrap gap-1 items-center mb-2">
        {secteurInfo && (
          <div
            className="text-[13px] font-medium px-2 py-[2px] rounded bg-gray-200 text-gray-800 flex items-center gap-1 border"
          >
            <span>{secteurInfo.emoji}</span>
            {secteurInfo.label}
          </div>
        )}
      </div>

      {/* Ligne 3 : semaine + total heures */}
      <div className="flex items-center gap-2 text-[13px] text-gray-600">
        <div className="h-5 w-5 rounded bg-gray-900 text-white text-xs flex items-center justify-center font-semibold">
          {semaine}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>{totalHeures}</span>
        </div>
      </div>
    </div>
  )
}
