import { useEffect, useState } from "react"
import { CheckCircle } from "lucide-react"
import { getWeek, startOfWeek, endOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import { secteursList } from "@/lib/secteurs"
import { statutColors } from "@/lib/colors"

type Props = {
  refreshTrigger: number
}

export function SectionSecteurs({ refreshTrigger }: Props) {
  const [stats, setStats] = useState<Record<string, { recherche: number; validees: number }>>({})

  useEffect(() => {
    const fetchData = async () => {
      const lundi = startOfWeek(new Date(), { weekStartsOn: 1 })
      const dimanche = endOfWeek(new Date(), { weekStartsOn: 1 })

      const { data, error } = await supabase
        .from("commandes")
        .select("secteur, statut, date")
        .gte("date", lundi.toISOString().slice(0,10))
        .lte("date", dimanche.toISOString().slice(0,10))

      if (error || !data) {
        console.error("Erreur chargement indicateurs secteurs", error)
        return
      }

      const counts: Record<string, { recherche: number; validees: number }> = {}

      secteursList.forEach(({ label }) => {
        counts[label] = { recherche: 0, validees: 0 }
      })

      data.forEach((cmd) => {
        const secteur = cmd.secteur || ""
        if (secteursList.some((s) => s.label === secteur)) {
          if (cmd.statut === "En recherche") counts[secteur].recherche++
          if (cmd.statut === "Validé") counts[secteur].validees++
        }
      })

      setStats(counts)
    }

    fetchData()
  }, [refreshTrigger]) // écoute le trigger

  return (
    <div className="grid grid-cols-5 gap-2 w-full">
      {secteursList.map(({ label, icon: Icon }) => {
        const secteurData = stats[label] || { recherche: 0, validees: 0 }
        const isOk = secteurData.recherche === 0
        const bgColor = isOk
          ? statutColors["Validé"].bg
          : statutColors["En recherche"].bg
        const textColor = isOk
          ? statutColors["Validé"].text
          : statutColors["En recherche"].text

        return (
          <div
            key={label}
            className="flex items-center justify-between px-3 h-[44px] rounded-lg shadow-sm"
            style={{ backgroundColor: bgColor, color: textColor }}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Icon className="w-4 h-4" />
              {label}
            </div>
            <div className="text-sm font-bold">
              {isOk ? (
                <CheckCircle className="w-4 h-4 text-green-700" />
              ) : (
                <span className="text-sm">{secteurData.recherche}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
