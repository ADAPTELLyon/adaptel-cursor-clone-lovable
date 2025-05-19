import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { UsersIcon } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat } from "@/types/types-front"
import { toast } from "@/hooks/use-toast"

type CandidatMini = {
  id: string
  nom: string
  prenom: string
  vehicule?: boolean
}

interface PopoverPlanificationRapideProps {
  commande: CommandeWithCandidat
  date: string
  secteur: string
  onRefresh: () => void
  trigger: React.ReactNode
  onOpenListes: () => void
}

export function PopoverPlanificationRapide({
  commande,
  date,
  secteur,
  onRefresh,
  trigger,
  onOpenListes,
}: PopoverPlanificationRapideProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [resultats, setResultats] = useState<CandidatMini[]>([])

  const fetch = async () => {
    const { data: candidatsRaw, error } = await supabase
      .from("candidats")
      .select("id, nom, prenom, vehicule, secteurs, actif")
      .eq("actif", true)
      .contains("secteurs", [secteur])

    if (error || !candidatsRaw) {
      console.error("Erreur chargement candidats:", error)
      setResultats([])
      return
    }

    setResultats(candidatsRaw)
  }

  useEffect(() => {
    if (open) {
      fetch()
      setSearch("")
    }
  }, [open])

  const candidatsFiltres = resultats.filter((c) =>
    `${c.nom} ${c.prenom}`.toLowerCase().includes(search.toLowerCase().trim())
  )

  const planifier = async (candidatId: string) => {
    const { error } = await supabase.from("planification").insert({
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

    if (error) {
      toast({ title: "Erreur", description: "Planification échouée", variant: "destructive" })
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
      toast({ title: "Erreur", description: "Mise à jour commande échouée", variant: "destructive" })
      return
    }

    // 🔐 Récupération user_id depuis email Supabase → utilisateurs
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
          description: `Planification rapide avec candidat ${candidatId}`,
          user_id: userId,
          date_action: new Date().toISOString(),
        })

        if (histError) {
          console.error("Erreur historique (planification rapide) :", histError)
        }
      }
    }

    toast({ title: "Candidat planifié avec succès" })
    setOpen(false)
    setSearch("")
    setResultats([])
    onRefresh()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 p-2 space-y-2 shadow-md">
        <div className="text-sm font-semibold">Planifier un candidat</div>
        <Input
          placeholder="Nom du candidat"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="space-y-1 max-h-40 overflow-auto">
          {candidatsFiltres.map((c) => (
            <Button
              key={c.id}
              variant="ghost"
              className="w-full justify-between"
              onClick={() => planifier(c.id)}
            >
              <span>{c.nom} {c.prenom}</span>
              {c.vehicule && <span className="text-xs">🚗</span>}
            </Button>
          ))}
          {candidatsFiltres.length === 0 && search.length >= 2 && (
            <div className="text-xs text-gray-500 text-center">Aucun candidat trouvé</div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full flex items-center gap-2"
          onClick={() => {
            setOpen(false)
            setSearch("")
            onOpenListes()
          }}
        >
          <UsersIcon className="w-4 h-4" />
          Voir les listes complètes
        </Button>
      </PopoverContent>
    </Popover>
  )
}
