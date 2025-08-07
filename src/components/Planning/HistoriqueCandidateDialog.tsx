// HistoriqueCandidatDialog.tsx
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { format, startOfWeek, addDays, getWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Clock, UserRound, ArrowLeft, ArrowRight, AlertTriangle, Ban, Star } from "lucide-react"
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
  const semaineNumero = getWeek(semaineEnCours, { weekStartsOn: 1 })

  useEffect(() => {
    if (!open || !candidatId) return

    const fetchHistorique = async () => {
      const [nomRef, prenomRef] = nomPrenom.toLowerCase().split(" ")

      const { data: users } = await supabase
        .from("utilisateurs")
        .select("id, prenom, nom, email")

      const { data: commandes } = await supabase
        .from("commandes")
        .select("id, statut, date, client:client_id(nom), created_at, created_by, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
        .eq("candidat_id", candidatId)
        .eq("statut", "Validé")
        .gte("date", format(debutSemaine, "yyyy-MM-dd"))
        .lte("date", format(finSemaine, "yyyy-MM-dd"))

      const planifs = (commandes || []).map((cmd) => ({
        id: cmd.id,
        statut: "Planification",
        date: cmd.date,
        client: cmd.client?.nom || "Client inconnu",
        created_at: cmd.created_at,
        utilisateur: users?.find((u) => u.id === cmd.created_by)?.prenom || users?.find((u) => u.id === cmd.created_by)?.email || "Utilisateur inconnu",
        heure_debut_matin: cmd.heure_debut_matin,
        heure_fin_matin: cmd.heure_fin_matin,
        heure_debut_soir: cmd.heure_debut_soir,
        heure_fin_soir: cmd.heure_fin_soir,
      }))

      const { data: historique } = await supabase
        .from("historique")
        .select("id, table_cible, ligne_id, action, apres, date_action, user_id")
        .eq("table_cible", "commandes")
        .gte("date_action", debutSemaine.toISOString())
        .lte("date_action", finSemaine.toISOString())

      const autresStatuts = ["Absence", "Annule Int", "Annule Client", "Annule ADA"]

      const historiqueFiltree = (historique || []).map((entry) => {
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
              utilisateur: users?.find((u) => u.id === entry.user_id)?.prenom || users?.find((u) => u.id === entry.user_id)?.email || "Utilisateur inconnu",
            }
          }
          return null
        } catch {
          return null
        }
      }).filter(Boolean)

      const { data: ip } = await supabase
        .from("interdictions_priorites")
        .select("id, type, created_at, created_by, secteur, service, client:client_id(nom), commentaire")
        .eq("candidat_id", candidatId)
        .gte("created_at", debutSemaine.toISOString())
        .lte("created_at", finSemaine.toISOString())

      const ipActions = (ip || []).map((item) => ({
        id: item.id,
        statut: item.type === "interdiction" ? "Interdiction" : "Priorité",
        date: item.created_at,
        client: item.client?.nom || "Client inconnu",
        commentaire: item.commentaire,
        secteur: item.secteur,
        service: item.service,
        created_at: item.created_at,
        utilisateur: users?.find((u) => u.id === item.created_by)?.prenom || users?.find((u) => u.id === item.created_by)?.email || "Utilisateur inconnu",
      }))

      const { data: incidents } = await supabase
        .from("incidents")
        .select("id, type_incident, description, date_incident, client:client_id(nom), created_at, created_by")
        .eq("candidat_id", candidatId)
        .gte("created_at", debutSemaine.toISOString())
        .lte("created_at", finSemaine.toISOString())

      const incidentActions = (incidents || []).map((item) => ({
        id: item.id,
        statut: "Incident",
        date: item.date_incident,
        client: item.client?.nom || "Client inconnu",
        commentaire: item.description,
        type_incident: item.type_incident,
        created_at: item.created_at,
        utilisateur: users?.find((u) => u.id === item.created_by)?.prenom || users?.find((u) => u.id === item.created_by)?.email || "Utilisateur inconnu",
      }))

      setActions([
        ...planifs,
        ...historiqueFiltree as any[],
        ...ipActions,
        ...incidentActions,
      ])
    }

    fetchHistorique()
  }, [open, candidatId, semaineEnCours, nomPrenom])

  const renderHeure = (debut?: string | null, fin?: string | null) => {
    if (!debut || !fin) return null
    return `${debut.slice(0, 5)} - ${fin.slice(0, 5)}`
  }

  const renderBadge = (statut: string) => {
    const style = {
      minWidth: "130px",
      justifyContent: "center" as const,
      display: "inline-flex",
    }

    if (statut === "Planification") {
      return (
        <Badge style={{ ...style, backgroundColor: statutColors["Validé"]?.bg, color: statutColors["Validé"]?.text }}>
          Planification
        </Badge>
      )
    }
    if (statut === "Interdiction") {
      return (
        <Badge className="bg-red-600 text-white gap-1" style={style}>
          <Ban className="h-3 w-3" /> Interdiction
        </Badge>
      )
    }
    if (statut === "Priorité") {
      return (
        <Badge className="bg-green-600 text-white gap-1" style={style}>
          <Star className="h-3 w-3" /> Priorité
        </Badge>
      )
    }
    if (statut === "Incident") {
      return (
        <Badge className="bg-orange-500 text-white gap-1" style={style}>
          <AlertTriangle className="h-3 w-3" /> Incident
        </Badge>
      )
    }
    return (
      <Badge style={{ ...style, backgroundColor: statutColors[statut]?.bg, color: statutColors[statut]?.text }}>
        {statut}
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full p-0 max-h-[90vh] flex flex-col">
        <div className="bg-[#840404] text-white px-6 py-4 text-lg font-bold">
          Historique – Semaine {semaineNumero} – {nomPrenom}
        </div>

        <div className="flex justify-between items-center px-6 py-3 border-b bg-gray-50 text-sm font-medium">
          <button onClick={() => setSemaineEnCours((prev) => addDays(prev, -7))} className="flex items-center gap-1 text-blue-600">
            <ArrowLeft className="w-4 h-4" /> Semaine précédente
          </button>
          <div className="text-center">
            <div className="text-base font-semibold">Semaine {semaineNumero}</div>
            <div className="text-xs text-gray-500">
              {format(debutSemaine, "dd MMM", { locale: fr })} – {format(finSemaine, "dd MMM", { locale: fr })}
            </div>
          </div>
          <button onClick={() => setSemaineEnCours((prev) => addDays(prev, 7))} className="flex items-center gap-1 text-blue-600">
            Semaine suivante <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 bg-white space-y-4" style={{ height: "480px" }}>
          {actions.length > 0 ? (
            actions.map((item) => (
              <div key={item.id} className="border rounded-md bg-gray-50 p-4 flex justify-between items-start shadow-sm">
                <div>
                  <div className="mb-2">{renderBadge(item.statut)}</div>
                  <div className="text-sm font-semibold text-gray-800 mb-1">{item.client}</div>
                  <div className="text-xs text-gray-600 mb-1">📅 {item.date ? format(new Date(item.date), "EEEE d MMMM", { locale: fr }) : "Date inconnue"}</div>
                  {item.secteur && <div className="text-xs text-gray-600">Secteur : {item.secteur}</div>}
                  {item.service && <div className="text-xs text-gray-600">Service : {item.service}</div>}
                  {item.type_incident && <div className="text-xs text-gray-600">Type : {item.type_incident}</div>}
                  {item.commentaire && <div className="text-xs text-gray-600">Commentaire : {item.commentaire}</div>}
                  {item.heure_debut_matin && <div className="text-xs text-gray-600">Matin : {renderHeure(item.heure_debut_matin, item.heure_fin_matin)}</div>}
                  {item.heure_debut_soir && <div className="text-xs text-gray-600">Soir : {renderHeure(item.heure_debut_soir, item.heure_fin_soir)}</div>}
                </div>
                <div className="text-xs text-right text-gray-500 flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {item.created_at ? format(new Date(item.created_at), "dd/MM/yyyy HH:mm") : "--"}
                  </div>
                  <div className="flex items-center gap-1">
                    <UserRound className="w-4 h-4" />
                    {item.utilisateur}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm italic text-gray-500">Aucune action pour cette semaine.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
