import { supabase } from "@/lib/supabase"
import { toast } from "@/components/ui/use-toast"

/**
 * Affiche une alerte au chargement indiquant le nombre de missions à valider aujourd’hui
 */
export async function checkMissionAValiderAujourdHui(prenom: string) {
  const today = new Date().toISOString().slice(0, 10)

  const { count, error } = await supabase
    .from("commandes")
    .select("*", { count: "exact", head: true })
    .eq("statut", "En recherche")
    .eq("date", today)

  if (error) {
    console.error("Erreur Supabase (checkMissionAValiderAujourdHui):", error)
    return
  }

  const total = count ?? 0

  toast({
    title: `Bonjour ${prenom}`,
    description:
      total > 0
        ? `Vous avez ${total} mission${total > 1 ? "s" : ""} à valider pour aujourd’hui.`
        : `Vous n’avez pas de mission en recherche aujourd’hui.`,
    duration: 6000,
  })
}
