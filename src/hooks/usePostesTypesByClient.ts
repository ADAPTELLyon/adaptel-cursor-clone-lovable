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

      try {
        console.log("🔎 Recherche des postes types pour client:", clientId, "secteur:", secteur)

        const { data, error } = await supabase
          .from("postes_types_clients")
          .select(
            `
              id,
              client_id,
              poste_base_id,
              nom,
              heure_debut_matin,
              heure_fin_matin,
              heure_debut_soir,
              heure_fin_soir,
              temps_pause_minutes,
              created_at,
              poste_base:poste_base_id (
                id,
                secteur,
                nom,
                created_at
              )
            `
          )
          .eq("client_id", clientId)
          .order("nom", { ascending: true })

        console.log("📦 Données brutes Supabase :", data)

        if (error) {
          console.error("❌ Erreur récupération postes types :", error)
          setError(error.message)
          setPostesTypes([])
        } else {
          // On mappe pour "compléter" le poste_base avec un champ actif:false (pour correspondre à ton type)
          const fixedData = (data as any[]).map((item) => ({
            ...item,
            poste_base: item.poste_base
              ? {
                  ...item.poste_base,
                  actif: false, // on complète pour éviter le bug TS
                }
              : null,
          }))

          // Puis on filtre par secteur (nettoyé)
          const filtered = fixedData.filter((pt) => {
            const secteurPoste = pt.poste_base?.secteur?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            const secteurRecherche = secteur.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            return secteurPoste === secteurRecherche
          })

          console.log("✅ Postes types filtrés (par secteur):", filtered)

          setPostesTypes(filtered as PosteType[])
        }
      } catch (err) {
        console.error("❌ Erreur inattendue :", err)
        setError("Erreur inattendue")
        setPostesTypes([])
      }

      setLoading(false)
    }

    fetchPostesTypes()
  }, [clientId, secteur])

  return { postesTypes, loading, error }
}
