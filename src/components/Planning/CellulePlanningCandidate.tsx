import { useState } from "react"
import { cn } from "@/lib/utils"
import { Info, Check, XCircle, CheckCircle, HelpCircle, Plus } from "lucide-react"
import { disponibiliteColors, statutColors, statutBorders } from "@/lib/colors"
import { CandidateJourneeDialog } from "@/components/Planning/CandidateJourneeDialog"
import { StatutDispoCreneauRestantDialog } from "@/components/Planning/StatutDispoCreneauRestantDialog"
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
  const [popupDispoRestant, setPopupDispoRestant] = useState<{ open: boolean; creneau: "matin" | "soir" }>({
    open: false,
    creneau: "matin",
  })

  const isPlanifie = commande?.statut === "Validé"
  const statutAnnexe = ["Annule Int", "Absence", "Annule Client", "Annule ADA"].includes(commande?.statut || "")
  const isAnnexeActif =
    statutAnnexe &&
    (!disponibilite?.updated_at || !commande?.updated_at || new Date(commande.updated_at) > new Date(disponibilite.updated_at))

  const statutDispo = disponibilite?.statut ?? "Non renseigné"
  const dispoMatin = disponibilite?.matin
  const dispoSoir = disponibilite?.soir
  const isDispo = statutDispo === "Dispo" && (dispoMatin || dispoSoir)
  const isNonDispo = statutDispo === "Non Dispo"

  const couleur =
    statutColors[commande?.statut || ""] ?? disponibiliteColors[statutDispo] ?? { bg: "#e5e7eb", text: "#000000" }

  const openPopup = (creneau?: "matin" | "soir") => {
    setCreneauVerrouille(creneau)
    setOpen(true)
  }

  const handleClick = () => {
    if (!isPlanifie && !isAnnexeActif) {
      openPopup()
    }
  }

  const renderIcon = (valeur: boolean | null | undefined) => {
    if (valeur === true) return <CheckCircle className="w-4 h-4 text-black ml-2" />
    if (valeur === false) return <XCircle className="w-4 h-4 text-black ml-2" />
    return <HelpCircle className="w-4 h-4 text-black ml-2" />
  }

  const isPlanifieMatin = !!commande?.heure_debut_matin && !!commande?.heure_fin_matin && commande?.statut === "Validé"
  const isPlanifieSoir = !!commande?.heure_debut_soir && !!commande?.heure_fin_soir && commande?.statut === "Validé"

  const hasAutreCommandeMatin = autresCommandes?.some(
    (cmd) => cmd.statut === "Validé" && !!cmd.heure_debut_matin && !!cmd.heure_fin_matin
  )
  const hasAutreCommandeSoir = autresCommandes?.some(
    (cmd) => cmd.statut === "Validé" && !!cmd.heure_debut_soir && !!cmd.heure_fin_soir
  )

  const isDoublePlanifieDeuxClients = isPlanifieMatin && isPlanifieSoir && hasAutreCommandeSoir

  const showDispoRestantMatin = isPlanifieSoir && !isPlanifieMatin && !hasAutreCommandeMatin
  const showDispoRestantSoir = isPlanifieMatin && !isPlanifieSoir && !hasAutreCommandeSoir

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

            <div className="text-xs font-normal italic min-h-[1rem]">
              {isAnnexeActif && commande?.client?.nom ? commande.client.nom : ""}
            </div>

            <div className="text-[13px] font-bold min-h-[1.2rem] mt-0.5 flex items-center">
              {isAnnexeActif ? null : isPlanifieMatin ? (
                `${commande!.heure_debut_matin!.slice(0, 5)} - ${commande!.heure_fin_matin!.slice(0, 5)}`
              ) : showDispoRestantMatin ? (
                <>
                  <span>Matin / Midi</span>
                  <span
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPopupDispoRestant({ open: true, creneau: "matin" })
                    }}
                  >
                    {renderIcon(dispoMatin)}
                  </span>
                </>
              ) : isDispo && dispoMatin ? (
                "Matin / Midi"
              ) : null}
            </div>

            {secteur !== "Étages" &&
              !isDoublePlanifieDeuxClients && (
                <div className="text-[13px] font-bold min-h-[1.2rem] mt-0.5 flex items-center">
                  {isAnnexeActif ? null : isPlanifieSoir ? (
                    `${commande!.heure_debut_soir!.slice(0, 5)} - ${commande!.heure_fin_soir!.slice(0, 5)}`
                  ) : showDispoRestantSoir ? (
                    <>
                      <span>Soir</span>
                      <span
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPopupDispoRestant({ open: true, creneau: "soir" })
                        }}
                      >
                        {renderIcon(dispoSoir)}
                      </span>
                    </>
                  ) : isDispo && dispoSoir && !isPlanifieSoir && !hasAutreCommandeSoir ? (
                    "Soir"
                  ) : null}
                </div>
              )}

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

      <StatutDispoCreneauRestantDialog
        open={popupDispoRestant.open}
        onClose={() => setPopupDispoRestant({ open: false, creneau: "matin" })}
        candidatId={candidatId}
        date={date}
        secteur={secteur}
        creneau={popupDispoRestant.creneau}
        disponibilite={disponibilite}
        service={service}
        onSuccess={onSuccess}
        candidatNomPrenom={nomPrenom}
        commentaireActuel={disponibilite?.commentaire || ""}
      />
    </>
  )
}
