import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Client } from "@/types/types-front"

export function useClientsBySecteur(secteur: string) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!secteur) {
      setClients([])
      return
    }

    // Met en minuscules + retire les accents
    const secteurClean = secteur
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")

    console.log("🔍 Recherche des clients pour secteur (nettoyé) :", secteurClean)

    const fetchClients = async () => {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from("clients")
        .select("id, nom, services, secteurs")
        .contains("secteurs", [secteurClean])
        .order("nom", { ascending: true })

      if (error) {
        console.error("Erreur récupération clients :", error)
        setError(error.message)
      } else {
        setClients((data as Client[]) || [])
      }

      setLoading(false)
    }

    fetchClients()
  }, [secteur])

  return { clients, loading, error }
}
