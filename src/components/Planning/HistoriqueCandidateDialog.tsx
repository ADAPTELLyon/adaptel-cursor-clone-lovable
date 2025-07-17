import { Dialog, DialogContent } from "@/components/ui/dialog"
import { format, startOfWeek, addDays } from "date-fns"
import { fr } from "date-fns/locale"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Clock, UserRound } from "lucide-react"
import { statutColors } from "@/lib/colors"
import { Badge } from "@/components/ui/badge"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidatId: string
  nomPrenom: string
}

export function HistoriqueCandidatDialog({
  open,
  onOpenChange,
  candidatId,
  nomPrenom,
}: Props) {
  const [semaineEnCours, setSemaineEnCours] = useState(new Date())
  const [actions, setActions] = useState<any[]>([])

  const debutSemaine = startOfWeek(semaineEnCours, { weekStartsOn: 1 })
  const finSemaine = addDays(debutSemaine, 6)

  useEffect(() => {
    if (!open || !candidatId) return

    const fetch = async () => {
      const [nomRef, prenomRef] = nomPrenom.toLowerCase().split(" ")

      // Récupération des commandes planifiées
      const { data: commandes } = await supabase
        .from("commandes")
        .select("id, statut, date, client:client_id(nom), created_at, created_by, secteur, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
        .eq("candidat_id", candidatId)
        .eq("statut", "Validé")
        .gte("date", format(debutSemaine, "yyyy-MM-dd"))
        .lte("date", format(finSemaine, "yyyy-MM-dd"))

      // Récupération des historiques
      const { data: historique } = await supabase
        .from("historique")
        .select("id, table_cible, ligne_id, action, apres, date_action, user: user_id (prenom)")
        .eq("table_cible", "commandes")
        .gte("date_action", debutSemaine.toISOString())
        .lte("date_action", finSemaine.toISOString())

      const autresStatuts = ["Absence", "Annule Int", "Annule Client", "Annule ADA"]
      const historiqueFiltree = (historique || [])
        .map((entry) => {
          try {
            const parsed = typeof entry.apres === "string" ? JSON.parse(entry.apres) : entry.apres
            const nom = parsed?.candidat?.nom?.toLowerCase()
            const prenom = parsed?.candidat?.prenom?.toLowerCase()
            const stat = parsed?.statut
            const date = parsed?.date
            const client = parsed?.client

            if (
              stat &&
              date &&
              autresStatuts.includes(stat) &&
              nom === nomRef &&
              prenom === prenomRef
            ) {
              return {
                id: entry.id,
                statut: stat,
                date,
                client: client || "Client inconnu",
                created_at: entry.date_action,
                utilisateur: entry.user?.prenom || "Utilisateur",
              }
            }
            return null
          } catch (e) {
            return null
          }
        })
        .filter(Boolean)

      const formatCommande = (cmd: any) => ({
        id: cmd.id,
        statut: cmd.statut,
        date: cmd.date,
        client: cmd.client?.nom || "Client inconnu",
        created_at: cmd.created_at,
        utilisateur: "–",
        heure_debut_matin: cmd.heure_debut_matin,
        heure_fin_matin: cmd.heure_fin_matin,
        heure_debut_soir: cmd.heure_debut_soir,
        heure_fin_soir: cmd.heure_fin_soir,
      })

      setActions([
        ...commandes.map(formatCommande),
        ...historiqueFiltree as any[],
      ])
    }

    fetch()
  }, [open, candidatId, semaineEnCours, nomPrenom])

  const renderHeure = (debut?: string | null, fin?: string | null) => {
    if (!debut || !fin) return null
    return `${debut.slice(0, 5)} - ${fin.slice(0, 5)}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden max-h-[95vh]">
        <div className="bg-[#840404] text-white px-6 py-4 text-lg font-bold">
          Historique du candidat – {nomPrenom}
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50">
          <button
            onClick={() => setSemaineEnCours((prev) => addDays(prev, -7))}
            className="text-sm text-blue-600 hover:underline"
          >
            ◀ Semaine précédente
          </button>
          <div className="text-sm font-medium text-gray-700">
            Semaine du {format(debutSemaine, "dd MMM", { locale: fr })} au{" "}
            {format(finSemaine, "dd MMM", { locale: fr })}
          </div>
          <button
            onClick={() => setSemaineEnCours((prev) => addDays(prev, 7))}
            className="text-sm text-blue-600 hover:underline"
          >
            Semaine suivante ▶
          </button>
        </div>

        <div className="max-h-[600px] overflow-y-auto p-6 space-y-4 bg-white">
          {actions.length > 0 ? (
            actions.map((item) => (
              <div
                key={item.id}
                className="bg-gray-50 border rounded-md p-4 flex justify-between items-start"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      style={{
                        backgroundColor: statutColors[item.statut]?.bg || "#e5e7eb",
                        color: statutColors[item.statut]?.text || "#111827",
                        borderRadius: "4px",
                      }}
                    >
                      {item.statut}
                    </Badge>
                  </div>
                  <div className="text-sm font-semibold text-gray-800 mb-1">
                    {item.client}
                  </div>
                  <div className="text-xs text-gray-600 mb-1">
                    📅{" "}
                    {item.date
                      ? format(new Date(item.date), "EEEE d MMMM", { locale: fr })
                      : "Date inconnue"}
                  </div>
                  {item.heure_debut_matin && (
                    <div className="text-xs text-gray-600">
                      Matin :{" "}
                      {renderHeure(item.heure_debut_matin, item.heure_fin_matin)}
                    </div>
                  )}
                  {item.heure_debut_soir && (
                    <div className="text-xs text-gray-600">
                      Soir :{" "}
                      {renderHeure(item.heure_debut_soir, item.heure_fin_soir)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-right text-gray-500 flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {item.created_at
                      ? format(new Date(item.created_at), "dd/MM/yyyy HH:mm")
                      : "--"}
                  </div>
                  <div className="flex items-center gap-1">
                    <UserRound className="w-4 h-4" />
                    {item.utilisateur}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm italic text-gray-500">
              Aucun historique pour cette semaine.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
