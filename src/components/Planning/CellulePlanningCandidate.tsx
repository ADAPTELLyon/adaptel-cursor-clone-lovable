import { useState } from "react"
import { cn } from "@/lib/utils"
import { Info, Check } from "lucide-react"
import { disponibiliteColors, statutColors, statutBorders } from "@/lib/colors"
import { CandidateJourneeDialog } from "@/components/Planning/CandidateJourneeDialog"
import type { CandidatDispoWithNom, CommandeFull } from "@/types/types-front"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface CellulePlanningCandidateProps {
  disponibilite?: CandidatDispoWithNom
  commande?: CommandeFull
  autresCommandes?: CommandeFull[]
  secteur: string
  date: string
  candidatId: string
  service: string
  nomPrenom: string
  onSuccess: () => void
}

export function CellulePlanningCandidate({
  disponibilite,
  commande,
  autresCommandes = [],
  secteur,
  date,
  candidatId,
  service,
  nomPrenom,
  onSuccess,
}: CellulePlanningCandidateProps) {
  const [open, setOpen] = useState(false)
  const [commentaireTemp, setCommentaireTemp] = useState(disponibilite?.commentaire || "")
  const [editingComment, setEditingComment] = useState(false)

  const isPlanifie = !!commande
  const statut = isPlanifie ? "Validé" : (disponibilite?.statut ?? "Non renseigné")
  const matin = disponibilite?.matin ?? false
  const soir = disponibilite?.soir ?? false

  const couleur =
    statutColors[statut] ?? disponibiliteColors[statut] ?? { bg: "#e5e7eb", text: "#000000" }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "h-full rounded p-2 text-xs border flex flex-col justify-start relative cursor-pointer"
            )}
            style={{
              backgroundColor: couleur.bg,
              color: couleur.text,
              borderLeft: `5px solid ${statutBorders[statut] || "transparent"}`,
            }}
            onClick={() => {
              if (isPlanifie) {
                toast({
                  title: "Candidat en mission",
                  description: "Impossible de modifier la disponibilité.",
                  variant: "default",
                })
                return
              }
              setOpen(true)
            }}
          >
            {/* ligne 1 : statut ou client */}
            <div className="font-semibold text-[13px] leading-tight min-h-[1.2rem]">
              {isPlanifie
                ? commande?.client?.nom || "Mission validée"
                : statut !== "Non renseigné"
                ? statut
                : ""}
            </div>

            {/* ligne 2 : vide (pas de prénom) */}
            <div className="text-xs font-normal min-h-[1rem]">&nbsp;</div>

            {/* ligne 3 : créneau matin */}
            <div className="text-[13px] font-bold min-h-[1rem]">
              {isPlanifie && commande?.heure_debut_matin && commande?.heure_fin_matin
                ? `${commande.heure_debut_matin.slice(0, 5)} - ${commande.heure_fin_matin.slice(0, 5)}`
                : statut === "Dispo" && matin
                ? "Matin / Midi"
                : ""}
            </div>

            {/* ligne 4 : créneau soir */}
            <div className="text-[13px] font-bold min-h-[1rem]">
              {secteur !== "Étages" &&
                (isPlanifie && commande?.heure_debut_soir && commande?.heure_fin_soir
                  ? `${commande.heure_debut_soir.slice(0, 5)} - ${commande.heure_fin_soir.slice(0, 5)}`
                  : statut === "Dispo" && soir
                  ? "Soir"
                  : "")}
            </div>

            {/* commentaire éventuel */}
            {disponibilite?.commentaire && (
              <div
                className="absolute bottom-1 right-1 z-20"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingComment(true)
                  setCommentaireTemp(disponibilite.commentaire || "")
                }}
              >
                <Popover open={editingComment} onOpenChange={(open) => !open && setEditingComment(false)}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className="p-0 h-auto w-auto text-black hover:text-black">
                      <Info className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2 space-y-2 text-sm">
                    <textarea
                      value={commentaireTemp}
                      onChange={(e) => setCommentaireTemp(e.target.value)}
                      rows={4}
                      className="w-full border rounded px-2 py-1"
                    />
                    <div className="flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => {
                        toast({ title: "Commentaire mis à jour" })
                        setEditingComment(false)
                        onSuccess()
                      }}>
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-sm capitalize">
  {date &&
    new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Paris",
    })}

        </TooltipContent>
      </Tooltip>

      {/* pop-up saisie dispo */}
      {!isPlanifie && (
        <CandidateJourneeDialog
          open={open}
          onClose={() => setOpen(false)}
          date={date}
          secteur={secteur}
          candidatId={candidatId}
          service={service}
          disponibilite={disponibilite}
          onSuccess={onSuccess}
          candidatNomPrenom={nomPrenom}
        />
      )}
    </>
  )
}
