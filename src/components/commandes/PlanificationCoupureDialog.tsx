import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

interface Props {
  open: boolean
  onClose: () => void
  commande: {
    id: string
    client_id: string
    date: string
    secteur: string
    service?: string
    mission_slot: number
    heure_debut_matin?: string | null
    heure_fin_matin?: string | null
    heure_debut_soir?: string | null
    heure_fin_soir?: string | null
  }
  candidatId: string
  candidatNomPrenom: string
  onSuccess: () => void
}

export function PlanificationCoupureDialog({
  open,
  onClose,
  commande,
  candidatId,
  candidatNomPrenom,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [choix, setChoix] = useState<"matin" | "soir" | "lesDeux" | null>(null)

  const planifier = async () => {
    if (!choix) return
    setLoading(true)

    const matin = choix === "matin" || choix === "lesDeux"
    const soir = choix === "soir" || choix === "lesDeux"

    const { id, date, secteur, service, mission_slot, client_id } = commande

    const insertPlanif = async () => {
      const payload: any = {
        commande_id: id,
        candidat_id: candidatId,
        date,
        secteur,
        statut: "Validé",
        heure_debut_matin: matin ? commande.heure_debut_matin : null,
        heure_fin_matin: matin ? commande.heure_fin_matin : null,
        heure_debut_soir: soir ? commande.heure_debut_soir : null,
        heure_fin_soir: soir ? commande.heure_fin_soir : null,
      }

      const { error: err1 } = await supabase.from("planification").insert(payload)
      if (err1) return { error: err1 }

      const { error: err2 } = await supabase
        .from("commandes")
        .update({
          candidat_id: candidatId,
          statut: "Validé",
          heure_debut_matin: payload.heure_debut_matin,
          heure_fin_matin: payload.heure_fin_matin,
          heure_debut_soir: payload.heure_debut_soir,
          heure_fin_soir: payload.heure_fin_soir,
        })
        .eq("id", id)

      return { error: err2 }
    }

    const createCommandeRestante = async () => {
      const heureDebutMatin = commande.heure_debut_matin
      const heureFinMatin = commande.heure_fin_matin
      const heureDebutSoir = commande.heure_debut_soir
      const heureFinSoir = commande.heure_fin_soir

      const missingMatin = matin === false && !!heureDebutMatin && !!heureFinMatin
      const missingSoir = soir === false && !!heureDebutSoir && !!heureFinSoir

      if (!missingMatin && !missingSoir) return

      // ✅ Calcul du prochain slot disponible pour ce client / secteur / date
      const { data: existingCommandes } = await supabase
        .from("commandes")
        .select("mission_slot")
        .eq("client_id", client_id)
        .eq("secteur", secteur)
        .eq("date", date)

      const existingSlots = (existingCommandes || []).map(c => c.mission_slot ?? 0)
      const slot = existingSlots.length > 0 ? Math.max(...existingSlots) + 1 : 1

      const newCommande = {
        date,
        secteur,
        service: service || null,
        statut: "En recherche",
        mission_slot: slot,
        client_id,
        heure_debut_matin: missingMatin ? heureDebutMatin : null,
        heure_fin_matin: missingMatin ? heureFinMatin : null,
        heure_debut_soir: missingSoir ? heureDebutSoir : null,
        heure_fin_soir: missingSoir ? heureFinSoir : null,
      }

      await supabase.from("commandes").insert(newCommande)
    }

    const { error } = await insertPlanif()

    if (error) {
      console.error("Erreur planification coupure :", error)
      toast({ title: "Erreur", description: "Échec planification", variant: "destructive" })
      setLoading(false)
      return
    }

    await createCommandeRestante()
    toast({ title: "Candidat planifié avec succès" })
    onSuccess()
    setLoading(false)
    onClose()
  }

  const dateAffichee = format(new Date(commande.date), "EEEE d MMMM", { locale: fr })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Planification en coupure – {candidatNomPrenom} – {dateAffichee}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <p className="text-sm text-gray-700">
            Ce client a demandé une mission pour le <strong>matin/midi</strong> et le <strong>soir</strong>.
            Sur quel(s) créneau(x) souhaitez-vous planifier ce candidat ?
          </p>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <Button
              variant={choix === "matin" ? "default" : "outline"}
              onClick={() => setChoix("matin")}
              disabled={loading}
            >
              Matin / Midi
            </Button>
            <Button
              variant={choix === "soir" ? "default" : "outline"}
              onClick={() => setChoix("soir")}
              disabled={loading}
            >
              Soir
            </Button>
            <Button
              variant={choix === "lesDeux" ? "default" : "outline"}
              onClick={() => setChoix("lesDeux")}
              disabled={loading}
              className={choix === "lesDeux" ? "bg-[#840404] text-white hover:bg-[#6e0303]" : ""}
            >
              Les deux
            </Button>
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              onClick={planifier}
              disabled={!choix || loading}
              className="bg-[#840404] text-white hover:bg-[#6e0303]"
            >
              Confirmer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
