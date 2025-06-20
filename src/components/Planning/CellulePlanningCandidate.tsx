import { useState } from "react"
import { cn } from "@/lib/utils"
import { Info, AlertCircle, Check } from "lucide-react"
import { disponibiliteColors, statutColors } from "@/lib/colors"
import { CandidateJourneeDialog } from "@/components/Planning/CandidateJourneeDialog"
import type { CandidatDispoWithNom, CommandeFull } from "@/types/types-front"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
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
  const [commentaireTemp, setCommentaireTemp] = useState(disponibilite?.commentaire || "")
  const [editingComment, setEditingComment] = useState(false)

  const isPlanifie = !!commande
  const statut = isPlanifie ? "Validé" : (disponibilite?.statut ?? "Non renseigné")
  const matin = disponibilite?.matin ?? false
  const soir = disponibilite?.soir ?? false

  const couleur =
    statutColors[statut] ?? disponibiliteColors[statut] ?? { bg: "#e5e7eb", text: "#000000" }

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
      .update({ commentaire: commentaireTemp })
      .eq("id", disponibilite.id)

    if (error) {
      toast({ title: "Erreur", description: "Échec enregistrement", variant: "destructive" })
    } else {
      toast({ title: "Commentaire mis à jour" })
      setEditingComment(false)
      onSuccess()
    }
  }

  return (
    <>
      <div
        className={cn(
          "h-full rounded p-2 text-xs border cursor-pointer flex flex-col justify-start relative"
        )}
        style={{ backgroundColor: couleur.bg, color: couleur.text }}
        onClick={handleClick}
      >
        <div className="font-semibold flex items-center gap-1 min-h-[18px]">
          {isPlanifie ? commande.client?.nom || "Mission validée" : statut !== "Non renseigné" ? statut : ""}
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

        <div className="min-h-[16px]"></div>

        <div className="h-[16px]">
          {isPlanifie && commande.heure_debut_matin && commande.heure_fin_matin ? (
            <div>
              {commande.heure_debut_matin.slice(0, 5)} - {commande.heure_fin_matin.slice(0, 5)}
            </div>
          ) : statut === "Dispo" && matin ? (
            <div>Matin / Midi</div>
          ) : null}
        </div>

        <div className="h-[16px]">
          {secteur !== "Étages" &&
            (isPlanifie && commande.heure_debut_soir && commande.heure_fin_soir ? (
              <div>
                {commande.heure_debut_soir.slice(0, 5)} - {commande.heure_fin_soir.slice(0, 5)}
              </div>
            ) : statut === "Dispo" && soir ? (
              <div>Soir</div>
            ) : null)}
        </div>

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
              <PopoverContent className="w-64 p-2 space-y-2">
                <textarea
                  value={commentaireTemp}
                  onChange={(e) => setCommentaireTemp(e.target.value)}
                  rows={4}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
                <div className="flex justify-end">
                  <Button variant="ghost" size="icon" onClick={handleSaveCommentaire}>
                    <Check className="w-4 h-4 text-green-600" />
                  </Button>
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
