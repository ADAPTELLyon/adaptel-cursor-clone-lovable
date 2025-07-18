import { useState } from "react"
import { cn } from "@/lib/utils"
import { Info, Check, XCircle, CheckCircle, HelpCircle, Plus } from "lucide-react"
import { disponibiliteColors, statutColors, statutBorders } from "@/lib/colors"
import { CandidateJourneeDialog } from "@/components/Planning/CandidateJourneeDialog"
import type { CandidatDispoWithNom, CommandeFull } from "@/types/types-front"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface CellulePlanningCandidateProps {
  disponibilite?: CandidatDispoWithNom;
  commande?: CommandeFull;
  autresCommandes?: CommandeFull[];
  secteur: string;
  date: string;
  candidatId: string;
  service: string;
  nomPrenom: string;
  onSuccess: () => void;
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
  const [creneauVerrouille, setCreneauVerrouille] = useState<"matin" | "soir" | undefined>()
  const [commentaireTemp, setCommentaireTemp] = useState(disponibilite?.commentaire || "")
  const [editingComment, setEditingComment] = useState(false)

  const isPlanifie = commande?.statut === "Validé"

  const statutAnnexe = ["Annule Int", "Absence", "Annule Client", "Annule ADA"].includes(commande?.statut || "")
  const isAnnexeActif =
    statutAnnexe &&
    (!disponibilite?.updated_at || !commande?.updated_at || new Date(commande.updated_at) > new Date(disponibilite.updated_at))

  const statutDispo = disponibilite?.statut ?? "Non renseigné"
  const matin = disponibilite?.matin
  const soir = disponibilite?.soir
  const isDispo = statutDispo === "Dispo" && (matin || soir)
  const isNonDispo = statutDispo === "Non Dispo"

  const couleur =
    statutColors[commande?.statut || ""] ??
    disponibiliteColors[statutDispo] ??
    { bg: "#e5e7eb", text: "#000000" }

  const openPopup = (creneau?: "matin" | "soir") => {
    setCreneauVerrouille(creneau)
    setOpen(true)
  }

  const handleClick = () => {
    if (!isPlanifie && !isAnnexeActif) {
      openPopup()
    }
  }

  const renderIcon = (valeur: "Dispo" | "Non Dispo" | "Non renseigné") => {
    if (valeur === "Dispo") return <CheckCircle className="w-4 h-4 text-black ml-2" />
    if (valeur === "Non Dispo") return <XCircle className="w-4 h-4 text-black ml-2" />
    return <HelpCircle className="w-4 h-4 text-black ml-2" />
  }

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
              borderLeft: `5px solid ${statutBorders[commande?.statut || statutDispo] || "transparent"}`,
            }}
            onClick={handleClick}
          >
            {/* Ligne 1 */}
            <div className="font-semibold text-[13px] leading-tight min-h-[1.2rem]">
              {isPlanifie && !isAnnexeActif
                ? commande?.client?.nom || "Mission validée"
                : isAnnexeActif
                ? commande?.statut
                : isNonDispo
                ? "Non dispo"
                : isDispo
                ? "Dispo"
                : ""}
            </div>

            {/* Ligne 2 */}
            <div className="text-xs font-normal italic min-h-[1rem]">
              {isAnnexeActif && commande?.client?.nom ? commande.client.nom : ""}
            </div>

            {/* Ligne 3 : matin */}
            <div className="text-[13px] font-bold min-h-[1.2rem] mt-0.5 flex items-center">
              {isAnnexeActif ? null : commande?.heure_debut_matin && commande?.heure_fin_matin ? (
                `${commande.heure_debut_matin.slice(0, 5)} - ${commande.heure_fin_matin.slice(0, 5)}`
              ) : !isPlanifie && isDispo && matin ? (
                "Matin / Midi"
              ) : isPlanifie && secteur !== "Étages" && !commande?.heure_debut_matin ? (
                <>
                  <span>Matin / Midi</span>
                  <span
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      openPopup("soir")
                    }}
                  >
                    {renderIcon(
                      matin === true ? "Dispo" : matin === false ? "Non Dispo" : "Non renseigné"
                    )}
                  </span>
                </>
              ) : null}
            </div>

            {/* Ligne 4 : soir */}
            {secteur !== "Étages" && (
              <div className="text-[13px] font-bold min-h-[1.2rem] mt-0.5 flex items-center">
                {isAnnexeActif ? null : commande?.heure_debut_soir && commande?.heure_fin_soir ? (
                  `${commande.heure_debut_soir.slice(0, 5)} - ${commande.heure_fin_soir.slice(0, 5)}`
                ) : !isPlanifie && isDispo && soir ? (
                  "Soir"
                ) : isPlanifie && !commande?.heure_debut_soir ? (
                  <>
                    <span>Soir</span>
                    <span
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        openPopup("matin")
                      }}
                    >
                      {renderIcon(
                        soir === true ? "Dispo" : soir === false ? "Non Dispo" : "Non renseigné"
                      )}
                    </span>
                  </>
                ) : null}
              </div>
            )}

            {/* Icône commentaire */}
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          toast({ title: "Commentaire mis à jour" })
                          setEditingComment(false)
                          onSuccess()
                        }}
                      >
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Case vide */}
            {!commande && !disponibilite && (
              <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                <Plus className="w-4 h-4 text-gray-400" />
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
        creneauVerrouille={creneauVerrouille}
      />
    </>
  )
}
