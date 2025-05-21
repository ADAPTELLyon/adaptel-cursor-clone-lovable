import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Info, AlertCircle } from "lucide-react"
import { disponibiliteColors, statutColors } from "@/lib/colors"
import { CandidateJourneeDialog } from "@/components/Planning/CandidateJourneeDialog"
import type { CandidatDispoWithNom, CommandeFull } from "@/types/types-front"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"

interface CellulePlanningCandidateProps {
  disponibilite?: CandidatDispoWithNom
  commande?: CommandeFull
  autresCommandes?: CommandeFull[] // ✅ Ajout ici
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
  const [commentaire, setCommentaire] = useState(disponibilite?.commentaire || "")
  const [editing, setEditing] = useState(false)

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
        style={{ backgroundColor: couleur.bg, color: couleur.text }}
        onClick={handleClick}
      >
        {isPlanifie ? (
          <>
            <div className="font-semibold flex items-center gap-1">
              {commande.client?.nom || "Mission validée"}

              {autresCommandes.length > 0 && (
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

            <div className="mt-1 text-xs space-y-1 font-medium">
              {["matin", ...(secteur !== "Étages" ? ["soir"] : [])].map((creneau) => {
                const heureDebut = commande[`heure_debut_${creneau}` as keyof typeof commande] as string
                const heureFin = commande[`heure_fin_${creneau}` as keyof typeof commande] as string
                return (
                  <div key={creneau}>
                    {heureDebut && heureFin ? `${heureDebut.slice(0, 5)} - ${heureFin.slice(0, 5)}` : null}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            {statut !== "Non renseigné" && (
              <div className="font-semibold mb-1">{statut}</div>
            )}

            <div className="mt-auto text-xs font-semibold space-y-1 pt-1">
              <div className="h-[16px]">
                {statut === "Dispo" && matin && <div>Matin / Midi</div>}
              </div>
              <div className="h-[16px]">
                {statut === "Dispo" && secteur !== "Étages" && soir && <div>Soir</div>}
              </div>
            </div>

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
          </>
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
