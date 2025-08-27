import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Utilisateur = {
  id: string
  prenom: string
  nom: string
  email: string
  actif: boolean
  created_at?: string
  updated_at?: string
}

export function useUser() {
  const [userData, setUserData] = useState<Utilisateur | null>(null)

  useEffect(() => {
    const getUserInfo = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data, error } = await supabase
        .from("utilisateurs")
        .select("*")
        .eq("email", user.email)
        .single()

      if (data && !error) {
        setUserData(data as Utilisateur)
      }
    }

    getUserInfo()
  }, [])

  return { userData }
}
