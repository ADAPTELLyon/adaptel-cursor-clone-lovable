import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { addDays, format, startOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { disponibiliteColors, statutColors } from "@/lib/colors"
import { CheckCircle2 } from "lucide-react"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"

type PlanifData = {
  candidat_id: string
  date: string
  heure_debut_matin: string | null
  heure_fin_matin: string | null
  heure_debut_soir: string | null
  heure_fin_soir: string | null
  client: { nom: string }
  statut: string
}

type DispoData = {
  candidat_id: string
  date: string
  statut: string
  dispo_matin: boolean
  dispo_soir: boolean
}

export function PlanningCandidatsSemaine({
  semaineDate,
  secteur,
}: {
  semaineDate: string
  secteur: string
}) {
  const { data: candidats = [] } = useCandidatsBySecteur(secteur)
  const [jours, setJours] = useState<Date[]>([])
  const [dispos, setDispos] = useState<DispoData[]>([])
  const [planifs, setPlanifs] = useState<PlanifData[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const baseDate = semaineDate ? new Date(semaineDate) : new Date()
      const lundi = startOfWeek(baseDate, { weekStartsOn: 1 })
      const joursSem = Array.from({ length: 7 }, (_, i) => addDays(lundi, i))
      setJours(joursSem)

      const dates = joursSem.map((d) => format(d, "yyyy-MM-dd"))
      const ids = candidats.map((c) => c.id)
      if (ids.length === 0) return

      const { data: dispoData } = await supabase
        .from("disponibilites")
        .select("candidat_id, date, statut, dispo_matin, dispo_soir")
        .in("date", dates)
        .in("candidat_id", ids)

      setDispos(dispoData || [])

      const { data: planifData } = await supabase
        .from("commandes")
        .select("candidat_id, date, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir, statut, client:client_id (nom)")
        .in("date", dates)
        .in("candidat_id", ids)

      setPlanifs(planifData as PlanifData[] || [])
    }

    fetchData()
  }, [semaineDate, secteur, candidats])

  const getStatut = (candidatId: string, dateStr: string) => {
    const planif = planifs.find(
      (p) => p.candidat_id === candidatId && p.date === dateStr
    )
    if (planif) return { statut: planif.statut.toLowerCase(), info: planif }

    const dispo = dispos.find(
      (d) => d.candidat_id === candidatId && d.date === dateStr
    )
    if (!dispo) return { statut: "nonrenseigne" }

    if (dispo.statut === "Dispo") return { statut: "dispo", info: dispo }
    if (dispo.statut === "Non Dispo") return { statut: "nondispo" }

    return { statut: "nonrenseigne" }
  }

  const formatHeure = (heure?: string | null) =>
    heure && heure.length >= 5 ? heure.slice(0, 5) : ""

  const renderStatut = (statut: string, info: any) => {
    switch (statut) {
      case "validé":
      case "planifie":
        const lignes = []
        if (info?.client?.nom) lignes.push(info.client.nom)
        const matin =
          info?.heure_debut_matin && info?.heure_fin_matin
            ? `Matin : ${formatHeure(info.heure_debut_matin)} - ${formatHeure(info.heure_fin_matin)}`
            : null
        const soir =
          info?.heure_debut_soir && info?.heure_fin_soir
            ? `Soir : ${formatHeure(info.heure_debut_soir)} - ${formatHeure(info.heure_fin_soir)}`
            : null
        if (matin) lignes.push(matin)
        if (soir) lignes.push(soir)

        return (
          <div title={lignes.join("\n")}>
            <CheckCircle2
              className="w-5 h-5 mx-auto"
              style={{ color: statutColors["Validé"]?.bg }}
            />
          </div>
        )

      case "dispo":
        let titleDispo = ""
        if (info?.dispo_matin && info?.dispo_soir) titleDispo = "Toutes Dispo"
        else if (info?.dispo_matin) titleDispo = "Dispo Matin/Midi"
        else if (info?.dispo_soir) titleDispo = "Dispo Soir"
        else titleDispo = "Statut Dispo"

        return (
          <div
            className="w-3.5 h-3.5 rounded-full mx-auto"
            style={{ backgroundColor: disponibiliteColors["Dispo"].bg }}
            title={titleDispo}
          />
        )

      case "nondispo":
        return (
          <div
            className="w-3.5 h-3.5 rounded-full mx-auto"
            style={{ backgroundColor: disponibiliteColors["Non Dispo"].bg }}
          />
        )

      case "annule int":
      case "annule client":
        return (
          <div
            className="w-3.5 h-3.5 rounded-full mx-auto"
            style={{ backgroundColor: statutColors["Annule Int"].bg }}
            title="Annule Int / Client"
          />
        )

      case "annule ada":
        return (
          <div
            className="w-3.5 h-3.5 rounded-full mx-auto"
            style={{ backgroundColor: statutColors["Annule ADA"].bg }}
            title="Annule ADA"
          />
        )

case "absence":
  return (
    <div
      className="w-3.5 h-3.5 rounded-full mx-auto"
      style={{ backgroundColor: statutColors["Absence"].bg }}
      title="Absence"
    />
  )

      default:
        return <div className="text-xs text-gray-400">–</div>
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">
        Planning – Disponibilités candidats
      </h3>
      {candidats.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">
          Aucun candidat trouvé.
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
                    const dateStr = format(j, "yyyy-MM-dd")
                    const { statut, info } = getStatut(c.id, dateStr)
                    return (
                      <td key={i} className="text-center py-2">
                        {renderStatut(statut, info)}
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
