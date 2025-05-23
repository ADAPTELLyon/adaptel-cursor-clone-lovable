import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { addDays, format, startOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { statutColors } from "@/lib/colors"
import { CheckCircle, XCircle } from "lucide-react"

type Candidat = {
  id: string
  nom: string
  prenom: string
}

export function PlanningCandidatsSemaine({
  secteur,
  semaineDate,
}: {
  secteur: string
  semaineDate: string
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

      const dates = joursSem.map((d) => d.toISOString().slice(0, 10))

      // ✅ Candidats
      const { data: candidatsData } = await supabase
        .from("candidats")
        .select("id, nom, prenom")
        .eq("actif", true)
        .contains("secteurs", [secteur])

      if (!candidatsData) return
      setCandidats(candidatsData)

      const ids = candidatsData.map((c) => c.id)

      // ✅ Dispos
      const { data: dispoData } = await supabase
        .from("disponibilites")
        .select("candidat_id, date, statut")
        .in("date", dates)
        .eq("secteur", secteur)
        .in("candidat_id", ids)

      setDispos(dispoData || [])

      // ✅ Planifs
      const { data: planifData } = await supabase
        .from("planification")
        .select("candidat_id, date")
        .in("date", dates)
        .eq("secteur", secteur)
        .in("candidat_id", ids)

      setPlanifs(planifData || [])
    }

    fetchAll()
  }, [secteur, semaineDate])

  const getStatut = (candidatId: string, dateStr: string) => {
    if (planifs.some((p) => p.candidat_id === candidatId && p.date === dateStr)) {
      return "planifié"
    }
    const dispo = dispos.find((d) => d.candidat_id === candidatId && d.date === dateStr)
    if (!dispo) return "nonrenseigne"
    if (dispo.statut === "Dispo") return "dispo"
    if (dispo.statut === "Non dispo") return "nondispo"
    return "nonrenseigne"
  }

  const renderStatut = (statut: string) => {
    switch (statut) {
      case "planifié":
        return <CheckCircle className="w-5 h-5 mx-auto" style={{ color: statutColors["Validé"].bg }} />
      case "dispo":
        return (
          <div
            className="w-3.5 h-3.5 rounded-full mx-auto"
            style={{ backgroundColor: statutColors["Dispo"].bg }}
          />
        )
      case "nondispo":
        return <XCircle className="w-4 h-4 mx-auto text-gray-500" />
      default:
        return <div className="w-3.5 h-3.5 mx-auto rounded-full bg-gray-200" />
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Planning – Candidats secteur {secteur}</h3>
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
                  <td className="px-3 py-2">{c.prenom} {c.nom}</td>
                  {jours.map((j, i) => {
                    const dateStr = j.toISOString().slice(0, 10)
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
