import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { UsersIcon, Car, Ban, Check, ArrowDownCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat } from "@/types/types-front"
import { toast } from "@/hooks/use-toast"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"

type CandidatMini = {
  id: string
  nom: string
  prenom: string
  vehicule?: boolean
  interditClient?: boolean
  prioritaire?: boolean
  dejaTravaille?: boolean
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
  const { data: candidats = [] } = useCandidatsBySecteur(secteur)
  const [filteredCandidats, setFilteredCandidats] = useState<CandidatMini[]>([])

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
      dispoData?.forEach((d) => dispoMap.set(d.candidat_id, d.statut))

      const { data: planifData } = await supabase
        .from("planification")
        .select("candidat_id")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", candidatIds)

      const planifieSet = new Set(planifData?.map((p) => p.candidat_id) || [])

      const { data: ipData } = await supabase
        .from("interdictions_priorites")
        .select("candidat_id, type")
        .eq("client_id", commande.client_id)

      const interditSet = new Set(
        ipData?.filter((i) => i.type === "interdiction").map((i) => i.candidat_id)
      )
      const prioritaireSet = new Set(
        ipData?.filter((i) => i.type === "priorite").map((i) => i.candidat_id)
      )

      const { data: dejaData } = await supabase
        .from("commandes")
        .select("candidat_id")
        .eq("client_id", commande.client_id)

      const dejaTravailleSet = new Set(
        (dejaData || []).map((c) => c.candidat_id).filter(Boolean)
      )

      const resultats: CandidatMini[] = candidats
        .filter((c) => {
          return (
            planifieSet.has(c.id) ||
            dispoMap.get(c.id) === "Dispo" ||
            !dispoMap.has(c.id)
          )
        })
        .map((c) => ({
          id: c.id,
          nom: c.nom,
          prenom: c.prenom,
          vehicule: c.vehicule,
          interditClient: interditSet.has(c.id),
          prioritaire: prioritaireSet.has(c.id),
          dejaTravaille: dejaTravailleSet.has(c.id),
        }))

      setFilteredCandidats(resultats)
    }

    fetchDispoEtPlanif()
  }, [open, date, secteur, candidats])

  const candidatsVisibles = filteredCandidats.filter((c) =>
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
    })

    if (error) {
      toast({ title: "Erreur", description: "Échec planification", variant: "destructive" })
      return
    }

    const { error: errUpdate } = await supabase
      .from("commandes")
      .update({ candidat_id: candidatId, statut: "Validé" })
      .eq("id", commande.id)

    if (errUpdate) {
      toast({ title: "Erreur", description: "Échec mise à jour", variant: "destructive" })
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
      const candidat = filteredCandidats.find(c => c.id === candidatId)

      if (userId && candidat) {
        await supabase.from("historique").insert({
          table_cible: "commandes",
          ligne_id: commande.id,
          action: "planification",
          description: "Planification via PopoverPlanificationRapide",
          user_id: userId,
          date_action: new Date().toISOString(),
          apres: {
            date,
            candidat: {
              nom: candidat.nom,
              prenom: candidat.prenom,
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
    setOpen(false)
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
          {candidatsVisibles.map((c) => (
            <Button
              key={c.id}
              variant="ghost"
              className="w-full justify-between"
              onClick={() => planifier(c.id)}
            >
              <div className="flex items-center gap-2">
                <span>{c.nom} {c.prenom}</span>
                <div className="flex items-center gap-1">
                  {c.vehicule && (
                    <span className="p-1 rounded-full bg-muted" title="Véhicule">
                      <Car className="w-3 h-3 text-blue-500" />
                    </span>
                  )}
                  {c.interditClient && (
                    <span className="p-1 rounded-full bg-muted" title="Interdit client">
                      <Ban className="w-3 h-3 text-red-500" />
                    </span>
                  )}
                  {c.prioritaire && (
                    <span className="p-1 rounded-full bg-muted" title="Prioritaire">
                      <Check className="w-3 h-3 text-green-600" />
                    </span>
                  )}
                  {c.dejaTravaille && (
                    <span className="p-1 rounded-full bg-muted" title="A déjà travaillé ici">
                      <ArrowDownCircle className="w-3 h-3 text-violet-600" />
                    </span>
                  )}
                </div>
              </div>
            </Button>
          ))}

          {candidatsVisibles.length === 0 && (
            <div className="text-xs text-gray-500 text-center">
              {filteredCandidats.length === 0 ? "Chargement..." : "Aucun candidat trouvé"}
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full flex items-center gap-2"
          onClick={() => {
            setOpen(false)
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
