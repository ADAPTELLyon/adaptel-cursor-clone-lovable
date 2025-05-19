import { useState } from "react"
import { cn } from "@/lib/utils"
import { Info } from "lucide-react"
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
  const statut = disponibilite?.statut ?? "Non renseigné"
  const matin = disponibilite?.matin ?? false
  const soir = disponibilite?.soir ?? false

  const bgColor = isPlanifie
    ? statutColors["Validé"]?.bg || "#a9d08e"
    : disponibiliteColors[statut]?.bg || "#e5e7eb"
  const textColor = isPlanifie
    ? statutColors["Validé"]?.text || "#000000"
    : disponibiliteColors[statut]?.text || "#000000"

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

      // 🔐 Ajout de l’enregistrement dans historique
      const { data: authData } = await supabase.auth.getUser()
      const userEmail = authData?.user?.email || null

      if (userEmail) {
        const { data: userApp } = await supabase
          .from("utilisateurs")
          .select("id")
          .eq("email", userEmail)
          .single()

        const userId = userApp?.id || null

        if (userId) {
          const { error: histError } = await supabase.from("historique").insert({
            table_cible: "disponibilites",
            ligne_id: disponibilite.id,
            action: "modification_commentaire",
            description: `Mise à jour du commentaire : ${value}`,
            user_id: userId,
            date_action: new Date().toISOString(),
          })

          if (histError) {
            console.error("Erreur historique (commentaire) :", histError)
          }
        }
      }
    }
  }

  return (
    <>
      <div
        className={cn(
          "h-full rounded p-2 text-xs border cursor-pointer flex flex-col justify-start relative"
        )}
        style={{ backgroundColor: bgColor, color: textColor }}
        onClick={handleClick}
      >
        {isPlanifie ? (
          <>
            <div className="font-semibold">{commande.client?.nom || "Mission validée"}</div>
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
