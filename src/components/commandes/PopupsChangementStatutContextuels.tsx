import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat } from "@/types/types-front"

export function PopupsChangementStatutContextuels({
  statut,
  commande,
  date,
  secteur,
  service,
  onClose,
  onSuccess,
}: {
  statut: string
  commande: CommandeWithCandidat
  date: string
  secteur: string
  service?: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [raison, setRaison] = useState("")
  const [loading, setLoading] = useState(false)

  const handleValider = async () => {
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()
    const userEmail = authData?.user?.email || null

    const { data: userApp } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("email", userEmail)
      .single()

    const userId = userApp?.id || null

    const updates: any = { statut }

    if (statut === "Annule ADA") {
      updates.complement_motif = raison
    }

    const { error: updateError } = await supabase
      .from("commandes")
      .update(updates)
      .eq("id", commande.id)

    if (!updateError && userId) {
      await supabase.from("historique").insert({
        table_cible: "commandes",
        ligne_id: commande.id,
        action: "statut",
        description: `Annule ADA – ${raison}`,
        user_id: userId,
        date_action: new Date().toISOString(),
        apres: { statut, complement_motif: raison },
      })
    }

    onSuccess()
    onClose()
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Annulation ADA</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">Veuillez saisir la raison de l'annulation :</p>
          <Input
            value={raison}
            onChange={(e) => setRaison(e.target.value)}
            placeholder="Ex : Client annulé, doublon, etc."
          />
          <div className="flex justify-end">
            <Button onClick={handleValider} disabled={loading || !raison.trim()}>
              Valider
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
