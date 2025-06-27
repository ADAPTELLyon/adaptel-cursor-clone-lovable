import { Clock, Check } from "lucide-react"
import { secteursList } from "@/lib/secteurs"
import { Icon } from "@iconify/react"
import { HistoriqueCommandeDialog } from "@/components/commandes/HistoriqueCommandeDialog"
import type { CommandeWithCandidat } from "@/types/types-front"

interface ColonneClientProps {
  clientNom: string
  secteur: string
  service?: string | null
  semaine: string
  nbEnRecherche: number
  commandeIdsLigne: string[]
  semaineDate: string
  commandes: CommandeWithCandidat[]
}

function calculerHeuresTotales(commandes: CommandeWithCandidat[]) {
  let totalMinutes = 0

  const toMinutes = (heure?: string | null) => {
    if (!heure) return 0
    const [h, m] = heure.split(":").map(Number)
    return h * 60 + m
  }

  for (const cmd of commandes) {
    if (cmd.statut === "Validé" || cmd.statut === "En recherche") {
      totalMinutes += toMinutes(cmd.heure_fin_matin) - toMinutes(cmd.heure_debut_matin)
      totalMinutes += toMinutes(cmd.heure_fin_soir) - toMinutes(cmd.heure_debut_soir)
    }
  }

  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

export function ColonneClient({
  clientNom,
  secteur,
  service,
  semaine,
  nbEnRecherche,
  commandeIdsLigne,
  semaineDate,
  commandes,
}: ColonneClientProps) {
  const secteurInfo = secteursList.find((s) => s.value === secteur)
  const totalHeures = calculerHeuresTotales(commandes)

  return (
    <div className="p-3 border-r bg-white h-full flex flex-col justify-between text-sm leading-tight relative">
      {/* Ligne 1 : Nom client + pastille */}
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-[14px] leading-snug break-words">{clientNom}</span>
        <div
          className="h-5 w-5 rounded-full flex items-center justify-center text-white text-xs font-bold shadow"
          style={{ backgroundColor: nbEnRecherche > 0 ? '#fdba74' : '#a9d08e' }}
        >
          {nbEnRecherche > 0 ? '!' : <Check className="w-3 h-3" />}
        </div>
      </div>

      {/* Ligne 2 : Étiquettes */}
      <div className="flex flex-wrap gap-1 items-center mb-2">
        {secteurInfo && (
          <div className="text-[13px] font-medium px-2 py-[2px] rounded bg-gray-100 text-gray-800 flex items-center gap-1 border">
            <span>{secteurInfo.emoji}</span>
            {secteurInfo.label}
          </div>
        )}
        {service && (
          <div className="text-[13px] px-2 py-[2px] rounded bg-gray-100 text-gray-700 border">
            {service}
          </div>
        )}
      </div>

      {/* Ligne 3 : Icône loupe + semaine + heure */}
      <div className="flex items-center gap-2 text-[13px] text-gray-600">
        <HistoriqueCommandeDialog
          commandeIds={commandeIdsLigne}
          secteur={secteur}
          semaineDate={semaineDate}
        >
          <Icon
            icon="fluent:search-square-20-regular"
            width={25}
            height={25}
            className="text-gray-700"
          />
        </HistoriqueCommandeDialog>

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
