import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Candidat } from "@/types/types-front"

// Fallback local de normalisation
function slugifySecteur(label: string) {
  return label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function useCandidatsBySecteur(secteur: string) {
  return useQuery({
    queryKey: ["candidats", secteur],
    enabled: !!secteur,
    queryFn: async (): Promise<Candidat[]> => {
      const secteurNormalise = slugifySecteur(secteur)
      const { data, error } = await supabase
        .from("candidats")
        .select("*")
        .contains("secteurs", [secteurNormalise])
        .eq("actif", true)
        .order("nom")

      if (error) {
        console.error("Erreur chargement candidats secteur :", error)
        return []
      }

      return data
    },
  })
}
