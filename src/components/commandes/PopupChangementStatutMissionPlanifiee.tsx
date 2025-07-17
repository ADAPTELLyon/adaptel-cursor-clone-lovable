import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat, StatutCommande } from "@/types/types-front"
import { getWeek } from "date-fns"
import { CandidateJourneeDialog } from "@/components/Planning/CandidateJourneeDialog"
import { toast } from "@/hooks/use-toast"

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
  const [showCandidateDialog, setShowCandidateDialog] = useState(false)
  const [askRechercheOpen, setAskRechercheOpen] = useState(false)

  const askStatutCandidat = ["Annule ADA", "Annule Client"].includes(statut)
  const askRemettreEnRecherche = ["Annule Int", "Absence"].includes(statut)

  const handleValiderStatut = async (remettreEnRecherche: boolean = false) => {
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

    if (candidatId) {
      await supabase
        .from("planification")
        .delete()
        .eq("commande_id", commande.id)
        .eq("candidat_id", candidatId)
    }

    const majCommande: Partial<CommandeWithCandidat> = {
      statut,
      ...(statut === "Annule ADA" && motif ? { complement_motif: motif } : {}),
      ...(candidatId ? { candidat_id: candidatId } : {}),
    }

    await supabase.from("commandes").update(majCommande).eq("id", commande.id)

    await supabase.from("historique").insert({
      table_cible: "commandes",
      ligne_id: commande.id,
      action: "statut",
      user_id: userId,
      date_action: new Date().toISOString(),
      description: `Statut ${statut} appliqué à une mission planifiée`,
      apres: {
        statut,
        ...(statut === "Annule ADA" && motif ? { complement_motif: motif } : {}),
        candidat: commande.candidat
          ? { nom: commande.candidat.nom, prenom: commande.candidat.prenom }
          : {},
        remettre_en_recherche: remettreEnRecherche || false,
      },
    })

    if (remettreEnRecherche) {
      const semaine = getWeek(new Date(commande.date))
      const lundi = new Date(commande.date)
      lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7))
      const dimanche = new Date(lundi)
      dimanche.setDate(lundi.getDate() + 6)

      const { data: autres } = await supabase
        .from("commandes")
        .select("mission_slot")
        .eq("client_id", commande.client_id)
        .eq("secteur", commande.secteur)
        .in("statut", ["En recherche", "Validé", "Absence", "Annule Int"])
        .gte("date", lundi.toISOString())
        .lte("date", dimanche.toISOString())

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
        heure_debut_nuit: commande.heure_debut_nuit,
        heure_fin_nuit: commande.heure_fin_nuit,
        mission_slot: newSlot,
        motif_contrat: commande.motif_contrat || "",
      })
    }

    if (askStatutCandidat) {
      setShowCandidateDialog(true)
    } else {
      toast({ title: `Statut "${statut}" appliqué avec succès` })
      onSuccess()
      onClose()
    }
  }

  if (statut === "Annule ADA" && !showCandidateDialog) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merci de justifier l'annulation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex : doublon, client annulé, etc."
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={() => handleValiderStatut()} disabled={!motif.trim()}>
                Valider
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (statut === "Annule Client" && !showCandidateDialog) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annulation Client</DialogTitle>
          </DialogHeader>
          <div className="text-sm pt-2">
            Merci de préciser le statut du candidat après annulation.
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={() => handleValiderStatut()} disabled={loading}>
              Valider
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (askRemettreEnRecherche && !askRechercheOpen) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remettre en “En recherche” ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p>
              Souhaitez-vous remettre cette mission en statut <strong>En recherche</strong> ?
            </p>
            <div className="flex justify-end gap-4 pt-2">
              <Button variant="outline" onClick={() => handleValiderStatut(false)}>
                Non
              </Button>
              <Button onClick={() => handleValiderStatut(true)}>Oui</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (showCandidateDialog && commande.candidat_id) {
    return (
      <CandidateJourneeDialog
        open={true}
        onClose={() => {
          toast({ title: `Statut "${statut}" appliqué avec succès` })
          onSuccess()
          onClose()
        }}
        date={commande.date}
        secteur={commande.secteur}
        service={commande.service || ""}
        candidatId={commande.candidat_id}
        disponibilite={undefined}
        onSuccess={() => {}}
        candidatNomPrenom={
          commande.candidat
            ? `${commande.candidat.prenom} ${commande.candidat.nom}`
            : "Candidat"
        }
      />
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Statut “${statut}”`}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => handleValiderStatut()} disabled={loading}>
            Valider
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
