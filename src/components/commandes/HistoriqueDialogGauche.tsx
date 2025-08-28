import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Clock, UserRound, Pencil, FileText, RefreshCcw } from "lucide-react"
import { statutColors } from "@/lib/colors"
import { Historique } from "@/types/types-front"

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
        .select("id, date, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir, candidat_id, candidat:candidat_id (nom, prenom)")
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

  const formatHeure = (h?: string | null) => (h && h.length >= 5 ? h.slice(0, 5) : "--:--")

  const renderBloc = (item: Historique) => {
    const apres = (item.apres || {}) as any
    const avant = (item.avant || {}) as any
    const date = format(new Date(item.date_action), "EEEE d MMMM yyyy - HH:mm", { locale: fr })
    const action = item.action
    const commande = commandesMap[item.ligne_id]
    const candidatApres = apres?.candidat
    const candidatAvant = avant?.candidat

    let titre = "Action inconnue"
    let badge: JSX.Element | null = null
    let complement: JSX.Element | null = null
    let Icon = Pencil

    // ———————————————————
    // Création
    // ———————————————————
    if (action === "creation") {
      titre = "Création de commande"
      Icon = Pencil
      badge = (
        <Badge
          style={{
            backgroundColor: statutColors["En recherche"]?.bg,
            color: statutColors["En recherche"]?.text,
          }}
        >
          En recherche
        </Badge>
      )
      complement = (
        <>
          <div>
            Journée :{" "}
            {commande?.date ? format(new Date(commande.date), "EEEE d MMMM", { locale: fr }) : "?"}
          </div>
          {commande?.heure_debut_matin && (
            <div>
              Matin : {formatHeure(commande.heure_debut_matin)} - {formatHeure(commande.heure_fin_matin)}
            </div>
          )}
          {commande?.heure_debut_soir && (
            <div>
              Soir : {formatHeure(commande.heure_debut_soir)} - {formatHeure(commande.heure_fin_soir)}
            </div>
          )}
        </>
      )
    }

    // ———————————————————
    // Planification
    // ———————————————————
    else if (action === "planification") {
      titre = "Planification"
      Icon = Pencil
      badge =
        candidatApres && (
          <Badge
            style={{
              backgroundColor: statutColors["Validé"]?.bg,
              color: statutColors["Validé"]?.text,
            }}
          >
            {candidatApres.nom} {candidatApres.prenom}
          </Badge>
        )
      complement = (
        <>
          <div>
            Journée :{" "}
            {apres?.date ? format(new Date(apres.date), "EEEE d MMMM", { locale: fr }) : "?"}
          </div>
          {apres?.heure_debut_matin && (
            <div>
              Matin : {formatHeure(apres.heure_debut_matin)} - {formatHeure(apres.heure_fin_matin)}
            </div>
          )}
          {apres?.heure_debut_soir && (
            <div>
              Soir : {formatHeure(apres.heure_debut_soir)} - {formatHeure(apres.heure_fin_soir)}
            </div>
          )}
        </>
      )
    }

    // ———————————————————
    // Modification horaire
    // ———————————————————
    else if (action === "modification_horaire") {
      titre = "Modification horaire"
      Icon = Pencil
      const champ = apres?.champ || "?"
      const valeur = apres?.valeur || "?"
      badge = <Badge variant="secondary">{champ}</Badge>
      complement = <div>Nouvelle valeur : {formatHeure(valeur)}</div>
    }

    // ———————————————————
    // Modification commentaire
    // ———————————————————
    else if (action === "modification_commentaire") {
      titre = "Modification commentaire"
      Icon = Pencil
      complement = (
        <div className="text-sm text-muted-foreground italic">
          {apres?.commentaire || "(commentaire vide)"}
        </div>
      )
    }

    // ———————————————————
    // Remplacement candidat
    // ———————————————————
    else if (action === "remplacement") {
      titre = "Remplacement candidat"
      Icon = Pencil
      badge =
        apres?.nouveau_candidat && (
          <Badge
            style={{
              backgroundColor: statutColors["Validé"]?.bg,
              color: statutColors["Validé"]?.text,
            }}
          >
            {apres.nouveau_candidat.nom} {apres.nouveau_candidat.prenom}
          </Badge>
        )
      complement =
        apres?.ancien_candidat && (
          <div className="text-sm text-muted-foreground">
            Remplace <strong>{apres.ancien_candidat.nom} {apres.ancien_candidat.prenom}</strong>
          </div>
        )
    }

    // ———————————————————
    // Changement de statut (texte court si remise en recherche)
    // ———————————————————
    else if (action === "statut") {
      titre = apres?.remettre_en_recherche ? "Annule + En Rech" : "Changement de statut"
      Icon = RefreshCcw
      const statut = apres?.statut || "?"

      // Fallback candidat : apres.candidat -> avant.candidat -> commande.candidat
      const candidateFromApres = candidatApres
      const candidateFromAvant = candidatAvant
      const candidateFromCommande = commande?.candidat
      const candidateName =
        (candidateFromApres && `${candidateFromApres.nom} ${candidateFromApres.prenom}`.trim()) ||
        (candidateFromAvant && `${candidateFromAvant.nom} ${candidateFromAvant.prenom}`.trim()) ||
        (candidateFromCommande && `${candidateFromCommande.nom} ${candidateFromCommande.prenom}`.trim()) ||
        null

      // Badge couleur du statut (texte = statut uniquement)
      badge = (
        <Badge
          style={{
            backgroundColor: statutColors[statut]?.bg || "#e5e7eb",
            color: statutColors[statut]?.text || "#111827",
          }}
        >
          {statut}
        </Badge>
      )

      // On supprime "Portée : ..." ; on ajoute le candidat concerné (si identifié)
      complement = (
        <div className="text-sm text-muted-foreground space-y-1">
          {apres?.remettre_en_recherche && (
            <div>Action : recréation de commande(s) en <strong>En recherche</strong></div>
          )}
          {candidateName && (
            <div>
              Candidat concerné : <strong>{candidateName}</strong>
            </div>
          )}
          {apres?.complement_motif && (
            <div>Motif (ADA) : <strong>{apres.complement_motif}</strong></div>
          )}
        </div>
      )
    }

    // ———————————————————
    // Motif de contrat (nouveau/ancien libellé)
    // ———————————————————
    else if (action === "modification_motif_contrat" || action === "modification_motif") {
      titre = "Motif de contrat"
      Icon = FileText
      const motif = apres?.motif_contrat ?? apres?.motif
      const complementMotif = apres?.complement_motif
      badge = motif ? <Badge variant="secondary">{motif}</Badge> : null
      complement = (
        <div className="text-sm text-muted-foreground">
          {complementMotif ? <>Précision : <strong>{complementMotif}</strong></> : "Aucune précision"}
        </div>
      )
    }

    // ———————————————————
    // Recréation de commande(s) explicite
    // ———————————————————
    else if (action === "recreation_commande" || action === "recreation_commande_batch") {
      titre = "Recréation de mission(s)"
      Icon = RefreshCcw
      badge = (
        <Badge
          style={{
            backgroundColor: statutColors["En recherche"]?.bg,
            color: statutColors["En recherche"]?.text,
          }}
        >
          En recherche
        </Badge>
      )
      const dates: string[] =
        apres?.dates ||
        (apres?.nouvelles_commandes?.map?.((x: any) => x.date).filter(Boolean) ?? [])
      complement = dates.length ? (
        <div className="text-sm text-muted-foreground">
          Dates recréées :{" "}
          <strong>
            {dates
              .map((d) => format(new Date(d), "dd/MM", { locale: fr }))
              .join(", ")}
          </strong>
        </div>
      ) : null
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
            <Icon className="h-4 w-4 text-gray-600" />
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
