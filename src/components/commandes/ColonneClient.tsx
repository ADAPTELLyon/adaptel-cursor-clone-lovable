import { Check } from "lucide-react"
import { secteursList } from "@/lib/secteurs"
import { HistoriqueCommandeDialog } from "@/components/commandes/HistoriqueCommandeDialog"

interface ColonneClientProps {
  clientNom: string
  secteur: string
  service?: string | null
  semaine: string
  nbEnRecherche: number
  commandeIdsLigne: string[]
}

export function ColonneClient({
  clientNom,
  secteur,
  service,
  semaine,
  nbEnRecherche,
  commandeIdsLigne,
}: ColonneClientProps) {
  const secteurInfo = secteursList.find((s) => s.value === secteur)

  return (
    <div className="p-4 border-r bg-gray-50">
      <div className="flex justify-between items-center">
        <span className="font-semibold">{clientNom}</span>
        {commandeIdsLigne?.length > 0 && (
          <div className="h-5 w-5 rounded-full bg-white border shadow flex items-center justify-center">
            <HistoriqueCommandeDialog commandeIds={commandeIdsLigne} />
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-1">
        <div className="flex flex-wrap gap-2">
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

        {nbEnRecherche > 0 ? (
          <div className="h-5 w-5 rounded-full bg-[#fdba74] flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full bg-[#a9d08e] flex items-center justify-center">
            <Check className="h-3 w-3 text-white" />
          </div>
        )}
      </div>

      <div className="text-[13px] text-gray-500 mt-1">{`Semaine ${semaine}`}</div>
    </div>
  )
}
