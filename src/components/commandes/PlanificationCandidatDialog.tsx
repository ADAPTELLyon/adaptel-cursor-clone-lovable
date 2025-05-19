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
  commande: CommandeWithCandidat
  onSuccess: () => void
}

export function PlanificationCandidatDialog({
  open,
  onClose,
  date,
  secteur,
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

  const handleSelect = async (candidatId: string) => {
    const { error: errInsert } = await supabase.from("planification").insert({
      commande_id: commande.id,
      candidat_id: candidatId,
      date,
      secteur,
      statut: "Validé",
      heure_debut_matin: commande.heure_debut_matin,
      heure_fin_matin: commande.heure_fin_matin,
      heure_debut_soir: commande.heure_debut_soir,
      heure_fin_soir: commande.heure_fin_soir,
      heure_debut_nuit: null,
      heure_fin_nuit: null,
    })

    if (errInsert) {
      toast({ title: "Erreur", description: "Échec insertion planification", variant: "destructive" })
      return
    }

    const { error: errUpdate } = await supabase
      .from("commandes")
      .update({
        candidat_id: candidatId,
        statut: "Validé",
      })
      .eq("id", commande.id)

    if (errUpdate) {
      toast({ title: "Erreur", description: "Échec mise à jour commande", variant: "destructive" })
      return
    }

    // 🔐 USER ID via utilisateurs (email)
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
          table_cible: "commandes",
          ligne_id: commande.id,
          action: "planification",
          description: `Planification de candidat ${candidatId}`,
          user_id: userId,
          date_action: new Date().toISOString(),
        })

        if (histError) {
          console.error("Erreur historique planification :", histError)
        }
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
