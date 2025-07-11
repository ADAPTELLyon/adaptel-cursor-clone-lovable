import { useEffect, useState } from "react"
import { MainNav } from "./main-nav"
import { withAuthGuard } from "./auth-guard"
import { ArrowUp } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"

function MainLayout({ children }: { children: React.ReactNode }) {
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [messageAccueil, setMessageAccueil] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const checkMissionsToday = async () => {
      if (!user) return

      // Utilise user.prenom, pas user.user_metadata.prenom
      const prenom = (user as any).prenom ?? "Utilisateur"

      const today = new Date().toISOString().slice(0, 10)

      const { count, error } = await supabase
        .from("commandes")
        .select("*", { count: "exact", head: true })
        .eq("statut", "En recherche")
        .eq("date", today)

      if (error) {
        console.error("Erreur Supabase:", error)
        return
      }

      const total = count ?? 0
      const msg =
        total > 0
          ? `Bonjour ${prenom}, vous avez ${total} mission${total > 1 ? "s" : ""} à valider aujourd’hui.`
          : `Bonjour ${prenom}, vous n’avez pas de mission en recherche aujourd’hui.`

      setMessageAccueil(msg)
      // Pour ne pas répéter le message à chaque navigation, on stocke un flag en session
      sessionStorage.setItem("messageAccueilAffiche", "true")

      setTimeout(() => setMessageAccueil(null), 6000)
    }

    // Affiche le message uniquement si pas déjà affiché cette session
    if (!sessionStorage.getItem("messageAccueilAffiche")) {
      checkMissionsToday()
    }
  }, [user])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Bandeau navigation fixé */}
      <div className="sticky top-0 z-50 bg-white shadow-md">
        <MainNav />
      </div>

      {/* Message d'accueil central */}
      {messageAccueil && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 bg-white shadow-md border border-gray-300 rounded-xl px-6 py-4 text-center text-sm font-medium max-w-lg text-gray-800">
          {messageAccueil}
        </div>
      )}

      {/* Contenu principal élargi */}
      <main className="max-w-[1600px] mx-auto px-4 pt-8">
        {children}
      </main>

      {/* Bouton remonter en haut */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 bg-[#840404] hover:bg-[#750303] text-white rounded-full p-3 shadow-md transition"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

export default withAuthGuard(MainLayout)
