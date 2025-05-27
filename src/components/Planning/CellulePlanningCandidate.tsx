import { useState } from "react"
import { cn } from "@/lib/utils"
import { Info, AlertCircle, Check } from "lucide-react"
import { disponibiliteColors, statutColors } from "@/lib/colors"
import { CandidateJourneeDialog } from "@/components/Planning/CandidateJourneeDialog"
import type { CandidatDispoWithNom, CommandeFull } from "@/types/types-front"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"

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
  const [editing, setEditing] = useState(false)
  const [tempCommentaire, setTempCommentaire] = useState(disponibilite?.commentaire || "")

  const isPlanifie = !!commande
  const statutRaw = isPlanifie ? "Validé" : (disponibilite?.statut ?? "Non renseigné")
  const afficherStatut = statutRaw !== "Non renseigné"
  const statut = afficherStatut ? statutRaw : ""
  const matin = disponibilite?.matin ?? false
  const soir = disponibilite?.soir ?? false
  const commentaire = disponibilite?.commentaire ?? ""

  const couleur =
    statutColors[statutRaw] ?? disponibiliteColors[statutRaw] ?? { bg: "#e5e7eb", text: "#000000" }

  const handleClick = () => {
    if (isPlanifie) {
      toast({
        title: "Candidat en mission",
        description: "Saisie de disponibilités impossible.",
        variant: "default",
      })
      return
    }
    setOpen(true)
  }

  const handleSaveCommentaire = async () => {
    if (!disponibilite?.id) return
    const { error } = await supabase
      .from("disponibilites")
      .update({ commentaire: tempCommentaire })
      .eq("id", disponibilite.id)

    if (error) {
      toast({ title: "Erreur", description: "Échec enregistrement", variant: "destructive" })
    } else {
      toast({ title: "Commentaire mis à jour" })
      setEditing(false)
      onSuccess()
    }
  }

  return (
    <>
      <div
        className={cn(
          "h-full rounded p-2 text-xs border cursor-pointer flex flex-col justify-start relative space-y-1"
        )}
        style={{ backgroundColor: couleur.bg, color: couleur.text }}
        onClick={handleClick}
      >
        {/* Ligne 1 : statut ou nom du client */}
        <div className="font-semibold flex items-center gap-1 min-h-[16px] leading-tight">
          {isPlanifie ? (commande.client?.nom || "Mission validée") : (afficherStatut ? statut : "")}
          {isPlanifie && autresCommandes.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <AlertCircle className="h-4 w-4 text-red-600 cursor-pointer" />
              </PopoverTrigger>
              <PopoverContent className="text-sm space-y-1 max-w-xs">
                {autresCommandes.map((c, i) => (
                  <div key={i} className="border-b pb-1">
                    <div className="font-medium">{c.client?.nom || "Client inconnu"}</div>
                    {c.heure_debut_matin && c.heure_fin_matin && (
                      <div>
                        Matin : {c.heure_debut_matin.slice(0, 5)} - {c.heure_fin_matin.slice(0, 5)}
                      </div>
                    )}
                    {c.heure_debut_soir && c.heure_fin_soir && (
                      <div>
                        Soir : {c.heure_debut_soir.slice(0, 5)} - {c.heure_fin_soir.slice(0, 5)}
                      </div>
                    )}
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Ligne 2 : vide par défaut */}
        <div className="min-h-[16px]"></div>

        {/* Ligne 3 : créneau Matin/Midi */}
        <div className="min-h-[16px] font-medium">
          {isPlanifie && commande?.heure_debut_matin && commande?.heure_fin_matin && (
            <div>{commande.heure_debut_matin.slice(0, 5)} - {commande.heure_fin_matin.slice(0, 5)}</div>
          )}
          {!isPlanifie && statutRaw === "Dispo" && matin && (
            <div>Matin / Midi</div>
          )}
        </div>

        {/* Ligne 4 : créneau Soir */}
        <div className="min-h-[16px] font-medium">
          {isPlanifie && secteur !== "Étages" && commande?.heure_debut_soir && commande?.heure_fin_soir && (
            <div>{commande.heure_debut_soir.slice(0, 5)} - {commande.heure_fin_soir.slice(0, 5)}</div>
          )}
          {!isPlanifie && statutRaw === "Dispo" && secteur !== "Étages" && soir && (
            <div>Soir</div>
          )}
        </div>

        {/* Commentaire : icône info + édition dans popover */}
        {commentaire && !isPlanifie && (
          <div
            className="absolute bottom-1 right-1 z-20"
            onClick={(e) => {
              e.stopPropagation()
              setTempCommentaire(commentaire)
              setEditing(true)
            }}
          >
            <Popover open={editing} onOpenChange={setEditing}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="p-0 h-auto w-auto text-black hover:text-black"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="text-sm w-[300px] p-3">
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={tempCommentaire}
                    onChange={(e) => setTempCommentaire(e.target.value)}
                    placeholder="Commentaire"
                    className="resize-none min-h-[80px]"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleSaveCommentaire}
                      className="text-black"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

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
