import { useEffect, useState } from "react"
import { ArrowUp, ArrowDown } from "lucide-react"
import { indicateurColors } from "@/lib/colors"
import { supabase } from "@/lib/supabase"

export function SectionComparatif() {
  const [missionsActuelles, setMissionsActuelles] = useState(0)
  const [missionsAnneeN1, setMissionsAnneeN1] = useState(0)
  const [joursRestants, setJoursRestants] = useState(1)

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date()
      const currentYear = today.getFullYear()
      const currentWeek = getWeekNumber(today)
      const previousYear = currentYear - 1

      // 📆 Calcul des jours restants dans la semaine
      const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay()
      const restants = 7 - dayOfWeek
      setJoursRestants(Math.max(1, restants))

      // 🔹 Charger les missions validées N-1 depuis donnees_statut_semaine
      const { data: donneesN1, error: errorN1 } = await supabase
        .from("donnees_statut_semaine")
        .select("total")
        .eq("annee", previousYear)
        .eq("semaine", currentWeek)
        .eq("statut", "Validées")

      const totalN1 = donneesN1?.reduce((acc, cur) => acc + (cur.total ?? 0), 0) ?? 0
      setMissionsAnneeN1(totalN1)

      // 🔸 Charger les missions validées en cours dans commandes
      const { data: commandes, error: errorCmd } = await supabase
        .from("commandes")
        .select("id, date")
        .eq("statut", "Validé")

      const totalActuelles = (commandes || []).filter((cmd) => {
        const d = new Date(cmd.date)
        return (
          d.getFullYear() === currentYear &&
          getWeekNumber(d) === currentWeek
        )
      }).length

      setMissionsActuelles(totalActuelles)
    }

    fetchData()
  }, [])

  const difference = missionsActuelles - missionsAnneeN1
  const objectifRestant = Math.max(
    0,
    Math.round((missionsAnneeN1 - missionsActuelles) / joursRestants)
  )

  const isSup = difference >= 0
  const borderColor = isSup
    ? indicateurColors["Validées"]
    : indicateurColors["Non pourvue"]

  return (
    <div className="flex flex-col gap-4 h-full justify-between">
      {/* Comparatif N-1 */}
      <div
        className="flex justify-between items-center rounded-md px-4 py-2 bg-white shadow-sm h-[80px] border-l-[6px]"
        style={{ borderColor }}
      >
        <div className="flex flex-col text-sm">
          <span className="text-muted-foreground font-medium">Comparatif N-1</span>
          <span className="font-bold text-2xl">
            {Math.abs(difference)}
          </span>
        </div>
        <div className="flex items-center">
          {isSup ? (
            <ArrowUp className="w-9 h-9" style={{ color: indicateurColors["Validées"] }} />
          ) : (
            <ArrowDown className="w-9 h-9" style={{ color: indicateurColors["Non pourvue"] }} />
          )}
        </div>
      </div>

      {/* Cible journée */}
      <div
        className="flex justify-between items-center rounded-md px-4 py-2 bg-white shadow-sm h-[60px] border-l-[6px] border-gray-300"
      >
        <div className="flex flex-col text-sm">
          <span className="text-muted-foreground font-medium">Cible journée</span>
          <span className="font-bold text-xl">{objectifRestant}</span>
        </div>
      </div>
    </div>
  )
}

// 🔧 Fonction utilitaire pour obtenir le numéro de semaine ISO
function getWeekNumber(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1)
  const diff = (+date - +start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60000) / 86400000
  return Math.floor((diff + start.getDay() + 6) / 7)
}
