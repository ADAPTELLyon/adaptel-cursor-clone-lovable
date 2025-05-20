import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { statutColors } from "@/lib/colors"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat } from "@/types/types-front"
import { PopupsChangementStatutContextuels } from "@/components/commandes/PopupsChangementStatutContextuels"

interface ChangementStatutDialogProps {
  open: boolean
  onClose: () => void
  commande: CommandeWithCandidat
  secteur: string
  date: string
  service?: string
  onSuccess: () => void
}

const statutsPossibles: Record<string, string[]> = {
  "En recherche": ["Non pourvue", "Annule Client", "Annule ADA"],
  "Validé": ["Annule Int", "Annule Client", "Annule ADA", "Absence"],
  "Annule Int": [],
  "Annule Client": [],
  "Annule ADA": [],
  "Non pourvue": [],
  "Absence": [],
}

export function ChangementStatutDialog({
  open,
  onClose,
  commande,
  secteur,
  date,
  service,
  onSuccess,
}: ChangementStatutDialogProps) {
  const [statutToApply, setStatutToApply] = useState<string | null>(null)
  const statutActuel = commande.statut
  const statuts = statutsPossibles[statutActuel] || []

  const handleStatutClick = (s: string) => {
    if (["Annule Int", "Annule ADA", "Absence"].includes(s)) {
      setStatutToApply(s)
    } else {
      applyStatutSimple(s)
    }
  }

  const applyStatutSimple = async (newStatut: string) => {
    if (!newStatut || newStatut === statutActuel) return

    const { error } = await supabase
      .from("commandes")
      .update({ statut: newStatut })
      .eq("id", commande.id)

    if (!error) {
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
          await supabase.from("historique").insert({
            table_cible: "commandes",
            ligne_id: commande.id,
            action: "statut",
            user_id: userId,
            date_action: new Date().toISOString(),
            apres: { statut: newStatut },
            description: `Changement de statut depuis ${statutActuel}`,
          })
        }
      }

      onSuccess()
      onClose()
    } else {
      console.error("Erreur mise à jour statut :", error)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Changer le statut</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {statuts.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">
                Aucun statut disponible depuis « {statutActuel} »
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {statuts.map((statut) => (
                  <Button
                    key={statut}
                    variant="outline"
                    className="flex items-center justify-center gap-2 text-sm py-2"
                    onClick={() => handleStatutClick(statut)}
                  >
                    <Badge
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: statutColors[statut]?.bg,
                        color: statutColors[statut]?.text,
                      }}
                    >
                      {statut}
                    </Badge>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {statutToApply && (
        <PopupsChangementStatutContextuels
          statut={statutToApply}
          commande={commande}
          date={date}
          secteur={secteur}
          service={service}
          onClose={() => setStatutToApply(null)}
          onSuccess={() => {
            onSuccess()
            onClose()
            setStatutToApply(null)
          }}
        />
      )}
    </>
  )
}
