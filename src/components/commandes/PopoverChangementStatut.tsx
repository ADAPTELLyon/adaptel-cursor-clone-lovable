import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { statutColors } from "@/lib/colors"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import type { CommandeWithCandidat, StatutCommande } from "@/types/types-front"

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

  const handleChange = async (nouveau: StatutCommande) => {
    if (!nouveau || nouveau === statutActuel) return

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
    <Popover>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>

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
  )
}
