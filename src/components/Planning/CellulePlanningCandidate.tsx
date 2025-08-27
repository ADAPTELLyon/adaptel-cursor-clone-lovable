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
  /** NEW: active la mise en page compacte du mini-planning uniquement */
  mini?: boolean;
}

function normalizeStatutDispo(s?: string | null): "Dispo" | "Non Dispo" | "Non Renseigné" {
  const v = (s || "").toLowerCase()
  if (v === "dispo") return "Dispo"
  if (v === "non dispo") return "Non Dispo"
  return "Non Renseigné"
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
  mini = false,
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

  const statutDispo = normalizeStatutDispo(disponibilite?.statut)
  const dispoMatin = disponibilite?.matin ?? null
  const dispoSoir = disponibilite?.soir ?? null
  const isDispo = statutDispo === "Dispo" && (dispoMatin === true || dispoSoir === true)
  const isNonDispo = statutDispo === "Non Dispo"

  const annexeActive = statutAnnexe && statutDispo === "Non Renseigné"

  const couleur = isPlanifie && !annexeActive
    ? (statutColors[commande?.statut || "Validé"] ?? { bg: "#e5e7eb", text: "#000000" })
    : annexeActive
    ? (statutColors[commande!.statut!] ?? { bg: "#e5e7eb", text: "#000000" })
    : (disponibiliteColors[statutDispo] ?? { bg: "#e5e7eb", text: "#000000" })

  const leftBorderColor =
    (annexeActive ? (statutBorders[commande?.statut || ""] || "transparent")
      : (isPlanifie ? (statutBorders[commande?.statut || ""] || "transparent")
        : (statutBorders[statutDispo] || "transparent")))

  const openPopup = (creneau?: "matin" | "soir") => {
    setCreneauVerrouille(creneau)
    setOpen(true)
  }

  const handleClick = () => {
    if (!isPlanifie) {
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

  const hasSecondarySoir =
    (autresCommandes?.some((cmd) => !!cmd.heure_debut_soir && !!cmd.heure_fin_soir)) || false

  const hasAutreCommandeMatin =
    autresCommandes?.some((cmd) => !!cmd.heure_debut_matin && !!cmd.heure_fin_matin) || false

  const hideSoirRow = hasSecondarySoir

  const showDispoRestantMatin = isPlanifieSoir && !isPlanifieMatin && !hasAutreCommandeMatin
  const showDispoRestantSoir = !hideSoirRow && isPlanifieMatin && !isPlanifieSoir

  // wrapper qui déclenche l’event local + ton onSuccess existant
  const emitLocalRefresh = () => {
    try {
      window.dispatchEvent(
        new CustomEvent("dispos:updated", { detail: { candidatId, date } })
      )
    } catch {}
  }
  const handleSuccess = () => {
    emitLocalRefresh()
    onSuccess()
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
              borderLeft: `5px solid ${leftBorderColor}`,
            }}
            onClick={handleClick}
          >
            {mini ? (
              annexeActive ? (
                <div className="min-h-[2.2rem]">
                  <div className="font-semibold text-[11px] leading-[1.1rem] truncate">
                    {commande?.statut || ""}
                  </div>
                  <div className="text-[11px] leading-[1.1rem] italic truncate">
                    {commande?.client?.nom || ""}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "font-semibold",
                    "text-[11px] leading-[1.1rem] min-h-[2.2rem]",
                    "break-words overflow-hidden",
                    "[display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
                  )}
                >
                  {isPlanifie
                    ? (commande?.client?.nom || "")
                    : isNonDispo
                    ? "Non Dispo"
                    : isDispo
                    ? "Dispo"
                    : ""}
                </div>
              )
            ) : (
              <>
                <div className="font-semibold text-[13px] leading-tight min-h-[1.2rem]">
                  {isPlanifie && !annexeActive
                    ? (commande?.client?.nom || "")
                    : annexeActive
                    ? (commande?.statut || "")
                    : isNonDispo
                    ? "Non Dispo"
                    : isDispo
                    ? "Dispo"
                    : ""}
                </div>
                <div className="text-xs font-normal italic min-h-[1rem]">
                  {annexeActive && commande?.client?.nom ? commande.client.nom : ""}
                </div>
              </>
            )}

            {/* Créneau Matin */}
            <div className={mini ? "text-[11px] font-bold min-h-[1.2rem] mt-0.5 flex items-center"
                                  : "text-[13px] font-bold min-h-[1.2rem] mt-0.5 flex items-center"}>
              {annexeActive ? null : isPlanifieMatin ? (
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
              ) : (statutDispo === "Dispo" && dispoMatin) ? (
                "Matin / Midi"
              ) : null}
            </div>

            {/* Créneau Soir (masqué si secondaire soir) */}
            {secteur !== "Étages" && !hideSoirRow && (
              <div className={mini ? "text-[11px] font-bold min-h-[1.2rem] mt-0.5 flex items-center"
                                    : "text-[13px] font-bold min-h-[1.2rem] mt-0.5 flex items-center"}>
                {annexeActive ? null : isPlanifieSoir ? (
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
                ) : (statutDispo === "Dispo" && dispoSoir && !isPlanifieSoir && !hasSecondarySoir) ? (
                  "Soir"
                ) : null}
              </div>
            )}

            {/* Commentaire */}
            {disponibilite?.commentaire && (
              <div
                className="absolute bottom-1 right-1 z-20"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingComment(true)
                  setCommentaireTemp(disponibilite.commentaire || "")
                }}
              >
                <Popover open={editingComment} onOpenChange={(v) => !v && setEditingComment(false)}>
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
                          handleSuccess()
                          setEditingComment(false)
                        }}
                      >
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* “+” quand vide */}
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
        onSuccess={handleSuccess}
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
        onSuccess={handleSuccess}
        candidatNomPrenom={nomPrenom}
        commentaireActuel={disponibilite?.commentaire || ""}
      />
    </>
  )
}
