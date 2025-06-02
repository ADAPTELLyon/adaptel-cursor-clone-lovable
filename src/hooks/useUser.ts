import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Utilisateur } from "@/types"

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
        setUserData(data)
      }
    }

    getUserInfo()
  }, [])

  return { userData }
}
