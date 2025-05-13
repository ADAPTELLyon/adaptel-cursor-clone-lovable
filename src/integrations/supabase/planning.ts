import { supabase } from "@/integrations/supabase/client"
import type { CandidatDispoWithNom, JourPlanningCandidat } from "@/types/types-front"
import { startOfWeek } from "date-fns"

export async function getPlanningCandidats(): Promise<Record<string, JourPlanningCandidat[]>> {
  const lundi = startOfWeek(new Date(), { weekStartsOn: 1 })

  const { data, error } = await supabase
    .from("disponibilites")
    .select(`
      id, date, secteur, service, statut, dispo_matin, dispo_soir, dispo_nuit, commentaire, candidat_id, created_at,
      candidats (nom, prenom)
    `)
    .gte("date", lundi.toISOString().slice(0, 10))

  if (error || !data) {
    console.error("❌ Erreur Supabase (planning candidats) :", error)
    return {}
  }

  const map: Record<string, JourPlanningCandidat[]> = {}

  for (const item of data) {
    // Gestion spéciale du champ soir pour Réception → nuit
    const isReception = item.secteur === "Réception"
    const matin = item.dispo_matin ?? false
    const soir = isReception ? item.dispo_nuit ?? false : item.dispo_soir ?? false

    const dispo: CandidatDispoWithNom = {
      id: item.id,
      date: item.date,
      secteur: item.secteur,
      service: item.service ?? null,
      statut: item.statut ?? "Non Renseigné",
      matin,
      soir,
      nuit: item.dispo_nuit ?? false,
      candidat_id: item.candidat_id,
      created_at: item.created_at,
      commentaire: item.commentaire ?? null,
      candidat: item.candidats || null,
    }

    const nomCandidat = dispo.candidat
      ? `${dispo.candidat.nom} ${dispo.candidat.prenom}`
      : item.candidat_id

    if (!map[nomCandidat]) map[nomCandidat] = []

    map[nomCandidat].push({
      date: dispo.date,
      secteur: dispo.secteur,
      service: dispo.service,
      disponibilite: dispo,
    })
  }

  return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)))
}
