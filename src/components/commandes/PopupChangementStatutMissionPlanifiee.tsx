import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat, StatutCommande } from "@/types/types-front"
import { Dialog as DialogShad, DialogContent as DialogBox, DialogHeader as DialogBoxHeader, DialogTitle as DialogBoxTitle } from "@/components/ui/dialog"

interface Props {
  statut: StatutCommande
  commande: CommandeWithCandidat
  onClose: () => void
  onSuccess: () => void
}

export function PopupChangementStatutMissionPlanifiee({
  statut,
  commande,
  onClose,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [motif, setMotif] = useState("")
  const [statutCandidat, setStatutCandidat] = useState<"Dispo" | "Non Dispo" | "Non Renseigné">("Dispo")
  const [askRechercheOpen, setAskRechercheOpen] = useState(false)

  const showMotif = statut === "Annule ADA"
  const askStatutCandidat = ["Annule ADA", "Annule Client"].includes(statut)
  const askRemettreEnRecherche = ["Annule Int", "Absence"].includes(statut)

  const handleValider = async (remettreEnRecherche: boolean = false) => {
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()
    const userEmail = authData?.user?.email || null
    const { data: userApp } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("email", userEmail)
      .single()
    const userId = userApp?.id || null
    if (!userId) return toast({ title: "Utilisateur introuvable", variant: "destructive" })

    const candidatId = commande.candidat_id

    // Étape 1 — Supprimer la planification
    if (candidatId) {
      await supabase
        .from("planification")
        .delete()
        .eq("commande_id", commande.id)
        .eq("candidat_id", candidatId)

      // Étape 2 — Mise à jour commande
      await supabase.from("commandes").update({
        statut,
        candidat_id: null,
        ...(motif ? { complement_motif: motif } : {})
      }).eq("id", commande.id)

      // Étape 3 — Mise à jour planning candidat (disponibilites)
      const statutPourCandidat =
        askStatutCandidat
          ? statutCandidat
          : statut === "Annule Int"
          ? "Annule Int"
          : statut === "Absence"
          ? "Absence"
          : "Non Dispo"

      await supabase.from("disponibilites").upsert({
        candidat_id: candidatId,
        date: commande.date,
        secteur: commande.secteur,
        statut: statutPourCandidat,
        updated_at: new Date().toISOString(),
      }, { onConflict: "candidat_id,date,secteur" })

      // Étape 4 — Historique enrichi
      await supabase.from("historique").insert({
        table_cible: "commandes",
        ligne_id: commande.id,
        action: "statut",
        user_id: userId,
        date_action: new Date().toISOString(),
        description: `Statut ${statut} appliqué à une mission planifiée`,
        apres: {
          statut,
          ...(motif ? { complement_motif: motif } : {}),
          candidat: commande.candidat ? { nom: commande.candidat.nom, prenom: commande.candidat.prenom } : {},
          statut_candidat: statutPourCandidat,
          remettre_en_recherche: remettreEnRecherche || false,
        }
      })

      // Étape 5 — Recréation commande si besoin
      if (remettreEnRecherche) {
        await supabase.from("commandes").insert({
          client_id: commande.client_id,
          date: commande.date,
          secteur: commande.secteur,
          service: commande.service,
          statut: "En recherche",
          heure_debut_matin: commande.heure_debut_matin,
          heure_fin_matin: commande.heure_fin_matin,
          heure_debut_soir: commande.heure_debut_soir,
          heure_fin_soir: commande.heure_fin_soir,
        })
      }
    }

    toast({ title: `Statut "${statut}" appliqué avec succès` })
    onSuccess()
    onClose()
  }

  if (askRemettreEnRecherche && !askRechercheOpen) {
    return (
      <DialogShad open onOpenChange={() => setAskRechercheOpen(false)}>
        <DialogBox>
          <DialogBoxHeader>
            <DialogBoxTitle>Remettre en “En recherche” ?</DialogBoxTitle>
          </DialogBoxHeader>
          <div className="p-4 space-y-4 text-sm">
            <p>Souhaitez-vous remettre automatiquement cette mission en statut <strong>En recherche</strong> ?</p>
            <div className="flex justify-end gap-4 pt-2">
              <Button variant="outline" onClick={() => {
                setAskRechercheOpen(true)
                handleValider(false)
              }}>Non</Button>
              <Button onClick={() => handleValider(true)}>Oui</Button>
            </div>
          </div>
        </DialogBox>
      </DialogShad>
    )
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{`Statut “${statut}”`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {showMotif && (
            <div>
              <Label>Motif</Label>
              <Input value={motif} onChange={(e) => setMotif(e.target.value)} />
            </div>
          )}

          {askStatutCandidat && (
            <div>
              <Label>Statut à appliquer dans le planning du candidat</Label>
              <RadioGroup value={statutCandidat} onValueChange={(v) => setStatutCandidat(v as any)} className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Dispo" id="dispo" />
                  <Label htmlFor="dispo">Dispo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Non Dispo" id="non" />
                  <Label htmlFor="non">Non dispo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Non Renseigné" id="vide" />
                  <Label htmlFor="vide">Non renseigné</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={() => handleValider()} disabled={loading || (showMotif && !motif.trim())}>
              Valider
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
