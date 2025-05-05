import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { PosteType } from "@/types/types-front"

export function usePostesTypesByClient(clientId: string, secteur: string) {
  const [postesTypes, setPostesTypes] = useState<PosteType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId || !secteur) {
      setPostesTypes([])
      return
    }

    const fetchPostesTypes = async () => {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from("postes_types")
        .select("id, nom, client_id, secteur")
        .eq("client_id", clientId)
        .eq("secteur", secteur)
        .order("nom", { ascending: true })

      if (error) {
        console.error("Erreur récupération postes types :", error)
        setError(error.message)
      } else {
        setPostesTypes((data as PosteType[]) || [])
      }

      setLoading(false)
    }

    fetchPostesTypes()
  }, [clientId, secteur])

  return { postesTypes, loading, error }
}
