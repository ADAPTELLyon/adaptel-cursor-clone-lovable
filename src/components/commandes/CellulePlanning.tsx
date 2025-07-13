// src/components/commandes/CellulePlanning.tsx

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Plus, Info, Pencil, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { statutColors, statutBorders } from "@/lib/colors"
import type { CommandeWithCandidat } from "@/types/types-front"
import { CommandeJourneeDialog } from "@/components/commandes/CommandeJourneeDialog"
import { PlanificationCandidatDialog } from "@/components/commandes/PlanificationCandidatDialog"
import { PopoverPlanificationRapide } from "@/components/commandes/PopoverPlanificationRapide"
import { PopoverChangementStatut } from "@/components/commandes/PopoverChangementStatut"

interface CellulePlanningProps {
  commande?: CommandeWithCandidat
  secteur: string
  editId: string | null
  heureTemp: Record<string, string>
  setEditId: (val: string | null) => void
  setHeureTemp: React.Dispatch<React.SetStateAction<Record<string, string>>>
  updateHeure: (
    commande: CommandeWithCandidat,
    champ: keyof CommandeWithCandidat,
    value: string
  ) => Promise<void>
  commentaireTemp: string
  setCommentaireTemp: (val: string) => void
  editingCommentId: string | null
  setEditingCommentId: (val: string | null) => void
  date: string
  clientId: string
  service?: string | null
  onSuccess?: () => void
  lastClickedCommandeId?: string | null
  missionSlot: number
}

export function CellulePlanning({
  commande,
  secteur,
  editId,
  heureTemp,
  setEditId,
  setHeureTemp,
  updateHeure,
  commentaireTemp,
  setCommentaireTemp,
  editingCommentId,
  setEditingCommentId,
  date,
  clientId,
  service,
  onSuccess,
  lastClickedCommandeId,
  missionSlot,
}: CellulePlanningProps) {
  const isEtages = secteur === "Étages"
  const [openDialog, setOpenDialog] = useState(false)
  const [openPlanifDialog, setOpenPlanifDialog] = useState(false)

  if (!commande) {
    return (
      <>
        <div
          className="h-full bg-gray-100 rounded flex items-center justify-center cursor-pointer hover:bg-gray-200"
          onClick={() => setOpenDialog(true)}
        >
          <Plus className="h-4 w-4 text-gray-400" />
        </div>
        <CommandeJourneeDialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          date={date}
          clientId={clientId}
          secteur={secteur}
          service={service}
          missionSlot={missionSlot}
          onSuccess={onSuccess}
        />
      </>
    )
  }

  const statutColor = statutColors[commande.statut] || { bg: "#e5e7eb", text: "#000000" }
  const borderColor = statutBorders[commande.statut] || "#d1d5db"

  return (
    <div
      className={cn(
        "h-full rounded p-2 text-xs flex flex-col justify-start gap-1 border relative"
      )}
      style={{
        backgroundColor: statutColor.bg,
        color: statutColor.text,
        borderLeft: `5px solid ${borderColor}`,
      }}
    >
<PopoverChangementStatut
  commande={commande}
  onSuccess={onSuccess || (() => {})}
  trigger={
    <div className="cursor-pointer min-h-[2.5rem] leading-tight font-semibold">
      {commande.statut === "Validé" && commande.candidat ? (
        <div className="flex flex-col">
          <div className="text-sm font-bold leading-tight whitespace-nowrap">
            {commande.candidat.nom}
          </div>
          <div className="text-xs font-medium leading-tight whitespace-nowrap">
            {commande.candidat.prenom}
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="text-sm font-semibold leading-tight whitespace-nowrap">
            {commande.statut}
          </div>
          <div className="text-xs font-normal min-h-[1.1rem] whitespace-nowrap">
            &nbsp;
          </div>
        </div>
      )}
    </div>
  }
/>

      <div className="text-[13px] font-semibold mt-1 space-y-1">
        {["matin", ...(isEtages ? [] : ["soir"])].map((creneau) => {
          const heureDebut = commande[`heure_debut_${creneau}` as keyof CommandeWithCandidat] ?? ""
          const heureFin = commande[`heure_fin_${creneau}` as keyof CommandeWithCandidat] ?? ""
          const keyDebut = `${commande.id}-${creneau}-debut`
          const keyFin = `${commande.id}-${creneau}-fin`

          return (
            <div key={creneau} className="flex gap-1 items-center">
              {[{ key: keyDebut, value: heureDebut, champ: `heure_debut_${creneau}` },
                { key: keyFin, value: heureFin, champ: `heure_fin_${creneau}` }
              ].map(({ key, value, champ }) => (
                editId === key ? (
                  <Input
                    key={key}
                    type="time"
                    value={String(heureTemp[key] ?? value).slice(0, 5)}
                    autoFocus
                    onChange={(e) =>
                      setHeureTemp((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    onBlur={async () => {
                      const rawValue = heureTemp[key] ?? ""
                      await updateHeure(commande, champ as keyof CommandeWithCandidat, rawValue)
                      setHeureTemp((prev) => ({ ...prev, [key]: rawValue }))
                      setEditId(null)
                      if (onSuccess) onSuccess()
                    }}
                    className="w-16 text-[13px] px-1 rounded text-black bg-transparent border-none focus:border focus:bg-white"
                  />
                ) : (
                  <span
                    key={key}
                    onClick={() => {
                      setEditId(key)
                      setHeureTemp((prev) => ({ ...prev, [key]: String(value) }))
                    }}
                    className="cursor-pointer hover:underline"
                  >
                    {String(value).slice(0, 5) || "–"}
                  </span>
                )
              ))}
            </div>
          )
        })}
      </div>

      {["En recherche", "Validé"].includes(commande.statut) && (
        <PopoverPlanificationRapide
          commande={commande}
          date={date}
          secteur={secteur}
          onRefresh={onSuccess || (() => {})}
          trigger={
            <button
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-white/60 flex items-center justify-center hover:bg-white/80 transition"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="h-3 w-3 text-gray-400" />
            </button>
          }
          onOpenListes={() => setOpenPlanifDialog(true)}
        />
      )}

      <div className="absolute bottom-2 right-1 z-20">
        <Popover
          open={editingCommentId === commande.id}
          onOpenChange={(open) => !open && setEditingCommentId(null)}
        >
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "p-0 h-auto w-auto",
                commande.commentaire ? "text-gray-800" : "text-white"
              )}
              onClick={(e) => {
                e.stopPropagation()
                setEditingCommentId(commande.id)
                setCommentaireTemp(commande.commentaire || "")
              }}
            >
              {commande.commentaire ? (
                <Info className="h-4 w-4" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 space-y-2">
            <textarea
              value={commentaireTemp}
              onChange={(e) => setCommentaireTemp(e.target.value)}
              rows={4}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await updateHeure(commande, "commentaire", commentaireTemp)
                  setEditingCommentId(null)
                  if (onSuccess) onSuccess()
                }}
              >
                <Check className="w-4 h-4 text-green-600" />
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <PlanificationCandidatDialog
        open={openPlanifDialog}
        onClose={() => setOpenPlanifDialog(false)}
        date={date}
        secteur={secteur}
        service={service || ""}
        onSuccess={onSuccess || (() => {})}
        commande={commande}
      />
    </div>
  )
}
