import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { addDays, format, startOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { disponibiliteColors, statutColors } from "@/lib/colors"
import { CheckCircle, XCircle } from "lucide-react"

type Candidat = {
  id: string
  nom: string
  prenom: string
}

export function PlanningCandidatsSemaine({
  semaineDate,
  secteur,
}: {
  semaineDate: string
  secteur: string
}) {
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [jours, setJours] = useState<Date[]>([])
  const [dispos, setDispos] = useState<any[]>([])
  const [planifs, setPlanifs] = useState<any[]>([])

  useEffect(() => {
    const fetchAll = async () => {
      const baseDate = semaineDate ? new Date(semaineDate) : new Date()
      const lundi = startOfWeek(baseDate, { weekStartsOn: 1 })
      const joursSem = Array.from({ length: 7 }, (_, i) => addDays(lundi, i))
      setJours(joursSem)

      const dates = joursSem.map((d) => format(d, "yyyy-MM-dd"))

      const { data: candidatsData } = await supabase
        .from("candidats")
        .select("id, nom, prenom")
        .eq("actif", true)
        .contains("secteurs", [secteur]) // ✅ NE CHANGE RIEN D’AUTRE

      if (!candidatsData) return
      setCandidats(candidatsData)

      const ids = candidatsData.map((c) => c.id)

      const { data: dispoData } = await supabase
        .from("disponibilites")
        .select("candidat_id, date, statut")
        .in("date", dates)
        .in("candidat_id", ids)

      setDispos(dispoData || [])

      const { data: planifData } = await supabase
        .from("planification")
        .select("candidat_id, date")
        .in("date", dates)
        .in("candidat_id", ids)

      setPlanifs(planifData || [])
    }

    fetchAll()
  }, [semaineDate, secteur])

  const getStatut = (candidatId: string, dateStr: string) => {
    const isPlanifie = planifs.some(
      (p) => p.candidat_id === candidatId && p.date === dateStr
    )
    if (isPlanifie) return "planifie"

    const dispo = dispos.find(
      (d) => d.candidat_id === candidatId && d.date === dateStr
    )
    if (!dispo) return "nonrenseigne"
    if (dispo.statut === "Dispo") return "dispo"
    if (dispo.statut === "Non Dispo") return "nondispo"
    return "nonrenseigne"
  }

  const renderStatut = (statut: string) => {
    switch (statut) {
      case "planifie":
        return (
          <CheckCircle
            className="w-5 h-5 mx-auto"
            style={{ color: statutColors["Validé"]?.bg }}
          />
        )
      case "dispo":
        return (
          <div
            className="w-3.5 h-3.5 rounded-full mx-auto"
            style={{ backgroundColor: disponibiliteColors["Dispo"].bg }}
          />
        )
      case "nondispo":
        return <XCircle className="w-4 h-4 mx-auto text-gray-500" />
      default:
        return <div className="text-xs text-gray-400">–</div>
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">
        Planning – Disponibilités secteur {secteur}
      </h3>
      {candidats.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">
          Aucun candidat trouvé pour ce secteur.
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-md bg-white">
          <table className="min-w-full text-sm table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 w-48">Candidat</th>
                {jours.map((j, i) => (
                  <th key={i} className="text-center px-2 py-2 w-20">
                    {format(j, "EEE d", { locale: fr })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidats.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2">
                    {c.prenom} {c.nom}
                  </td>
                  {jours.map((j, i) => {
                    const dateStr = format(j, "yyyy-MM-dd")
                    return (
                      <td key={i} className="text-center py-2">
                        {renderStatut(getStatut(c.id, dateStr))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
