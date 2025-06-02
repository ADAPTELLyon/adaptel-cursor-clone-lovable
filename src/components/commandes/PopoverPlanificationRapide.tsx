import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "@/hooks/use-toast"
import type { CommandeWithCandidat } from "@/types/types-front"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CheckCircle2, Clock, AlertCircle, Car, Ban, Check, History } from "lucide-react"
import { cn } from "@/lib/utils"

const statusConfig = {
  dispo: {
    title: "Disponibles",
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "bg-[#8ea9db]",
    textColor: "text-[#8ea9db]",
    borderColor: "border-[#8ea9db]",
    badgeColor: "bg-[#8ea9db]/10 text-[#8ea9db]"
  },
  nonRenseigne: {
    title: "Non renseignés",
    icon: <Clock className="w-4 h-4" />,
    color: "bg-[#e5e7eb]",
    textColor: "text-[#6b7280]",
    borderColor: "border-[#e5e7eb]",
    badgeColor: "bg-[#e5e7eb]/10 text-[#6b7280]"
  },
  planifie: {
    title: "Déjà planifiés",
    icon: <AlertCircle className="w-4 h-4" />,
    color: "bg-[#a9d08e]",
    textColor: "text-[#a9d08e]",
    borderColor: "border-[#a9d08e]",
    badgeColor: "bg-[#a9d08e]/10 text-[#a9d08e]"
  }
}

type CandidatMini = {
  id: string
  nom: string
  prenom: string
  vehicule?: boolean
  // Ces champs seront ajoutés plus tard
  interditClient?: boolean
  prioritaire?: boolean
  dejaPlanifie?: boolean
}

interface PlanificationCandidatDialogProps {
  open: boolean
  onClose: () => void
  date: string
  secteur: string
  service?: string
  commande: CommandeWithCandidat
  onSuccess: () => void
}

export function PlanificationCandidatDialog({
  open,
  onClose,
  date,
  secteur,
  service,
  commande,
  onSuccess,
}: PlanificationCandidatDialogProps) {
  const { data: candidats = [] } = useCandidatsBySecteur(secteur)
  const [dispos, setDispos] = useState<CandidatMini[]>([])
  const [nonRenseignes, setNonRenseignes] = useState<CandidatMini[]>([])
  const [planifies, setPlanifies] = useState<CandidatMini[]>([])
  const [expandedSection, setExpandedSection] = useState<'dispo' | 'nonRenseigne' | 'planifie' | null>(null)

  useEffect(() => {
    if (!open || candidats.length === 0) return

    const fetchDispoEtPlanif = async () => {
      const jour = date.slice(0, 10)
      const candidatIds = candidats.map((c) => c.id)

      const { data: dispoData } = await supabase
        .from("disponibilites")
        .select("candidat_id, statut")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", candidatIds)

      const dispoMap = new Map<string, string>()
      for (const d of dispoData || []) {
        dispoMap.set(d.candidat_id, d.statut)
      }

      const { data: planifData } = await supabase
        .from("planification")
        .select("candidat_id, commande_id, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", candidatIds)

      const planifieSet = new Map(
        planifData?.map(p => [p.candidat_id, p]) || []
      )

      const dispoList: CandidatMini[] = []
      const planifieList: CandidatMini[] = []
      const nonList: CandidatMini[] = []

      for (const c of candidats) {
        const mini: CandidatMini = {
          id: c.id,
          nom: c.nom,
          prenom: c.prenom,
          vehicule: c.vehicule,
          // TODO: Récupérer ces informations depuis Supabase
          interditClient: false,
          prioritaire: false,
          dejaPlanifie: false
        }

        if (planifieSet.has(c.id)) {
          planifieList.push(mini)
        } else if (dispoMap.get(c.id) === "Dispo") {
          dispoList.push(mini)
        } else if (!dispoMap.has(c.id)) {
          nonList.push(mini)
        }
      }

      setDispos(dispoList)
      setPlanifies(planifieList)
      setNonRenseignes(nonList)
      
      // Ouvrir par défaut la section des disponibles si elle n'est pas vide
      if (dispoList.length > 0) {
        setExpandedSection('dispo')
      }
    }

    fetchDispoEtPlanif()
  }, [open, date, secteur, candidats])

  const hasHeures = (debut?: string | null, fin?: string | null) => !!(debut && fin)

  const handleSelect = async (candidatId: string) => {
    const jour = date.slice(0, 10)
    const candidat = candidats.find((c) => c.id === candidatId)

    const { data: existingPlanifs, error: planifError } = await supabase
      .from("planification")
      .select("heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
      .eq("candidat_id", candidatId)
      .eq("date", jour)

    if (planifError) {
      toast({ title: "Erreur", description: "Erreur vérification conflit", variant: "destructive" })
      return
    }

    const conflitMatin =
      hasHeures(commande.heure_debut_matin, commande.heure_fin_matin) &&
      existingPlanifs?.some((p) => hasHeures(p.heure_debut_matin, p.heure_fin_matin))

    const conflitSoir =
      hasHeures(commande.heure_debut_soir, commande.heure_fin_soir) &&
      existingPlanifs?.some((p) => hasHeures(p.heure_debut_soir, p.heure_fin_soir))

    if (conflitMatin || conflitSoir) {
      toast({
        title: "Conflit de créneau",
        description: "Ce candidat a déjà une mission sur ce créneau.",
        variant: "destructive",
      })
      return
    }

    const { error: errInsertPlanif } = await supabase.from("planification").insert({
      commande_id: commande.id,
      candidat_id: candidatId,
      date,
      secteur,
      statut: "Validé",
      heure_debut_matin: commande.heure_debut_matin,
      heure_fin_matin: commande.heure_fin_matin,
      heure_debut_soir: commande.heure_debut_soir,
      heure_fin_soir: commande.heure_fin_soir,
      heure_debut_nuit: null,
      heure_fin_nuit: null,
    })

    if (errInsertPlanif) {
      toast({ title: "Erreur", description: "Échec insertion planification", variant: "destructive" })
      return
    }

    const { error: errUpdateCommande } = await supabase
      .from("commandes")
      .update({
        candidat_id: candidatId,
        statut: "Validé",
      })
      .eq("id", commande.id)

    if (errUpdateCommande) {
      toast({ title: "Erreur", description: "Échec mise à jour commande", variant: "destructive" })
      return
    }

    const { data: authData } = await supabase.auth.getUser()
    const userEmail = authData?.user?.email || null

    if (userEmail) {
      const { data: userApp } = await supabase
        .from("utilisateurs")
        .select("id")
        .eq("email", userEmail)
        .single()

      const userId = userApp?.id || null

      if (userId) {
        await supabase.from("historique").insert({
          table_cible: "commandes",
          ligne_id: commande.id,
          action: "planification",
          description: "Planification via popup PlanificationCandidatDialog",
          user_id: userId,
          date_action: new Date().toISOString(),
          apres: {
            date,
            candidat: {
              nom: candidat?.nom || "",
              prenom: candidat?.prenom || "",
            },
            heure_debut_matin: commande.heure_debut_matin,
            heure_fin_matin: commande.heure_fin_matin,
            heure_debut_soir: commande.heure_debut_soir,
            heure_fin_soir: commande.heure_fin_soir,
          },
        })
      }
    }

    toast({ title: "Candidat planifié avec succès" })
    onClose()
    onSuccess()
  }

  const dateFormatee = format(new Date(date), "eeee d MMMM", { locale: fr })

  const StatusSection = ({
    statusKey,
    candidats,
  }: {
    statusKey: keyof typeof statusConfig
    candidats: CandidatMini[]
  }) => {
    const config = statusConfig[statusKey]
    const isExpanded = expandedSection === statusKey
    
    return (
      <div className={cn(
        "rounded-lg border overflow-hidden transition-all",
        config.borderColor,
        isExpanded ? "border-2" : "border"
      )}>
        <button
          className={cn(
            "w-full flex items-center justify-between p-3",
            "hover:bg-muted/50 transition-colors",
            config.color,
            isExpanded ? "bg-opacity-20" : "bg-opacity-10"
          )}
          onClick={() => setExpandedSection(isExpanded ? null : statusKey)}
        >
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full", config.badgeColor)}>
              {config.icon}
            </div>
            <h3 className="font-medium">
              {config.title} <span className="text-muted-foreground">({candidats.length})</span>
            </h3>
          </div>
          <div className={cn(
            "text-xs px-2 py-1 rounded-full",
            config.badgeColor
          )}>
            {isExpanded ? "Réduire" : "Voir"}
          </div>
        </button>
        
        {isExpanded && (
          <div className="p-2 space-y-2">
            {candidats.length === 0 ? (
              <p className="text-sm text-muted-foreground italic p-3 text-center">
                Aucun candidat dans cette catégorie
              </p>
            ) : (
              candidats.map((c) => (
                <CandidatItem key={c.id} candidat={c} status={statusKey} />
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  const CandidatItem = ({
    candidat,
    status,
  }: {
    candidat: CandidatMini
    status: keyof typeof statusConfig
  }) => {
    const config = statusConfig[status]
    
    return (
      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className={cn("bg-opacity-10", config.badgeColor)}>
              {candidat.nom.charAt(0)}{candidat.prenom.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">
              {candidat.nom} {candidat.prenom}
            </p>
            {status === 'planifie' && (
              <p className="text-xs text-muted-foreground">
                {/* TODO: Afficher les infos de mission quand elles seront disponibles */}
                Mission prévue: [Nom établissement] • [Heures]
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Indicateurs visuels */}
          <div className="flex items-center gap-1">
            {candidat.vehicule && (
              <span className="p-1 rounded-full bg-muted" title="Véhicule">
                <Car className="w-4 h-4 text-blue-500" />
              </span>
            )}
            {candidat.interditClient && (
              <span className="p-1 rounded-full bg-muted" title="Interdit sur ce client">
                <Ban className="w-4 h-4 text-red-500" />
              </span>
            )}
            {candidat.prioritaire && (
              <span className="p-1 rounded-full bg-muted" title="Prioritaire">
                <Check className="w-4 h-4 text-green-500" />
              </span>
            )}
            {candidat.dejaPlanifie && (
              <span className="p-1 rounded-full bg-muted" title="Déjà planifié sur ce client">
                <History className="w-4 h-4 text-amber-500" />
              </span>
            )}
          </div>
          
          {status !== 'planifie' && (
            <Button
              variant="outline"
              size="sm"
              className={cn("border", config.textColor, "hover:text-white hover:bg-[#8ea9db]")}
              onClick={() => handleSelect(candidat.id)}
            >
              Sélectionner
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <span className="p-2 rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            Planifier un candidat • {secteur}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {dateFormatee}
            {service && ` • ${service}`}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <StatusSection statusKey="dispo" candidats={dispos} />
          <StatusSection statusKey="nonRenseigne" candidats={nonRenseignes} />
          <StatusSection statusKey="planifie" candidats={planifies} />
        </div>
      </DialogContent>
    </Dialog>
  )
}