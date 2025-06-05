import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Clock, UserRound, Pencil } from "lucide-react"
import { statutColors } from "@/lib/colors"
import { Historique } from "@/types/types-front"
import { Commande } from "@/types/types-front"

interface Props {
  commandeIds: string[]
  open: boolean
}

export function HistoriqueDialogGauche({ commandeIds, open }: Props) {
  const [historique, setHistorique] = useState<Historique[]>([])
  const [commandesMap, setCommandesMap] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!commandeIds || commandeIds.length === 0 || !open) return

    const fetchHistorique = async () => {
      const { data } = await supabase
        .from("historique")
        .select("*, user:user_id (prenom)")
        .eq("table_cible", "commandes")
        .in("ligne_id", commandeIds)
        .order("date_action", { ascending: false })

      if (data) setHistorique(data)
    }

    fetchHistorique()
  }, [commandeIds, open])

  useEffect(() => {
    const ids = Array.from(new Set(historique.map((h) => h.ligne_id)))
    if (ids.length === 0) return

    const fetchCommandes = async () => {
      const { data } = await supabase
        .from("commandes")
        .select("id, date, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
        .in("id", ids)
      if (data) {
        const map: Record<string, any> = {}
        data.forEach((cmd) => {
          map[cmd.id] = cmd
        })
        setCommandesMap(map)
      }
    }

    fetchCommandes()
  }, [historique])

  const formatHeure = (h?: string | null) => h && h.length >= 5 ? h.slice(0, 5) : "--:--"

  const renderBloc = (item: Historique) => {
    const apres = item.apres as any
    const date = format(new Date(item.date_action), "EEEE d MMMM yyyy - HH:mm", { locale: fr })
    const action = item.action
    const commande = commandesMap[item.ligne_id]
    const candidat = apres?.candidat

    let titre = "Action inconnue"
    let badge = null
    let complement = null

    if (action === "creation") {
      titre = "Création de commande"
      badge = (
        <Badge style={{
          backgroundColor: statutColors["En recherche"]?.bg,
          color: statutColors["En recherche"]?.text,
        }}>
          En recherche
        </Badge>
      )
      complement = (
        <>
          <div>Journée : {commande?.date ? format(new Date(commande.date), "EEEE d MMMM", { locale: fr }) : "?"}</div>
          {commande?.heure_debut_matin && (
            <div>Matin : {formatHeure(commande.heure_debut_matin)} - {formatHeure(commande.heure_fin_matin)}</div>
          )}
          {commande?.heure_debut_soir && (
            <div>Soir : {formatHeure(commande.heure_debut_soir)} - {formatHeure(commande.heure_fin_soir)}</div>
          )}
        </>
      )
    }

    else if (action === "planification") {
      titre = "Planification"
      badge = candidat && (
        <Badge style={{
          backgroundColor: statutColors["Validé"]?.bg,
          color: statutColors["Validé"]?.text,
        }}>
          {candidat.nom} {candidat.prenom}
        </Badge>
      )
      complement = (
        <>
          <div>Journée : {apres?.date ? format(new Date(apres.date), "EEEE d MMMM", { locale: fr }) : "?"}</div>
          {apres?.heure_debut_matin && (
            <div>Matin : {formatHeure(apres.heure_debut_matin)} - {formatHeure(apres.heure_fin_matin)}</div>
          )}
          {apres?.heure_debut_soir && (
            <div>Soir : {formatHeure(apres.heure_debut_soir)} - {formatHeure(apres.heure_fin_soir)}</div>
          )}
        </>
      )
    }

    else if (action === "modification_horaire") {
      titre = "Modification horaire"
      const champ = apres?.champ || "?"
      const valeur = apres?.valeur || "?"
      badge = <Badge variant="secondary">{champ}</Badge>
      complement = <div>Nouvelle valeur : {formatHeure(valeur)}</div>
    }

    else if (action === "modification_commentaire") {
      titre = "Modification commentaire"
      complement = (
        <div className="text-sm text-muted-foreground italic">
          {apres?.commentaire || "(commentaire vide)"}
        </div>
      )
    }

    else if (action === "remplacement") {
      titre = "Remplacement candidat"
      badge = apres?.nouveau_candidat && (
        <Badge style={{
          backgroundColor: statutColors["Validé"]?.bg,
          color: statutColors["Validé"]?.text,
        }}>
          {apres.nouveau_candidat.nom} {apres.nouveau_candidat.prenom}
        </Badge>
      )
      complement = apres?.ancien_candidat && (
        <div className="text-sm text-muted-foreground">
          Remplace <strong>{apres.ancien_candidat.nom} {apres.ancien_candidat.prenom}</strong>
        </div>
      )
    }

    else if (action === "statut") {
      titre = "Changement de statut"
      const statut = apres?.statut || "?"
      badge = (
        <Badge style={{
          backgroundColor: statutColors[statut]?.bg || "#e5e7eb",
          color: statutColors[statut]?.text || "#111827",
        }}>
          {statut}
        </Badge>
      )
      complement = apres?.candidat && (
        <div className="text-sm text-muted-foreground">
          Candidat remplacé : <strong>{apres.candidat.nom} {apres.candidat.prenom}</strong>
        </div>
      )
    }

    return (
      <div key={item.id} className="border rounded-lg p-3 bg-white shadow-sm space-y-2">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {date}
          </div>
          <div className="flex items-center gap-1">
            <UserRound className="h-4 w-4" />
            {item.user?.prenom || "Utilisateur inconnu"}
          </div>
        </div>

        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <Pencil className="h-4 w-4 text-gray-600" />
            <span>{titre}</span>
            {badge}
          </div>
          {complement}
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-md bg-gray-50 px-4 py-4 h-[600px] overflow-y-auto space-y-4">
      {historique.length > 0 ? (
        historique.map(renderBloc)
      ) : (
        <div className="text-sm italic text-gray-400">
          Aucun historique pour cette ligne.
        </div>
      )}
    </div>
  )
}
