import { Check } from "lucide-react"
import { secteursList } from "@/lib/secteurs"

export interface ColonneCandidateProps {
  nomComplet: string
  secteur: string
  service?: string | null
  semaine: string
  statutGlobal: string
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

  return (
    <div className="p-4 border-r bg-gray-50">
      <div className="flex justify-between items-center">
        <span className="font-semibold">{nomComplet}</span>

        <div
          className={`h-5 w-5 rounded-full ${
            statutGlobal === "Dispo"
              ? "bg-[#8ea9db]"
              : statutGlobal === "Non Dispo"
              ? "bg-[#4b5563]"
              : "bg-gray-300"
          } flex items-center justify-center`}
        >
          {statutGlobal === "Dispo" && <Check className="h-3 w-3 text-white" />}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-1">
        {secteurInfo && (
          <div className="text-[13px] font-semibold px-2 py-1 rounded border bg-white text-gray-800 flex items-center gap-1">
            <secteurInfo.icon className="h-3 w-3" />
            {secteurInfo.label}
          </div>
        )}
        {service && (
          <div className="text-[13px] px-2 py-1 rounded border bg-white text-gray-800">
            {service}
          </div>
        )}
      </div>

      <div className="text-[13px] text-gray-500 mt-1">{`Semaine ${semaine}`}</div>
    </div>
  )
}
