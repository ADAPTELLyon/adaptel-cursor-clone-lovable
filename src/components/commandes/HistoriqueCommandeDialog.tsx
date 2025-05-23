import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { statutColors } from "@/lib/colors"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { UserRound, Clock, Pencil } from "lucide-react"
import type { Historique } from "@/types/types-front"
import { Button } from "@/components/ui/button"
import { PlanningCandidatsSemaine } from "./PlanningCandidatsSemaine"

interface Props {
  commandeIds: string[]
  secteur: string
  semaineDate: string
}

export function HistoriqueCommandeDialog({
  commandeIds,
  secteur,
  semaineDate,
}: Props) {
  const [historique, setHistorique] = useState<Historique[]>([])
  const [open, setOpen] = useState(false)

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

  const formatHeure = (h?: string | null) =>
    h && h.length >= 5 ? h.slice(0, 5) : "--:--"

  const renderLibelleChamp = (champ: string) => {
    const map: Record<string, string> = {
      heure_debut_matin: "Heure début matin",
      heure_fin_matin: "Heure fin matin",
      heure_debut_soir: "Heure début soir",
      heure_fin_soir: "Heure fin soir",
      heure_debut_nuit: "Heure début nuit",
      heure_fin_nuit: "Heure fin nuit",
    }
    return map[champ] || "Champ inconnu"
  }

  const renderBloc = (item: Historique) => {
    const date = format(new Date(item.date_action), "EEEE d MMMM yyyy - HH:mm", { locale: fr })
    const action = item.action
    const apres = item.apres || {}
    const candidat = apres?.candidat
    const ancien = apres?.ancien_candidat
    const nouveau = apres?.nouveau_candidat

    let titre = ""
    let complement = null
    let badge = null

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
          <div>Journée : {apres.date ? format(new Date(apres.date), "EEEE d MMMM", { locale: fr }) : "?"}</div>
          {apres.heure_debut_matin && (
            <div>Matin : {formatHeure(apres.heure_debut_matin)} - {formatHeure(apres.heure_fin_matin)}</div>
          )}
          {apres.heure_debut_soir && (
            <div>Soir : {formatHeure(apres.heure_debut_soir)} - {formatHeure(apres.heure_fin_soir)}</div>
          )}
        </>
      )
    }

    else if (action === "planification") {
      titre = "Planification"
      badge = (
        <Badge style={{
          backgroundColor: statutColors["Validé"]?.bg,
          color: statutColors["Validé"]?.text,
        }}>
          {candidat?.nom} {candidat?.prenom}
        </Badge>
      )
      complement = (
        <>
          <div>Journée : {apres.date ? format(new Date(apres.date), "EEEE d MMMM", { locale: fr }) : "?"}</div>
          {apres.heure_debut_matin && (
            <div>Matin : {formatHeure(apres.heure_debut_matin)} - {formatHeure(apres.heure_fin_matin)}</div>
          )}
          {apres.heure_debut_soir && (
            <div>Soir : {formatHeure(apres.heure_debut_soir)} - {formatHeure(apres.heure_fin_soir)}</div>
          )}
        </>
      )
    }

    else if (action === "modification_horaire") {
      titre = "Modification horaire"
      const champ = apres?.champ || ""
      const valeur = apres?.valeur || ""
      badge = <Badge variant="secondary">{renderLibelleChamp(champ)}</Badge>
      complement = <div>Nouvelle valeur : {formatHeure(valeur)}</div>
    }

    else if (action === "statut") {
      titre = "Changement de statut"
      badge = (
        <Badge style={{
          backgroundColor: statutColors[apres?.statut]?.bg,
          color: statutColors[apres?.statut]?.text,
        }}>
          {apres?.statut || "?"}
        </Badge>
      )
      complement = apres?.complement_motif ? (
        <div className="text-sm text-muted-foreground">
          Motif : <span className="italic">{apres.complement_motif}</span>
        </div>
      ) : null
    }

    else if (action === "remplacement") {
      titre = "Changement de candidat"
      badge = (
        <Badge style={{
          backgroundColor: statutColors["Validé"]?.bg,
          color: statutColors["Validé"]?.text,
        }}>
          {nouveau?.nom} {nouveau?.prenom}
        </Badge>
      )
      complement = (
        <div className="text-sm text-muted-foreground">
          Remplacement de <strong>{ancien?.nom} {ancien?.prenom}</strong>
        </div>
      )
    }

    else {
      titre = "Action inconnue"
      complement = (
        <div className="italic text-muted-foreground">
          {item.description || "(pas de détail)"}
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
    <div>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4 text-gray-600" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-7xl p-6">
          <DialogHeader>
            <DialogTitle>Historique & Disponibilités</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-[1fr_2fr] gap-6">
            <div className="border rounded-md bg-gray-50 px-4 py-4 h-[600px] overflow-y-auto space-y-4">
              {historique.length > 0 ? (
                historique.map(renderBloc)
              ) : (
                <div className="text-sm italic text-gray-400">
                  Aucun historique pour cette ligne.
                </div>
              )}
            </div>

            <div className="h-[600px] overflow-y-auto pr-2">
              <PlanningCandidatsSemaine
                secteur={secteur}
                semaineDate={semaineDate}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
