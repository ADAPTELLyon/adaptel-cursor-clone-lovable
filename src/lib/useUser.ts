import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"

export type Utilisateur = {
  id: string
  nom: string
  prenom: string
  email: string
  actif: boolean
}

export function useUser() {
  const [user, setUser] = useState<Utilisateur | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true)

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user?.email) {
        setUser(null)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("utilisateurs")
        .select("*")
        .eq("email", authData.user.email)
        .maybeSingle()

      if (error || !data) {
        setUser(null)
      } else {
        setUser(data)
      }

      setLoading(false)
    }

    fetchUser()
  }, [])

  return { user, loading }
}
