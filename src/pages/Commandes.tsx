import MainLayout from "@/components/main-layout"
import { SectionFixeCommandes } from "@/components/commandes/section-fixe-commandes"
import { PlanningClientTable } from "@/components/commandes/PlanningClientTable"
import { useEffect, useState } from "react"
import { addDays, format, startOfWeek } from "date-fns"
import { supabase } from "@/lib/supabase"
import { Commande, JourPlanning } from "@/types"

export default function Commandes() {
  const [planning, setPlanning] = useState<Record<string, JourPlanning[]>>({})
  const [semaine, setSemaine] = useState<Date[]>([])

  useEffect(() => {
    const semaineActuelle = Array.from({ length: 7 }, (_, i) =>
      addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i)
    )
    setSemaine(semaineActuelle)

    const fetchPlanning = async () => {
      const dates = semaineActuelle.map((d) => format(d, "yyyy-MM-dd"))

      const { data, error } = await supabase
        .from("commandes")
        .select(`
          id,
          date,
          statut,
          secteur,
          service,
          client_id,
          heure_debut_matin,
          heure_fin_matin,
          heure_debut_soir,
          heure_fin_soir,
          heure_debut_nuit,
          heure_fin_nuit,
          candidats (
            nom,
            prenom
          ),
          client:client_id (
            nom
          )
        `)
        .in("date", dates)

      if (error || !data) {
        console.error("Erreur Supabase :", error)
        return
      }

      const map: Record<string, JourPlanning[]> = {}

      for (const item of data as any[]) {
        const clientName = item.client?.nom || "Client inconnu"
        const date = item.date

        if (!map[clientName]) map[clientName] = []

        let jour = map[clientName].find((j) => j.date === date)
        if (!jour) {
          jour = {
            date,
            secteur: item.secteur,
            service: item.service,
            commandes: [],
          }
          map[clientName].push(jour)
        }

        const commande: Commande = {
          id: item.id,
          date: item.date,
          client_id: item.client_id,
          statut: item.statut,
          secteur: item.secteur,
          service: item.service,
          heure_debut_matin: item.heure_debut_matin,
          heure_fin_matin: item.heure_fin_matin,
          heure_debut_soir: item.heure_debut_soir,
          heure_fin_soir: item.heure_fin_soir,
          heure_debut_nuit: item.heure_debut_nuit,
          heure_fin_nuit: item.heure_fin_nuit,
          clients: item.client ? { nom: item.client.nom } : undefined,
          candidats: item.candidats ? { nom: item.candidats.nom, prenom: item.candidats.prenom } : undefined,
        }

        jour.commandes.push(commande)
      }

      setPlanning(map)
    }

    fetchPlanning()
  }, [])

  return (
    <MainLayout>
      <SectionFixeCommandes />
      <PlanningClientTable planning={planning} semaine={semaine} />
    </MainLayout>
  )
}
