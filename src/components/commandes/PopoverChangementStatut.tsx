import { useState } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { statutColors } from "@/lib/colors"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import type { CommandeWithCandidat, StatutCommande } from "@/types/types-front"
import { PopupsChangementStatutContextuels } from "./PopupsChangementStatutContextuels"
import { PopupChangementStatutMissionPlanifiee } from "./PopupChangementStatutMissionPlanifiee"
import { Button } from "@/components/ui/button"

interface Props {
  commande: CommandeWithCandidat
  onSuccess: () => void
  trigger: React.ReactNode
}

const statutsPossibles: Record<StatutCommande, StatutCommande[]> = {
  "En recherche": ["Non pourvue", "Annule Client", "Annule ADA"],
  "Validé": ["Annule Int", "Annule Client", "Annule ADA", "Absence"],
  "Annule Int": [],
  "Annule Client": [],
  "Annule ADA": [],
  "Non pourvue": [],
  "Absence": [],
}

export function PopoverChangementStatut({ commande, onSuccess, trigger }: Props) {
  const statutActuel = commande.statut
  const statuts = statutsPossibles[statutActuel] || []

  const [popupAnnuleAda, setPopupAnnuleAda] = useState(false)
  const [popupPlanifiee, setPopupPlanifiee] = useState<StatutCommande | null>(null)
  const [openPopover, setOpenPopover] = useState(false)

  const handleChange = async (nouveau: StatutCommande) => {
    if (!nouveau || nouveau === statutActuel) return

    setOpenPopover(false)

    if (statutActuel === "Validé") {
      setPopupPlanifiee(nouveau)
      return
    }

    if (statutActuel === "En recherche" && nouveau === "Annule ADA") {
      setPopupAnnuleAda(true)
      return
    }

    const { data: authData } = await supabase.auth.getUser()
    const userEmail = authData?.user?.email || null
    if (!userEmail) return

    const { data: userApp } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("email", userEmail)
      .single()
    const userId = userApp?.id || null
    if (!userId) return

    const { error: updateError } = await supabase
      .from("commandes")
      .update({ statut: nouveau })
      .eq("id", commande.id)

    if (!updateError) {
      await supabase.from("historique").insert({
        table_cible: "commandes",
        ligne_id: commande.id,
        action: "statut",
        description: `Changement de statut de ${statutActuel} à ${nouveau}`,
        user_id: userId,
        date_action: new Date().toISOString(),
        apres: { statut: nouveau },
      })
      toast({ title: "Statut mis à jour" })
      onSuccess()
    } else {
      toast({
        title: "Erreur",
        description: "Impossible de changer le statut",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Popover open={openPopover} onOpenChange={setOpenPopover}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="p-2 w-52 bg-white border shadow-md rounded-md space-y-1">
          {statuts.map((statut) => (
            <Button
              key={statut}
              variant="ghost"
              className="w-full justify-start text-sm font-medium"
              style={{
                backgroundColor: statutColors[statut]?.bg || "#f3f4f6",
                color: statutColors[statut]?.text || "#111827",
              }}
              onClick={() => handleChange(statut)}
            >
              {statut}
            </Button>
          ))}
        </PopoverContent>
      </Popover>

      {popupAnnuleAda && (
        <PopupsChangementStatutContextuels
          statut="Annule ADA"
          commande={commande}
          date={commande.date}
          secteur={commande.secteur}
          service={commande.service}
          onClose={() => setPopupAnnuleAda(false)}
          onSuccess={() => {
            onSuccess()
            setPopupAnnuleAda(false)
          }}
        />
      )}

      {popupPlanifiee && (
        <PopupChangementStatutMissionPlanifiee
          statut={popupPlanifiee}
          commande={commande}
          onClose={() => setPopupPlanifiee(null)}
          onSuccess={() => {
            onSuccess()
            setPopupPlanifiee(null)
          }}
        />
      )}
    </>
  )
}
