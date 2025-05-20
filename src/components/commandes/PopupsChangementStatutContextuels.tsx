import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat } from "@/types/types-front"

export function showPopupAnnuleAda({ commande, onClose, onSuccess }: {
  commande: CommandeWithCandidat
  onClose: () => void
  onSuccess: () => void
}) {
  const root = document.createElement("div")
  document.body.appendChild(root)

  const Popup = () => {
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

      await supabase
        .from("commandes")
        .update({ statut: "Annule ADA" })
        .eq("id", commande.id)

      if (userId) {
        await supabase.from("historique").insert({
          table_cible: "commandes",
          ligne_id: commande.id,
          action: "statut",
          description: `Annule ADA – ${raison}`,
          user_id: userId,
          date_action: new Date().toISOString(),
          apres: { statut: "Annule ADA", raison },
        })
      }

      onSuccess()
      onClose()
      setTimeout(() => document.body.removeChild(root), 100)
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
              placeholder="Ex : Double mission, client fermé, etc."
            />
            <div className="flex justify-end">
              <Button onClick={handleValider} disabled={loading || !raison}>
                Valider
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  import("react-dom/client").then(({ createRoot }) => {
    createRoot(root).render(<Popup />)
  })
}
