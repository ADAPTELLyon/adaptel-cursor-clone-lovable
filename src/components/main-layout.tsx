import { useEffect, useState } from "react"
import { MainNav } from "./main-nav"
import { withAuthGuard } from "./auth-guard"
import { ArrowUp } from "lucide-react"

function MainLayout({ children }: { children: React.ReactNode }) {
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Bandeau navigation fixé */}
      <div className="sticky top-0 z-50 bg-white shadow-md">
        <MainNav />
      </div>

      {/* Contenu principal */}
      <main className="container mx-auto p-8">
        {/* ATTENTION : on ne met plus de pt-[72px] ici */}

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
