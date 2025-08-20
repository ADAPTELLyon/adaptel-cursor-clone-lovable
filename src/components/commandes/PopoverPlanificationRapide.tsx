import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { UsersIcon, Car } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat } from "@/types/types-front"
import { toast } from "@/hooks/use-toast"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"
import { PlanificationCoupureDialog } from "@/components/commandes/PlanificationCoupureDialog"

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

function normalizeStatut(s?: string | null) {
  if (!s) return ""
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
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
  const [popupCoupure, setPopupCoupure] = useState(false)
  const [candidatChoisi, setCandidatChoisi] = useState<CandidatMini | null>(null)

  useEffect(() => {
    if (!open || candidats.length === 0) return

    const fetchDispoEtPlanif = async () => {
      const jour = date.slice(0, 10)
      const candidatIds = candidats.map((c) => c.id)

      // 1) Disponibilités (avec drapeaux par créneau)
      const { data: dispoData } = await supabase
        .from("disponibilites")
        .select("candidat_id, statut, dispo_matin, dispo_soir")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", candidatIds)

      type DispoRow = { candidat_id: string; statut: string | null; dispo_matin: boolean | null; dispo_soir: boolean | null }
      const dispoMap = new Map<string, DispoRow>()
      ;(dispoData || []).forEach((d: any) => dispoMap.set(d.candidat_id, d as DispoRow))

      // 2) Occupations réelles via COMMANDES (source de vérité) – on ne retient que “Validé”
      const { data: cmdData } = await supabase
        .from("commandes")
        .select("candidat_id, statut, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", candidatIds)
        .in("statut", ["Validé"])

      // 3) Occupations via PLANIFICATION (compatibilité si certains flux y écrivent)
      const { data: planifData } = await supabase
        .from("planification")
        .select("candidat_id, statut, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", candidatIds)

      // Fusion des occupations (matin/soir)
      const planifMap = new Map<string, { matin: boolean; soir: boolean }>()
      const touch = (id: string, which: "matin" | "soir") => {
        const prev = planifMap.get(id) || { matin: false, soir: false }
        prev[which] = true
        planifMap.set(id, prev)
      }

      ;(cmdData || []).forEach((p: any) => {
        if (p.heure_debut_matin && p.heure_fin_matin) touch(p.candidat_id, "matin")
        if (p.heure_debut_soir && p.heure_fin_soir) touch(p.candidat_id, "soir")
      })
      ;(planifData || []).forEach((p: any) => {
        // on ne dépend pas du statut ici : on se base sur la présence d’heures
        if (p.heure_debut_matin && p.heure_fin_matin) touch(p.candidat_id, "matin")
        if (p.heure_debut_soir && p.heure_fin_soir) touch(p.candidat_id, "soir")
      })

      // Interdictions / Priorités (client-candidat)
      const { data: ipData } = await supabase
        .from("interdictions_priorites")
        .select("candidat_id, type")
        .eq("client_id", commande.client_id)

      const interditSet = new Set(ipData?.filter((i) => i.type === "interdiction").map((i) => i.candidat_id))
      const prioritaireSet = new Set(ipData?.filter((i) => i.type === "priorite").map((i) => i.candidat_id))

      // A déjà travaillé pour ce client (historique commandes)
      const { data: dejaData } = await supabase
        .from("commandes")
        .select("candidat_id")
        .eq("client_id", commande.client_id)

      const dejaTravailleSet = new Set((dejaData || []).map((c) => c.candidat_id).filter(Boolean))

      // Nature de la commande cible
      const isCoupure =
        !!commande.heure_debut_matin && !!commande.heure_fin_matin &&
        !!commande.heure_debut_soir && !!commande.heure_fin_soir

      const chercheMatin =
        !!commande.heure_debut_matin && !!commande.heure_fin_matin && !commande.heure_debut_soir

      const chercheSoir =
        !!commande.heure_debut_soir && !!commande.heure_fin_soir && !commande.heure_debut_matin

      const resultats: CandidatMini[] = candidats
        .filter((c) => {
          const occ = planifMap.get(c.id) || { matin: false, soir: false }
          const dispoRow = dispoMap.get(c.id)
          const statutNorm = normalizeStatut(dispoRow?.statut)

          // 1) Statut jour : on EXCLUT seulement si "Non Dispo"
          if (statutNorm === "non dispo") return false
          // "dispo", "non renseigne" (ou aucune ligne) => autorisés

          // 2) Respect des drapeaux créneau (si la ligne de dispo les précise)
          //    Si on planifie le matin et que dispo_matin === false => exclu (idem pour le soir)
          if (chercheMatin && dispoRow && dispoRow.dispo_matin === false) return false
          if (chercheSoir && dispoRow && dispoRow.dispo_soir === false) return false
          if (isCoupure && dispoRow) {
            // si les deux drapeaux sont explicitement false => exclure
            const dm = dispoRow.dispo_matin
            const ds = dispoRow.dispo_soir
            if (dm === false && ds === false) return false
          }

          // 3) Conflits créneaux existants
          if (isCoupure) {
            // Ancienne logique excluait si (matin || soir).
            // Nouvelle logique : EXCLURE uniquement si les deux créneaux sont déjà pris.
            if (occ.matin && occ.soir) return false
          } else if (chercheMatin) {
            if (occ.matin) return false
          } else if (chercheSoir) {
            if (occ.soir) return false
          }

          return true
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
  }, [open, date, secteur, candidats, commande.client_id])

  const candidatsVisibles = filteredCandidats.filter((c) =>
    `${c.nom} ${c.prenom}`.toLowerCase().includes(search.toLowerCase().trim())
  )

  const planifier = async (candidatId: string) => {
    const matin = !!(commande.heure_debut_matin && commande.heure_fin_matin)
    const soir = !!(commande.heure_debut_soir && commande.heure_fin_soir)

    if (matin && soir) {
      const candidat = filteredCandidats.find((c) => c.id === candidatId)
      if (!candidat) return
      setCandidatChoisi(candidat)
      setPopupCoupure(true)
      return
    }

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

    await supabase
      .from("commandes")
      .update({ candidat_id: candidatId, statut: "Validé" })
      .eq("id", commande.id)

    // Historique (inchangé)
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
            candidat: { nom: candidat.nom, prenom: candidat.prenom },
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
    // Pas de refetch lourd ici, on reste cohérent avec tes choix récents.
    // onRefresh?.()
  }

  return (
    <>
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
                  </div>
                </div>
              </Button>
            ))}

            {candidatsVisibles.length === 0 && (
              <div className="text-xs text-gray-500 text-center">
                {filteredCandidats.length === 0 ? "Aucun candidat éligible" : "Aucun candidat trouvé"}
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

      {popupCoupure && candidatChoisi && (
        <PlanificationCoupureDialog
          open={popupCoupure}
          onClose={() => {
            setPopupCoupure(false)
            setCandidatChoisi(null)
          }}
          commande={commande}
          candidatId={candidatChoisi.id}
          candidatNomPrenom={`${candidatChoisi.nom} ${candidatChoisi.prenom}`}
          onSuccess={() => {
            setPopupCoupure(false)
            setCandidatChoisi(null)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
