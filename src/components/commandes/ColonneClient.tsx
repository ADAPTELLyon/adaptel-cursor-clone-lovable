import { Clock, Check } from "lucide-react"
import { secteursList } from "@/lib/secteurs"
import { Icon } from "@iconify/react"
import { HistoriqueCommandeDialog } from "@/components/commandes/HistoriqueCommandeDialog"
import FicheMemoClient from "@/components/clients/FicheMemoClient"
import { useState } from "react"
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
  clientId: string
  onOpenClientEdit?: (clientId: string) => void;
  onOpenCommandeEdit?: (commande: CommandeWithCandidat) => void;
}

/**
 * Calcule la durée (en minutes) entre deux heures "HH:MM".
 * Gère les créneaux qui passent minuit (ex: 18:00 -> 02:00).
 */
function diffMinutes(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return 0

  const s = sh * 60 + sm
  let e = eh * 60 + em

  // Si la fin est inférieure ou égale au début, on considère que ça passe minuit
  if (e <= s) e += 24 * 60

  return Math.max(0, e - s)
}

function calculerHeuresTotales(commandes: CommandeWithCandidat[]) {
  let totalMinutes = 0

  for (const cmd of commandes) {
    if (cmd.statut === "Validé" || cmd.statut === "En recherche") {
      // Matin/Midi
      totalMinutes += diffMinutes(
        (cmd as any).heure_debut_matin,
        (cmd as any).heure_fin_matin
      )
      // Soir
      totalMinutes += diffMinutes(
        (cmd as any).heure_debut_soir,
        (cmd as any).heure_fin_soir
      )
      // Nuit (si présent dans la table / le type)
      if ("heure_debut_nuit" in (cmd as any) || "heure_fin_nuit" in (cmd as any)) {
        totalMinutes += diffMinutes(
          (cmd as any).heure_debut_nuit,
          (cmd as any).heure_fin_nuit
        )
      }
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
  clientId,
  onOpenClientEdit, 
  onOpenCommandeEdit, // nouvelle prop pour gestion du click sur la 2e loupe
}: ColonneClientProps) {
  const secteurInfo = secteursList.find((s) => s.value === secteur)
  const [openMemo, setOpenMemo] = useState(false)
  const totalHeures = calculerHeuresTotales(commandes)

  return (
    <div className="p-3 border-r bg-white h-full flex flex-col justify-between text-sm leading-tight relative">
      {/* Ligne 1 : Nom client + pastille */}
      <div className="flex justify-between items-center mb-1">
        <span
          className="font-bold text-[14px] leading-snug break-words cursor-pointer hover:underline"
          onClick={() => setOpenMemo(true)}
        >
          {clientNom}
        </span>
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

      {/* Ligne 3 : Icône loupe + semaine + heure + DUPLICATION de la loupe après les heures */}
      <div className="flex items-center gap-2 text-[13px] text-gray-600">
        {/* Loupe historique */}
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

        {/* Vignette semaine */}
        <div className="h-5 w-5 rounded bg-gray-900 text-white text-xs flex items-center justify-center font-semibold">
          {semaine}
        </div>

        {/* Heures */}
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>{totalHeures}</span>
        </div>

        {/* icone modification commande*/}
        <div
          className="cursor-pointer"
          onClick={() => onOpenCommandeEdit && onOpenCommandeEdit(commandes[0])}
          style={{ marginLeft: -2 }}
        >
          <Icon
            icon="fluent:add-square-20-regular"
            width={25}
            height={25}
            className="text-gray-700"
          />
        </div>
      </div>

      {/* Fiche mémo client */}
      {openMemo && (
        <FicheMemoClient
          open={openMemo}
          onOpenChange={() => setOpenMemo(false)}
          clientId={clientId}
          onOpenClientEdit={onOpenClientEdit}
        />
      )}
    </div>
  )
}
