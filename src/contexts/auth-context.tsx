import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from "react"
import { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

type Utilisateur = {
  id: string
  prenom: string
  nom: string
  email: string
  actif: boolean
}

type AuthContextType = {
  user: Utilisateur | null
  isLoading: boolean
  isAuthenticated: boolean
  session: Session | null
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  session: null,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Utilisateur | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const loadUserData = async (session: Session | null) => {
    try {
      if (!session?.user?.id) {
        setUser(null)
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("utilisateurs")
        .select("*")
        .eq("id", session.user.id)
        .single()

      if (error) {
        console.error("Erreur récupération utilisateur:", error)
        toast({
          title: "Erreur d'authentification",
          description: "Impossible de charger les informations utilisateur.",
          variant: "destructive",
        })
      }

      setUser(data ?? null)
    } catch (error) {
      console.error("Erreur chargement utilisateur:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadUserData(data.session)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        loadUserData(session)
      }
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    session,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
