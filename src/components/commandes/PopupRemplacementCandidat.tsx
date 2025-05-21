import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat } from "@/types/types-front"
import { toast } from "@/hooks/use-toast"

interface CandidatMini {
  id: string
  nom: string
  prenom: string
}

interface PopupRemplacementCandidatProps {
  commande: CommandeWithCandidat
  nouveauCandidat: CandidatMini
  onClose: () => void
  onSuccess: () => void
}

export function PopupRemplacementCandidat({
  commande,
  nouveauCandidat,
  onClose,
  onSuccess,
}: PopupRemplacementCandidatProps) {
  const [statutAncien, setStatutAncien] = useState<"Dispo" | "Non Dispo" | "Non Renseigné">("Dispo")
  const [motif, setMotif] = useState("")
  const [loading, setLoading] = useState(false)

  const handleValider = async () => {
    setLoading(true)

    const ancienCandidatId = commande.candidat_id
    const { data: authData } = await supabase.auth.getUser()
    const userEmail = authData?.user?.email || null

    const { data: userApp } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("email", userEmail)
      .single()

    const userId = userApp?.id || null
    if (!userId || !ancienCandidatId) {
      toast({ title: "Erreur", description: "Utilisateur ou ancien candidat manquant", variant: "destructive" })
      return
    }

    // Supprimer ancienne planification
    await supabase
      .from("planification")
      .delete()
      .eq("commande_id", commande.id)
      .eq("candidat_id", ancienCandidatId)

    // Mettre à jour la commande avec le nouveau candidat
    await supabase
      .from("commandes")
      .update({
        candidat_id: nouveauCandidat.id,
        statut: "Validé",
      })
      .eq("id", commande.id)

    // Insérer la nouvelle planification
    await supabase.from("planification").insert({
      commande_id: commande.id,
      candidat_id: nouveauCandidat.id,
      date: commande.date,
      secteur: commande.secteur,
      statut: "Validé",
      ...(commande.service ? { service: commande.service } : {}),
      heure_debut_matin: commande.heure_debut_matin,
      heure_fin_matin: commande.heure_fin_matin,
      heure_debut_soir: commande.heure_debut_soir,
      heure_fin_soir: commande.heure_fin_soir,
    })

    // Mettre à jour la disponibilité de l'ancien candidat
    await supabase.from("disponibilites").upsert({
      candidat_id: ancienCandidatId,
      date: commande.date,
      secteur: commande.secteur,
      statut: statutAncien,
      updated_at: new Date().toISOString(),
    }, { onConflict: "candidat_id,date,secteur" })

    // Enregistrer dans l'historique
    await supabase.from("historique").insert({
      table_cible: "commandes",
      ligne_id: commande.id,
      action: "remplacement",
      user_id: userId,
      date_action: new Date().toISOString(),
      description: `Remplacement de ${commande.candidat?.prenom} ${commande.candidat?.nom} par ${nouveauCandidat.prenom} ${nouveauCandidat.nom}`,
      apres: {
        ancien_candidat: {
          nom: commande.candidat?.nom || "",
          prenom: commande.candidat?.prenom || "",
        },
        nouveau_candidat: {
          nom: nouveauCandidat.nom,
          prenom: nouveauCandidat.prenom,
        },
        statut_appliqué_ancien: statutAncien,
        motif,
      },
    })

    toast({ title: "Candidat remplacé avec succès" })
    onSuccess()
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Remplacement du candidat</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Motif du remplacement</Label>
            <Input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex : indisponible, erreur d'affectation..."
            />
          </div>

          <div>
            <Label>Statut à appliquer à l’ancien candidat</Label>
            <RadioGroup value={statutAncien} onValueChange={(v) => setStatutAncien(v as any)} className="space-y-1 mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Dispo" id="dispo" />
                <Label htmlFor="dispo">Dispo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Non Dispo" id="non" />
                <Label htmlFor="non">Non dispo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Non Renseigné" id="nr" />
                <Label htmlFor="nr">Non renseigné</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleValider} disabled={!motif.trim() || loading}>
              Valider
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
