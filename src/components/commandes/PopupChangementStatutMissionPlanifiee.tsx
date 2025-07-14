// src/components/commandes/PopupChangementStatutMissionPlanifiee.tsx

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat, StatutCommande } from "@/types/types-front"
import { X } from "lucide-react"
import { getWeek } from "date-fns"

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

    // 🔁 Supprimer la planification s’il y a un candidat
    if (candidatId) {
      await supabase
        .from("planification")
        .delete()
        .eq("commande_id", commande.id)
        .eq("candidat_id", candidatId)
    }

    // ✅ Mise à jour commande
    await supabase.from("commandes").update({
      statut,
      candidat_id: candidatId,
      ...(motif ? { complement_motif: motif } : {}),
    }).eq("id", commande.id)

    // 🧠 Déterminer le statut à appliquer au planning candidat
    const statutPourCandidat =
      askStatutCandidat
        ? statutCandidat
        : statut === "Annule Int"
        ? "Annule Int"
        : statut === "Absence"
        ? "Absence"
        : "Non Dispo"

    // ✅ Ajout dans disponibilites si candidat_id présent
    if (candidatId) {
      await supabase.from("disponibilites").upsert({
        candidat_id: candidatId,
        date: commande.date,
        secteur: commande.secteur,
        statut: statutPourCandidat,
        updated_at: new Date().toISOString(),
      }, { onConflict: "candidat_id,date,secteur" })
    }

    // ✅ Historique
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

    // ✅ Création d'une commande "En recherche" si demandé
    if (remettreEnRecherche) {
      const semaine = getWeek(new Date(commande.date))

      const { data: autres } = await supabase
        .from("commandes")
        .select("mission_slot")
        .eq("client_id", commande.client_id)
        .eq("secteur", commande.secteur)
        .in("statut", ["En recherche", "Validé", "Absence", "Annule Int"])
        .gte("date", new Date(commande.date).toISOString())
        .lte("date", new Date(new Date(commande.date).setDate(new Date(commande.date).getDate() + 6)).toISOString())

      const slots = autres?.map((c) => c.mission_slot).filter((s) => typeof s === "number") || []
      const maxSlot = slots.length ? Math.max(...slots) : 0
      const newSlot = maxSlot + 1

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
        mission_slot: newSlot,
      })
    }

    toast({ title: `Statut "${statut}" appliqué avec succès` })
    onSuccess()
    onClose()
  }

  if (askRemettreEnRecherche && !askRechercheOpen) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remettre en “En recherche” ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p>Souhaitez-vous remettre cette mission en statut <strong>En recherche</strong> ?</p>
            <div className="flex justify-end gap-4 pt-2">
              <Button variant="outline" onClick={() => handleValider(false)}>Non</Button>
              <Button onClick={() => handleValider(true)}>Oui</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex items-center justify-between">
          <DialogTitle>{`Statut “${statut}”`}</DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {showMotif && (
            <div>
              <Label>Motif</Label>
              <Input value={motif} onChange={(e) => setMotif(e.target.value)} />
            </div>
          )}

          {askStatutCandidat && (
            <div>
              <Label>Statut à appliquer dans le planning du candidat</Label>
              <RadioGroup
                value={statutCandidat}
                onValueChange={(v) => setStatutCandidat(v as any)}
                className="space-y-2 mt-2"
              >
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

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button
              onClick={() => handleValider()}
              disabled={loading || (showMotif && !motif.trim())}
            >
              Valider
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
