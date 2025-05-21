import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { statutColors } from "@/lib/colors"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import type { CommandeWithCandidat, StatutCommande } from "@/types/types-front"
import { PopupsChangementStatutContextuels } from "./PopupsChangementStatutContextuels"
import { PopupChangementStatutMissionPlanifiee } from "./PopupChangementStatutMissionPlanifiee"

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

  const handleChange = async (nouveau: StatutCommande) => {
    if (!nouveau || nouveau === statutActuel) return

    // Cas 1 – Mission planifiée : ouvrir popup avancée
    if (statutActuel === "Validé") {
      setPopupPlanifiee(nouveau)
      return
    }

    // Cas 2 – En recherche + Annule ADA = ouvrir popup justification simple
    if (statutActuel === "En recherche" && nouveau === "Annule ADA") {
      setPopupAnnuleAda(true)
      return
    }

    // Cas 3 – En recherche + autre statut = mise à jour simple
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
      toast({ title: "Erreur", description: "Impossible de changer le statut", variant: "destructive" })
    }
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-fit px-4 py-3 bg-white shadow-md border rounded space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {statuts.map((statut) => (
              <div
                key={statut}
                className="cursor-pointer flex justify-center"
                onClick={() => handleChange(statut)}
              >
                <Badge
                  className="w-full justify-center py-1 text-sm font-medium rounded-md"
                  style={{
                    backgroundColor: statutColors[statut]?.bg || "#e5e5e5",
                    color: statutColors[statut]?.text || "#000000",
                  }}
                >
                  {statut}
                </Badge>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Popup pour Annule ADA depuis En recherche */}
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

      {/* Popup avancée pour mission planifiée */}
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
