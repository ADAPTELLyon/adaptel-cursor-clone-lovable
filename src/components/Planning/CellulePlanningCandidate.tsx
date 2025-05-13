import { useState } from "react"
import { cn } from "@/lib/utils"
import { Info } from "lucide-react"
import { disponibiliteColors } from "@/lib/colors"
import { CandidateJourneeDialog } from "@/components/Planning/CandidateJourneeDialog"
import type { CandidatDispoWithNom } from "@/types/types-front"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"

interface CellulePlanningCandidateProps {
  disponibilite?: CandidatDispoWithNom
  secteur: string
  date: string
  candidatId: string
  service: string
  nomPrenom: string
  onSuccess: () => void
}

export function CellulePlanningCandidate({
  disponibilite,
  secteur,
  date,
  candidatId,
  service,
  nomPrenom,
  onSuccess,
}: CellulePlanningCandidateProps) {
  const [open, setOpen] = useState(false)
  const [commentaire, setCommentaire] = useState(disponibilite?.commentaire || "")
  const [editing, setEditing] = useState(false)

  const statut = disponibilite?.statut ?? "Non renseigné"
  const matin = disponibilite?.matin ?? false
  const soir = disponibilite?.soir ?? false

  const isVide = !disponibilite
  const bgColor = disponibiliteColors[statut]?.bg || "#e5e7eb"
  const textColor = disponibiliteColors[statut]?.text || "#000000"

  const handleCommentaireChange = async (value: string) => {
    setCommentaire(value)
    if (!disponibilite?.id) return

    const { error } = await supabase
      .from("disponibilites")
      .update({ commentaire: value })
      .eq("id", disponibilite.id)

    if (error) {
      toast({ title: "Erreur", description: "Échec enregistrement", variant: "destructive" })
    } else {
      toast({ title: "Commentaire mis à jour" })
      onSuccess()
    }
  }

  return (
    <>
      <div
        className={cn(
          "h-full rounded p-2 text-xs border cursor-pointer flex flex-col justify-start relative"
        )}
        style={{ backgroundColor: bgColor, color: textColor }}
        onClick={() => setOpen(true)}
      >
        {/* Ligne 1 : statut */}
        {statut !== "Non renseigné" && (
          <div className="font-semibold mb-1">{statut}</div>
        )}

        {/* Ligne 2 : vide (réservée à l’établissement plus tard) */}
        {!isVide && <div className="h-[16px]" />}

        {/* Créneaux */}
        <div className="mt-auto text-xs font-semibold space-y-1 pt-1">
          <div className="h-[16px]">
            {statut === "Dispo" && matin && <div>Matin / Midi</div>}
          </div>
          <div className="h-[16px]">
            {statut === "Dispo" && secteur !== "Étages" && soir && <div>Soir</div>}
          </div>
        </div>

        {/* Icône info bas droite */}
        {commentaire && (
          <div
            className="absolute bottom-1 right-1 z-20"
            onClick={(e) => {
              e.stopPropagation()
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
              <PopoverContent className="w-64 text-sm">
                <Input
                  value={commentaire}
                  onChange={(e) => handleCommentaireChange(e.target.value)}
                  placeholder="Commentaire"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

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
    </>
  )
}
