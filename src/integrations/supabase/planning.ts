import { startOfWeek } from "date-fns"
import { supabase } from "@/integrations/supabase/client"
import type { JourPlanningCandidat, StatutCommande } from "@/types/types-front"

export async function getPlanningCandidats(): Promise<Record<string, JourPlanningCandidat[]>> {
  const lundi = startOfWeek(new Date(), { weekStartsOn: 1 })
  const isoStart = lundi.toISOString().slice(0, 10)

  const { data: disponibilites, error: errorDispo } = await supabase
    .from("disponibilites")
    .select(`
      id, date, secteur, service, statut, commentaire,
      dispo_matin, dispo_soir, dispo_nuit,
      candidat_id, created_at,
      candidat:candidat_id ( nom, prenom )
    `)
    .gte("date", isoStart)

  const { data: planifs, error: errorPlanif } = await supabase
    .from("planification")
    .select(`
      id, date, commande_id, candidat_id, statut,
      created_at,
      commandes:commande_id (
        id, date, secteur, service, statut, client_id, candidat_id,
        heure_debut_matin, heure_fin_matin,
        heure_debut_soir, heure_fin_soir,
        created_at,
        client:client_id ( nom ),
        candidat:candidat_id ( nom, prenom )
      )
    `)
    .gte("date", isoStart)

  if (errorDispo || errorPlanif) {
    console.error("Erreur chargement planning candidats :", errorDispo || errorPlanif)
    return {}
  }

  const planning: Record<string, JourPlanningCandidat[]> = {}

  // → Planifications prioritaires
  for (const item of planifs || []) {
    const commande = item.commandes
    if (!commande || !commande.candidat) continue

    const nomPrenom = `${commande.candidat.nom} ${commande.candidat.prenom}`
    if (!planning[nomPrenom]) planning[nomPrenom] = []

    planning[nomPrenom].push({
      date: commande.date,
      secteur: commande.secteur,
      service: commande.service,
      commande: {
        id: commande.id,
        date: commande.date,
        secteur: commande.secteur,
        service: commande.service,
        statut: commande.statut as StatutCommande,
        client_id: commande.client_id,
        candidat_id: commande.candidat_id,
        heure_debut_matin: commande.heure_debut_matin,
        heure_fin_matin: commande.heure_fin_matin,
        heure_debut_soir: commande.heure_debut_soir,
        heure_fin_soir: commande.heure_fin_soir,
        created_at: commande.created_at,
        client: commande.client ? { nom: commande.client.nom } : undefined,
        candidat: commande.candidat ? {
          nom: commande.candidat.nom,
          prenom: commande.candidat.prenom,
        } : undefined,
      },
    })
  }

  // → Ajout des disponibilités uniquement si pas déjà planifié à la même date+secteur
  for (const item of disponibilites || []) {
    const nomPrenom =
      item.candidat?.nom && item.candidat?.prenom
        ? `${item.candidat.nom} ${item.candidat.prenom}`
        : "Candidat inconnu"

    const jourCle = `${item.date}__${item.secteur}`

    const dejaPlanifie = planning[nomPrenom]?.some(
      (j) => `${j.date}__${j.secteur}` === jourCle && j.commande
    )

    if (dejaPlanifie) continue

    const creneaux: string[] = []
    if (item.dispo_matin) creneaux.push("matin")
    if (item.dispo_soir) creneaux.push("soir")
    if (item.dispo_nuit) creneaux.push("nuit")

    if (!planning[nomPrenom]) planning[nomPrenom] = []

    planning[nomPrenom].push({
      date: item.date,
      secteur: item.secteur,
      service: item.service,
      disponibilite: {
        id: item.id,
        date: item.date,
        secteur: item.secteur,
        service: item.service,
        statut: item.statut as "Dispo" | "Non Dispo" | "Non Renseigné",
        commentaire: item.commentaire,
        candidat_id: item.candidat_id,
        matin: item.dispo_matin,
        soir: item.dispo_soir,
        nuit: item.dispo_nuit,
        creneaux,
        created_at: item.created_at,
        candidat: item.candidat || undefined,
      },
    })
  }

  return planning
}
