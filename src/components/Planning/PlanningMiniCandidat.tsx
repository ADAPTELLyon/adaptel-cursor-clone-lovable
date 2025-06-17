import { useEffect, useState } from "react"
import { format, startOfWeek, addDays } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import { ColonneCandidate } from "@/components/Planning/ColonneCandidate"
import { CellulePlanningCandidate } from "@/components/Planning/CellulePlanningCandidate"
import type { JourPlanningCandidat } from "@/types/types-front"

export function PlanningMiniCandidat({ candidatId }: { candidatId: string }) {
  const [planning, setPlanning] = useState<JourPlanningCandidat[]>([])
  const [loading, setLoading] = useState(true)

  const startOfWeekDate = startOfWeek(new Date(), { weekStartsOn: 1 })
  const dates = Array.from({ length: 7 }).map((_, i) =>
    format(addDays(startOfWeekDate, i), "yyyy-MM-dd")
  )

  useEffect(() => {
    const fetchPlanning = async () => {
      setLoading(true)

      const { data, error } = await supabase.rpc("get_planning_candidat", {
        candidat_id_param: candidatId,
        start_date_param: dates[0],
        end_date_param: dates[6],
      })

      if (!error && data) {
        const mapped: JourPlanningCandidat[] = data.map((item: any) => {
          return {
            date: item.date,
            secteur: item.secteur,
            service: item.service,
            commande: item.commande,
            disponibilite: item.disponibilite
              ? {
                  id: "manual",
                  date: item.date,
                  secteur: item.secteur,
                  service: item.service,
                  statut: item.disponibilite.statut,
                  matin: item.disponibilite.dispo_matin,
                  soir: item.disponibilite.dispo_soir,
                  nuit: item.disponibilite.dispo_nuit,
                  commentaire: item.disponibilite.commentaire,
                  created_at: "",
                  candidat_id: item.disponibilite.candidat?.id || "",
                  candidat: item.disponibilite.candidat,
                }
              : undefined,
          }
        })

        setPlanning(mapped)
      }

      setLoading(false)
    }

    if (candidatId) fetchPlanning()
  }, [candidatId])

  const groupedByDate: Record<string, JourPlanningCandidat[]> = {}
  planning.forEach((entry) => {
    const date = format(new Date(entry.date), "yyyy-MM-dd")
    if (!groupedByDate[date]) groupedByDate[date] = []
    groupedByDate[date].push(entry)
  })

  return (
    <div className="border rounded-lg overflow-hidden shadow-sm mt-8">
      <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white">
        <div className="p-3 border-r flex items-center justify-center">
          Semaine en cours
        </div>
        {dates.map((_, i) => {
          const jour = addDays(startOfWeekDate, i)
          return (
            <div key={i} className="p-3 border-r text-center leading-tight">
              <div>{format(jour, "eeee", { locale: fr })}</div>
              <div className="text-xs">{format(jour, "dd MMMM", { locale: fr })}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] border-t text-sm">
        <ColonneCandidate
          nomComplet="Planning de la semaine"
          secteur=""
          service=""
          semaine=""
          statutGlobal=""
          candidatId={candidatId}
        />

        {dates.map((dateStr, i) => {
          const jourCells = groupedByDate[dateStr] || []
          const jourCell = jourCells[0]
          return (
            <div key={i} className="border-r p-2 h-28 relative">
              <CellulePlanningCandidate
                disponibilite={jourCell?.disponibilite || null}
                commande={jourCell?.commande || null}
                secteur={jourCell?.secteur || ""}
                date={dateStr}
                candidatId={candidatId}
                service={jourCell?.service || ""}
                onSuccess={() => {}}
                nomPrenom=""
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
