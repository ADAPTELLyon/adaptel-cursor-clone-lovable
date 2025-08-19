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
import { startOfWeek, addDays, format } from "date-fns"
import { CandidateJourneeDialog } from "@/components/Planning/CandidateJourneeDialog"
import { toast } from "@/hooks/use-toast"

interface Props {
  statut: StatutCommande
  commande: CommandeWithCandidat
  onClose: () => void
  onSuccess: () => void
}

type CommandeLite = {
  id: string
  date: string
  service?: string | null
  heure_debut_matin?: string | null
  heure_fin_matin?: string | null
  heure_debut_soir?: string | null
  heure_fin_soir?: string | null
  heure_debut_nuit?: string | null
  heure_fin_nuit?: string | null
  mission_slot: number | null
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

  // 1) Catégories de flux
  const askStatutCandidat = ["Annule ADA", "Annule Client"].includes(statut)
  const askRemettreEnRecherche = ["Annule Int", "Absence"].includes(statut)
  const isScopeOnlyStatus = ["Annule Client", "Annule ADA", "Non pourvue"].includes(statut)

  // 2) Pop-up de portée (jour vs semaine)
  const [askScopeOpen, setAskScopeOpen] = useState(false)
  const [targets, setTargets] = useState<CommandeLite[]>([])
  const [candidateName, setCandidateName] = useState<string>("")
  const [clientLabel, setClientLabel] = useState<string>("")
  const [weekLabel, setWeekLabel] = useState<string>("")

  // Helpers
  const weekBounds = (d: string) => {
    const base = startOfWeek(new Date(d), { weekStartsOn: 1 })
    const monday = base
    const sunday = addDays(base, 6)
    return {
      mondayStr: format(monday, "yyyy-MM-dd"),
      sundayStr: format(sunday, "yyyy-MM-dd"),
      label: format(monday, "'Semaine' II"),
    }
  }

  const getUserId = async (): Promise<string | null> => {
    const { data: authData } = await supabase.auth.getUser()
    const userEmail = authData?.user?.email || null
    if (!userEmail) return null
    const { data: userApp } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("email", userEmail)
      .single()
    return userApp?.id || null
  }

  const insertHistorique = async (userId: string, cmd: CommandeWithCandidat | CommandeLite, extra: any = {}) => {
    await supabase.from("historique").insert({
      table_cible: "commandes",
      ligne_id: (cmd as any).id,
      action: "statut",
      user_id: userId,
      date_action: new Date().toISOString(),
      description: `Statut ${statut} appliqué`,
      apres: {
        statut,
        ...(statut === "Annule ADA" && motif ? { complement_motif: motif } : {}),
        remettre_en_recherche: !!extra.remettre_en_recherche,
        scope: extra.scope || "single",
      },
    })
  }

  const computeNewSlot = async (
    client_id: string,
    secteur: string,
    mondayStr: string,
    sundayStr: string
  ): Promise<number> => {
    const { data: autres } = await supabase
      .from("commandes")
      .select("mission_slot")
      .eq("client_id", client_id)
      .eq("secteur", secteur)
      .gte("date", mondayStr)
      .lte("date", sundayStr)
      .in("statut", ["En recherche", "Validé", "Absence", "Annule Int"])

    const slots =
      (autres || [])
        .map((c) => c.mission_slot)
        .filter((s): s is number => typeof s === "number") || []

    const maxSlot = slots.length ? Math.max(...slots) : 0
    return maxSlot + 1
  }

  const toLite = (c: CommandeWithCandidat): CommandeLite => ({
    id: c.id,
    date: c.date,
    service: c.service ?? null,
    heure_debut_matin: c.heure_debut_matin ?? null,
    heure_fin_matin: c.heure_fin_matin ?? null,
    heure_debut_soir: c.heure_debut_soir ?? null,
    heure_fin_soir: c.heure_fin_soir ?? null,
    heure_debut_nuit: c.heure_debut_nuit ?? null,
    heure_fin_nuit: c.heure_fin_nuit ?? null,
    mission_slot: c.mission_slot ?? null,
  })

  const fetchWeekTargetsForCandidate = async (): Promise<CommandeLite[]> => {
    if (!commande.candidat_id) return [toLite(commande)]
    const { mondayStr, sundayStr, label } = weekBounds(commande.date)
    const { data } = await supabase
      .from("commandes")
      .select(
        "id,date,service,heure_debut_matin,heure_fin_matin,heure_debut_soir,heure_fin_soir,heure_debut_nuit,heure_fin_nuit,mission_slot"
      )
      .eq("client_id", commande.client_id)
      .eq("secteur", commande.secteur)
      .eq("candidat_id", commande.candidat_id)
      .eq("statut", "Validé")
      .gte("date", mondayStr)
      .lte("date", sundayStr)

    const base = data || []
    const exists = base.some((c) => c.id === commande.id)
    const merged = exists ? base : [...base, toLite(commande)]
    setWeekLabel(label)
    return merged.sort((a, b) => a.date.localeCompare(b.date))
  }

  // =========================
  // Applique “remise en recherche” (Annule Int / Absence)
  // =========================
  const applyRemiseEnRecherche = async (applyAll: boolean) => {
    try {
      setLoading(true)

      const userId = await getUserId()
      if (!userId) {
        toast({ title: "Utilisateur introuvable", variant: "destructive" })
        setLoading(false)
        return
      }

      const { mondayStr, sundayStr } = weekBounds(commande.date)
      const newSlot = await computeNewSlot(commande.client_id, commande.secteur, mondayStr, sundayStr)

      const selectedTargets = applyAll ? targets : [toLite(commande)]
      const ids = selectedTargets.map((t) => t.id)

      // 1) Supprimer planifs pour ces jours (si candidat)
      if (commande.candidat_id) {
        await supabase
          .from("planification")
          .delete()
          .in("commande_id", ids)
          .eq("candidat_id", commande.candidat_id)
      }

      // 2) Mettre le statut demandé sur les lignes sources
      await supabase
        .from("commandes")
        .update({
          statut,
          ...(statut === "Annule ADA" && motif ? { complement_motif: motif } : {}),
        })
        .in("id", ids)

      // Historique
      await Promise.all(
        selectedTargets.map((t) =>
          insertHistorique(userId, t, {
            remettre_en_recherche: true,
            scope: applyAll ? "all_week" : "single",
          })
        )
      )

      // 3) Recréer en “En recherche” avec slot commun
      const inserts = selectedTargets.map((t) => ({
        client_id: commande.client_id,
        date: t.date,
        secteur: commande.secteur,
        service: t.service ?? commande.service ?? null,
        statut: "En recherche" as const,
        heure_debut_matin: t.heure_debut_matin ?? commande.heure_debut_matin ?? null,
        heure_fin_matin: t.heure_fin_matin ?? commande.heure_fin_matin ?? null,
        heure_debut_soir: t.heure_debut_soir ?? commande.heure_debut_soir ?? null,
        heure_fin_soir: t.heure_fin_soir ?? commande.heure_fin_soir ?? null,
        heure_debut_nuit: t.heure_debut_nuit ?? commande.heure_debut_nuit ?? null,
        heure_fin_nuit: t.heure_fin_nuit ?? commande.heure_fin_nuit ?? null,
        mission_slot: newSlot,
        motif_contrat: commande.motif_contrat || "",
      }))

      if (inserts.length > 0) {
        const { error: insertErr } = await supabase.from("commandes").insert(inserts)
        if (insertErr) {
          console.error(insertErr)
          toast({
            title: "Erreur lors de la recréation des missions",
            description: insertErr.message,
            variant: "destructive",
          })
          setLoading(false)
          return
        }
      }

      toast({
        title: `Statut "${statut}" appliqué`,
        description: applyAll
          ? "Toutes les journées ont été remises en « En recherche » sur une même ligne."
          : "La journée a été remise en « En recherche ».",
      })

      onSuccess()
      onClose()
    } catch (e: any) {
      console.error(e)
      toast({
        title: "Erreur inattendue",
        description: e?.message || "Veuillez réessayer.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setAskScopeOpen(false)
    }
  }

  // =========================
  // Applique un statut SANS recréation (Annule Client / Annule ADA / Non pourvue)
  // =========================
  const applyScopeNoRecreate = async (applyAll: boolean) => {
    try {
      setLoading(true)

      const userId = await getUserId()
      if (!userId) {
        toast({ title: "Utilisateur introuvable", variant: "destructive" })
        setLoading(false)
        return
      }

      const selectedTargets = applyAll ? targets : [toLite(commande)]
      const ids = selectedTargets.map((t) => t.id)

      // Supprimer planifs (si candidat affecté)
      if (commande.candidat_id) {
        await supabase
          .from("planification")
          .delete()
          .in("commande_id", ids)
          .eq("candidat_id", commande.candidat_id)
      }

      // Mettre le statut (et le motif si ADA)
      await supabase
        .from("commandes")
        .update({
          statut,
          ...(statut === "Annule ADA" && motif ? { complement_motif: motif } : {}),
        })
        .in("id", ids)

      await Promise.all(
        selectedTargets.map((t) =>
          insertHistorique(userId, t, {
            remettre_en_recherche: false,
            scope: applyAll ? "all_week" : "single",
          })
        )
      )

      if (askStatutCandidat && commande.candidat_id) {
        // On affiche le dialog statut candidat une seule fois (jour courant)
        setShowCandidateDialog(true)
        setLoading(false)
        setAskScopeOpen(false)
        return
      }

      toast({
        title: `Statut "${statut}" appliqué`,
        description: applyAll
          ? "Statut appliqué à toutes les journées de la semaine."
          : "Statut appliqué sur la journée.",
      })

      onSuccess()
      onClose()
    } catch (e: any) {
      console.error(e)
      toast({
        title: "Erreur inattendue",
        description: e?.message || "Veuillez réessayer.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setAskScopeOpen(false)
    }
  }

  // =========================
  // Handler principal (bouton “Valider” des mini-popups)
  // =========================
  const handleValiderStatut = async (remettreEnRecherche: boolean = false) => {
    try {
      setLoading(true)

      const userId = await getUserId()
      if (!userId) {
        toast({ title: "Utilisateur introuvable", variant: "destructive" })
        setLoading(false)
        return
      }

      // Toujours : supprimer la planif du jour courant si présente (sécurisé)
      if (commande.candidat_id) {
        await supabase
          .from("planification")
          .delete()
          .eq("commande_id", commande.id)
          .eq("candidat_id", commande.candidat_id)
      }

      // 1) Statuts “remettre en recherche ?” → on décide après la question de portée
      if (remettreEnRecherche && askRemettreEnRecherche) {
        const group = await fetchWeekTargetsForCandidate()
        setTargets(group)
        setCandidateName(
          commande.candidat
            ? `${commande.candidat.prenom} ${commande.candidat.nom}`
            : "le candidat"
        )
        setClientLabel(commande.client?.nom || "le client")
        setAskScopeOpen(true)
        setLoading(false)
        return
      }

      // 2) Statuts “portée seulement” → on ouvre directement la portée
      if (isScopeOnlyStatus) {
        const group = await fetchWeekTargetsForCandidate()
        setTargets(group)
        setCandidateName(
          commande.candidat
            ? `${commande.candidat.prenom} ${commande.candidat.nom}`
            : "le candidat"
        )
        setClientLabel(commande.client?.nom || "le client")
        setAskScopeOpen(true)
        setLoading(false)
        return
      }

      // 3) Application simple (ex: Annule Int/Absence si l’utilisateur a répondu “Non” à la remise en recherche)
      await supabase
        .from("commandes")
        .update({
          statut,
          ...(statut === "Annule ADA" && motif ? { complement_motif: motif } : {}),
          ...(commande.candidat_id ? { candidat_id: commande.candidat_id } : {}),
        })
        .eq("id", commande.id)

      await insertHistorique(userId, commande, { remettre_en_recherche: false, scope: "single" })

      if (askStatutCandidat) {
        setShowCandidateDialog(true)
        setLoading(false)
        return
      }

      toast({ title: `Statut "${statut}" appliqué avec succès` })
      onSuccess()
      onClose()
    } catch (e: any) {
      console.error(e)
      toast({
        title: "Erreur inattendue",
        description: e?.message || "Veuillez réessayer.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // =========================
  // Rendus conditionnels (popups)
  // =========================

  // Annule ADA : demande de motif (avant portée)
  if (statut === "Annule ADA" && !showCandidateDialog && !askScopeOpen) {
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
              <Button
                onClick={() => handleValiderStatut(false)} // on ouvre la portée ensuite
                disabled={!motif.trim() || loading}
              >
                Continuer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Annule Client : ouverture vers portée
  if (statut === "Annule Client" && !showCandidateDialog && !askScopeOpen) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annulation Client</DialogTitle>
          </DialogHeader>
          <div className="text-sm pt-2">
            Voulez-vous appliquer ce statut sur <strong>toute la semaine</strong> (même candidat) ?
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={() => handleValiderStatut(false)} disabled={loading}>
              Continuer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Non pourvue : ouverture vers portée
  if (statut === "Non pourvue" && !askScopeOpen) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Statut “Non pourvue”</DialogTitle>
          </DialogHeader>
          <div className="text-sm pt-2">
            Voulez-vous appliquer ce statut sur <strong>toute la semaine</strong> (même candidat) ?
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={() => handleValiderStatut(false)} disabled={loading}>
              Continuer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // 1er popup – Remettre en En recherche ? (Annule Int / Absence)
  if (askRemettreEnRecherche && !askScopeOpen && !showCandidateDialog) {
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
              <Button variant="outline" onClick={() => handleValiderStatut(false)} disabled={loading}>
                Non
              </Button>
              <Button onClick={() => handleValiderStatut(true)} disabled={loading}>
                Oui
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // 2e popup – Portée (jour vs semaine) : utilisé pour
  // - Annule Int / Absence quand “remettre en recherche = Oui”
  // - Annule Client / Annule ADA / Non pourvue (toujours, sans recréation)
  if (askScopeOpen && !showCandidateDialog) {
    const isRecreateFlow = ["Annule Int", "Absence"].includes(statut)
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Appliquer à toutes les journées de {candidateName} ?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p>
              {candidateName} est planifié {weekLabel} chez {clientLabel} (secteur {commande.secteur}).
            </p>

            {isRecreateFlow ? (
              <>
                <p>Choisissez la portée :</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Uniquement ce jour</strong> : recréer la mission “En recherche” pour la date{" "}
                    {format(new Date(commande.date), "dd/MM/yyyy")}.
                  </li>
                  <li>
                    <strong>Toutes les journées</strong> : appliquer “{statut}” sur chaque journée concernée,
                    supprimer les planifications, puis recréer toutes les missions “En recherche” sur une même ligne (slot identique).
                  </li>
                </ul>
              </>
            ) : (
              <>
                <p>Choisissez la portée :</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Uniquement ce jour</strong> : appliquer “{statut}” sur la date{" "}
                    {format(new Date(commande.date), "dd/MM/yyyy")}.
                  </li>
                  <li>
                    <strong>Toute la semaine</strong> : appliquer “{statut}” sur toutes les journées de la semaine pour ce candidat.
                  </li>
                </ul>
              </>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => (isRecreateFlow ? applyRemiseEnRecherche(false) : applyScopeNoRecreate(false))}
                disabled={loading}
              >
                Uniquement ce jour
              </Button>
              <Button
                onClick={() => (isRecreateFlow ? applyRemiseEnRecherche(true) : applyScopeNoRecreate(true))}
                disabled={loading}
              >
                Toute la semaine
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Flux post Annule ADA / Annule Client → statut candidat (dialog existant)
  if (askStatutCandidat && showCandidateDialog && commande.candidat_id) {
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

  // Fallback générique (si un flux passait à travers)
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Statut “${statut}”`}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
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
