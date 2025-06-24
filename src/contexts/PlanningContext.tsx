// src/contexts/PlanningContext.tsx
import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat } from "@/types/types-front"

type PlanningContextType = {
  planning: CommandeWithCandidat[]
  refreshPlanning: () => void
}

const PlanningContext = createContext<PlanningContextType>({
  planning: [],
  refreshPlanning: () => {},
})

export function usePlanning() {
  return useContext(PlanningContext)
}

export function PlanningProvider({ children }: { children: React.ReactNode }) {
  const [planning, setPlanning] = useState<CommandeWithCandidat[]>([])

  const fetchPlanning = async () => {
    const { data, error } = await supabase
      .from("commandes")
      .select("*, candidats(*), clients(*)")

    if (!error) {
      setPlanning(data as CommandeWithCandidat[])
    }
  }

  useEffect(() => {
    fetchPlanning()

    const channel = supabase
      .channel("planning_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commandes" },
        () => {
          fetchPlanning()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <PlanningContext.Provider value={{ planning, refreshPlanning: fetchPlanning }}>
      {children}
    </PlanningContext.Provider>
  )
}
