import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "@/hooks/use-toast"
import type { CommandeWithCandidat } from "@/types/types-front"

type CandidatMini = {
  id: string
  nom: string
  prenom: string
  vehicule?: boolean
}

interface PlanificationCandidatDialogProps {
  open: boolean
  onClose: () => void
  date: string
  secteur: string
  service?: string
  commande: CommandeWithCandidat
  onSuccess: () => void
}

export function PlanificationCandidatDialog({
  open,
  onClose,
  date,
  secteur,
  service,
  commande,
  onSuccess,
}: PlanificationCandidatDialogProps) {
  const { data: candidats = [] } = useCandidatsBySecteur(secteur)
  const [dispos, setDispos] = useState<CandidatMini[]>([])
  const [nonRenseignes, setNonRenseignes] = useState<CandidatMini[]>([])
  const [planifies, setPlanifies] = useState<CandidatMini[]>([])

  useEffect(() => {
    if (!open || candidats.length === 0) return

    const fetchDispoEtPlanif = async () => {
      const jour = date.slice(0, 10)
      const candidatIds = candidats.map((c) => c.id)

      const { data: dispoData } = await supabase
        .from("disponibilites")
        .select("candidat_id, statut")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", candidatIds)

      const dispoMap = new Map<string, string>()
      for (const d of dispoData || []) {
        dispoMap.set(d.candidat_id, d.statut)
      }

      const { data: planifData } = await supabase
        .from("planification")
        .select("candidat_id")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", candidatIds)

      const planifieSet = new Set(planifData?.map((p) => p.candidat_id) || [])

      const dispoList: CandidatMini[] = []
      const planifieList: CandidatMini[] = []
      const nonList: CandidatMini[] = []

      for (const c of candidats) {
        const mini: CandidatMini = {
          id: c.id,
          nom: c.nom,
          prenom: c.prenom,
          vehicule: c.vehicule,
        }

        if (planifieSet.has(c.id)) {
          planifieList.push(mini)
        } else if (dispoMap.get(c.id) === "Dispo") {
          dispoList.push(mini)
        } else if (!dispoMap.has(c.id)) {
          nonList.push(mini)
        }
      }

      setDispos(dispoList)
      setPlanifies(planifieList)
      setNonRenseignes(nonList)
    }

    fetchDispoEtPlanif()
  }, [open, date, secteur, candidats])

  const hasHeures = (debut?: string | null, fin?: string | null) => !!(debut && fin)

  const handleSelect = async (candidatId: string) => {
    const jour = date.slice(0, 10)
    const candidat = candidats.find((c) => c.id === candidatId)

    const { data: existingPlanifs, error: planifError } = await supabase
      .from("planification")
      .select("heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
      .eq("candidat_id", candidatId)
      .eq("date", jour)

    if (planifError) {
      toast({ title: "Erreur", description: "Erreur vérification conflit", variant: "destructive" })
      return
    }

    const conflitMatin =
      hasHeures(commande.heure_debut_matin, commande.heure_fin_matin) &&
      existingPlanifs?.some((p) => hasHeures(p.heure_debut_matin, p.heure_fin_matin))

    const conflitSoir =
      hasHeures(commande.heure_debut_soir, commande.heure_fin_soir) &&
      existingPlanifs?.some((p) => hasHeures(p.heure_debut_soir, p.heure_fin_soir))

    if (conflitMatin || conflitSoir) {
      toast({
        title: "Conflit de créneau",
        description: "Ce candidat a déjà une mission sur ce créneau.",
        variant: "destructive",
      })
      return
    }

    const { error: errInsertPlanif } = await supabase.from("planification").insert({
      commande_id: commande.id,
      candidat_id: candidatId,
      date,
      secteur,
      statut: "Validé", // ✅ OBLIGATOIRE dans ta table
      heure_debut_matin: commande.heure_debut_matin,
      heure_fin_matin: commande.heure_fin_matin,
      heure_debut_soir: commande.heure_debut_soir,
      heure_fin_soir: commande.heure_fin_soir,
      heure_debut_nuit: null,
      heure_fin_nuit: null,
    })

    if (errInsertPlanif) {
      toast({ title: "Erreur", description: "Échec insertion planification", variant: "destructive" })
      return
    }

    const { error: errUpdateCommande } = await supabase
      .from("commandes")
      .update({
        candidat_id: candidatId,
        statut: "Validé",
      })
      .eq("id", commande.id)

    if (errUpdateCommande) {
      toast({ title: "Erreur", description: "Échec mise à jour commande", variant: "destructive" })
      return
    }

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
          action: "planification",
          description: "Planification via popup PlanificationCandidatDialog",
          user_id: userId,
          date_action: new Date().toISOString(),
          apres: {
            date,
            candidat: {
              nom: candidat?.nom || "",
              prenom: candidat?.prenom || "",
            },
            heure_debut_matin: commande.heure_debut_matin,
            heure_fin_matin: commande.heure_fin_matin,
            heure_debut_soir: commande.heure_debut_soir,
            heure_fin_soir: commande.heure_fin_soir,
          },
        })
      }
    }

    toast({ title: "Candidat planifié avec succès" })
    onClose()
    onSuccess()
  }

  const dateFormatee = format(new Date(date), "eeee d MMMM", { locale: fr })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Planifier un candidat – {secteur}, {dateFormatee}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <h4 className="font-semibold mb-2 text-green-700">🟢 Disponibles</h4>
            {dispos.length === 0 && <div className="text-muted-foreground italic">Aucun</div>}
            {dispos.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                className="w-full mb-2 justify-between"
                onClick={() => handleSelect(c.id)}
              >
                {c.nom} {c.prenom}
                {c.vehicule && <span className="ml-2">🚗</span>}
              </Button>
            ))}
          </div>

          <div>
            <h4 className="font-semibold mb-2 text-gray-600">⚪️ Non renseignés</h4>
            {nonRenseignes.length === 0 && <div className="text-muted-foreground italic">Aucun</div>}
            {nonRenseignes.map((c) => (
              <Button
                key={c.id}
                variant="ghost"
                className="w-full mb-2 justify-between"
                onClick={() => handleSelect(c.id)}
              >
                {c.nom} {c.prenom}
                {c.vehicule && <span className="ml-2">🚗</span>}
              </Button>
            ))}
          </div>

          <div>
            <h4 className="font-semibold mb-2 text-yellow-800">🟡 Déjà planifiés</h4>
            {planifies.length === 0 && <div className="text-muted-foreground italic">Aucun</div>}
            {planifies.map((c) => (
              <Button
                key={c.id}
                variant="secondary"
                className="w-full mb-2 justify-between"
                onClick={() => handleSelect(c.id)}
              >
                {c.nom} {c.prenom}
                {c.vehicule && <span className="ml-2">🚗</span>}
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
