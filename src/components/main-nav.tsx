import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import {
  Home,
  Box,
  Calendar,
  Users,
  User,
  Settings,
  LogOut,
  User2,
} from "lucide-react"
import { signOut } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"

const routes = [
  { title: "Back Office", href: "/back-office", icon: Home },
  { title: "Commandes", href: "/commandes", icon: Box },
  { title: "Planning", href: "/planning", icon: Calendar },
  { title: "Clients", href: "/clients", icon: Users },
  { title: "Candidats", href: "/candidats", icon: User },
  { title: "Paramètres", href: "/parametrages", icon: Settings },
]

export function MainNav() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const [nomComplet, setNomComplet] = useState<string | null>(null)
  const [feteDuJour, setFeteDuJour] = useState<string>("")

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de la déconnexion",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Déconnexion réussie",
      description: "Vous avez été déconnecté avec succès",
    })

    navigate("/login")
  }

  const today = new Date()
  const todayText = format(today, "EEEE d MMMM yyyy", { locale: fr })

  useEffect(() => {
    // 🔁 Requête pour récupérer nom/prénom depuis la table utilisateurs
    const fetchNomUtilisateur = async () => {
      if (!user?.email) return
      const { data, error } = await supabase
        .from("utilisateurs")
        .select("prenom, nom")
        .eq("email", user.email)
        .single()

      if (!error && data) {
        setNomComplet(`${data.prenom} ${data.nom}`)
      }
    }

    fetchNomUtilisateur()
  }, [user?.email])

  useEffect(() => {
    // 🎉 Fête du jour depuis nominis.cef.fr
    const fetchFete = async () => {
      const jour = today.getDate()
      const mois = today.getMonth() + 1
      const annee = today.getFullYear()

      try {
        const res = await fetch(`https://nominis.cef.fr/json/saintdujour.php?jour=${jour}&mois=${mois}&annee=${annee}`)
        const data = await res.json()
        const nom = data?.response?.saintdujour?.nom || ""
        if (nom) setFeteDuJour(`Fête du jour : ${nom.replace(/^Saint\s+/i, "")}`)
      } catch (err) {
        console.error("Erreur récupération fête du jour :", err)
        setFeteDuJour("")
      }
    }

    fetchFete()
  }, [])

  const nomAffiche = nomComplet || user?.email?.split("@")[0] || "Utilisateur"

  return (
    <div className="flex h-16 items-center px-4 border-b bg-white justify-between">
      {/* Logo + marque + user */}
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center space-x-2">
          <img
            src="/lovable-uploads/logo-blanc.png"
            alt="Adaptel Logo"
            className="h-10 w-10"
          />
          <span className="text-xl font-bold" style={{ color: "#840404" }}>
            ADAPTEL Lyon
          </span>
        </Link>

        <div className="flex items-center px-3 py-1 rounded-md bg-gray-100 text-sm text-gray-800 font-medium">
          <User2 className="w-4 h-4 mr-1 text-gray-500" />
          {nomAffiche}
        </div>
      </div>

      {/* Date + fête du jour */}
      <div className="hidden md:flex items-center gap-3 text-sm text-gray-700 font-medium">
        <span className="capitalize">{todayText}</span>
        {feteDuJour && (
          <>
            <div className="h-4 w-px bg-gray-300" />
            <span>{feteDuJour}</span>
          </>
        )}
      </div>

      {/* Menu + logout */}
      <div className="flex items-center gap-4">
        <NavigationMenu>
          <NavigationMenuList>
            {routes.map(({ title, href, icon: Icon }) => {
              const isActive = location.pathname === href
              return (
                <NavigationMenuItem key={href}>
                  <Link
                    to={href}
                    className={cn(
                      "group inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[#840404] text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {title}
                  </Link>
                </NavigationMenuItem>
              )
            })}
          </NavigationMenuList>
        </NavigationMenu>

        <button
          onClick={handleSignOut}
          className="p-2 rounded-md hover:bg-gray-100 transition"
          aria-label="Se déconnecter"
        >
          <LogOut className="h-5 w-5 text-gray-500" />
        </button>
      </div>
    </div>
  )
}
