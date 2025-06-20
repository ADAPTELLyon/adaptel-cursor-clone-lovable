import { useEffect, useState } from "react"
import { format, startOfWeek, addDays, getWeek, subWeeks, addWeeks } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import { ColonneCandidate } from "@/components/Planning/ColonneCandidate"
import { CellulePlanningCandidate } from "@/components/Planning/CellulePlanningCandidate"
import type { JourPlanningCandidat, StatutCommande } from "@/types/types-front"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Info, Check, ChevronLeft, ChevronRight } from "lucide-react"

export default function PlanningMiniCandidat({ candidatId }: { candidatId: string }) {
  const [planning, setPlanning] = useState<JourPlanningCandidat[]>([])
  const [candidatNomPrenom, setCandidatNomPrenom] = useState("")
  const [editingCommentDate, setEditingCommentDate] = useState<string | null>(null)
  const [commentaireTemp, setCommentaireTemp] = useState("")
  const [currentStartDate, setCurrentStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))

  const dates = Array.from({ length: 7 }).map((_, i) =>
    format(addDays(currentStartDate, i), "yyyy-MM-dd")
  )

  const numeroSemaine = getWeek(currentStartDate, { weekStartsOn: 1 })

  const fetchPlanning = async () => {
    const { data: disponibilites } = await supabase
      .from("disponibilites")
      .select("*, candidat:candidat_id(nom, prenom)")
      .eq("candidat_id", candidatId)
      .in("date", dates)

    const { data: commandes } = await supabase
      .from("commandes")
      .select("*, client:client_id(nom), candidat:candidat_id(nom, prenom)")
      .eq("candidat_id", candidatId)
      .in("date", dates)

    const { data: candidatData } = await supabase
      .from("candidats")
      .select("nom, prenom")
      .eq("id", candidatId)
      .single()

    if (candidatData) {
      setCandidatNomPrenom(`${candidatData.prenom} ${candidatData.nom}`)
    }

    const result: JourPlanningCandidat[] = dates.map((date) => {
      const dispo = disponibilites?.find((d) => d.date === date)
      const cmd = commandes?.find((c) => c.date === date)

      return {
        date,
        secteur: dispo?.secteur || cmd?.secteur || "Étages",
        service: dispo?.service || cmd?.service || null,
        disponibilite: dispo
          ? {
              id: dispo.id,
              date: dispo.date,
              secteur: dispo.secteur,
              service: dispo.service,
              statut: (dispo.statut || "Non Renseigné") as "Dispo" | "Non Dispo" | "Non Renseigné",
              matin: dispo.dispo_matin || false,
              soir: dispo.dispo_soir || false,
              nuit: dispo.dispo_nuit || false,
              commentaire: dispo.commentaire || "",
              candidat_id: dispo.candidat_id,
              created_at: dispo.created_at,
              updated_at: dispo.updated_at,
              candidat: dispo.candidat,
            }
          : undefined,
        commande: cmd
          ? {
              id: cmd.id,
              date: cmd.date,
              secteur: cmd.secteur,
              service: cmd.service,
              statut: cmd.statut as StatutCommande,
              client_id: cmd.client_id,
              candidat_id: cmd.candidat_id,
              heure_debut_matin: cmd.heure_debut_matin,
              heure_fin_matin: cmd.heure_fin_matin,
              heure_debut_soir: cmd.heure_debut_soir,
              heure_fin_soir: cmd.heure_fin_soir,
              heure_debut_nuit: cmd.heure_debut_nuit,
              heure_fin_nuit: cmd.heure_fin_nuit,
              commentaire: cmd.commentaire,
              created_at: cmd.created_at,
              mission_slot: cmd.mission_slot,
              candidat: cmd.candidat,
              client: cmd.client,
            }
          : undefined,
      }
    })

    setPlanning(result)
  }

  useEffect(() => {
    if (candidatId) fetchPlanning()
  }, [candidatId, currentStartDate])

  const groupedByDate: Record<string, JourPlanningCandidat[]> = {}
  planning.forEach((entry) => {
    const date = format(new Date(entry.date), "yyyy-MM-dd")
    if (!groupedByDate[date]) groupedByDate[date] = []
    groupedByDate[date].push(entry)
  })

  const saveComment = async (jour: JourPlanningCandidat) => {
    const trimmed = commentaireTemp.trim()
    if (!trimmed) return

    if (jour.commande) {
      await supabase
        .from("commandes")
        .update({ commentaire: trimmed })
        .eq("id", jour.commande.id)
    } else if (jour.disponibilite) {
      await supabase
        .from("disponibilites")
        .update({ commentaire: trimmed })
        .eq("id", jour.disponibilite.id)
    }

    setEditingCommentDate(null)
    setCommentaireTemp("")
    fetchPlanning()
  }

  return (
    <div className="border rounded-lg overflow-hidden shadow-sm mt-8">
      {/* Navigation haut */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <Button variant="ghost" size="icon" onClick={() => setCurrentStartDate(prev => subWeeks(prev, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-sm font-medium text-gray-800">Semaine {numeroSemaine}</div>
        <Button variant="ghost" size="icon" onClick={() => setCurrentStartDate(prev => addWeeks(prev, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Entête jours */}
      <div className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white">
        <div className="p-3 border-r flex items-center justify-center">
          Semaine {numeroSemaine}
        </div>
        {dates.map((_, i) => {
          const jour = addDays(currentStartDate, i)
          return (
            <div key={i} className="p-3 border-r text-center leading-tight">
              <div>{format(jour, "eeee", { locale: fr })}</div>
              <div className="text-xs">{format(jour, "dd MMMM", { locale: fr })}</div>
            </div>
          )
        })}
      </div>

      {/* Lignes planning */}
      <div className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] border-t text-sm">
        <div className="p-3 border-r bg-white text-gray-800 text-sm leading-tight">
          <div className="font-semibold">{candidatNomPrenom}</div>
          <div className="text-xs text-gray-500">Semaine {numeroSemaine}</div>
        </div>

        {dates.map((dateStr, i) => {
          const jourCells = groupedByDate[dateStr] || []
          const jourCell = jourCells[0]
          const commentaire =
            jourCell?.commande?.commentaire || jourCell?.disponibilite?.commentaire || ""

          return (
            <div key={i} className="border-r p-2 h-28 relative">
              <CellulePlanningCandidate
                disponibilite={jourCell?.disponibilite || null}
                commande={jourCell?.commande || null}
                secteur={jourCell?.secteur || "Étages"}
                date={dateStr}
                candidatId={candidatId}
                service={jourCell?.service || ""}
                onSuccess={() => fetchPlanning()}
                nomPrenom={candidatNomPrenom}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
