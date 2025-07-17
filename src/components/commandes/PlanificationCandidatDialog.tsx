import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "@/hooks/use-toast"
import type { CommandeWithCandidat } from "@/types/types-front"
import { CheckCircle2, Clock, AlertCircle, Car, Ban, Check, History, ChevronRight, ArrowDownCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { PlanificationCoupureDialog } from "./PlanificationCoupureDialog"
import { Icon } from "@iconify/react"


const statusConfig = {
  dispo: {
    title: "Disponibles",
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "bg-[#8ea9db]",
    textColor: "text-[#8ea9db]",
    borderColor: "border-[#8ea9db]",
    badgeColor: "bg-[#8ea9db]/10 text-[#8ea9db]",
  },
  nonRenseigne: {
    title: "Non renseignés",
    icon: <Clock className="w-4 h-4" />,
    color: "bg-[#e5e7eb]",
    textColor: "text-[#6b7280]",
    borderColor: "border-[#e5e7eb]",
    badgeColor: "bg-[#e5e7eb]/10 text-[#6b7280]",
  },
  planifie: {
    title: "Déjà planifiés",
    icon: <AlertCircle className="w-4 h-4" />,
    color: "bg-[#a9d08e]",
    textColor: "text-[#a9d08e]",
    borderColor: "border-[#a9d08e]",
    badgeColor: "bg-[#a9d08e]/10 text-[#a9d08e]",
  },
}

type CandidatMini = {
  id: string
  nom: string
  prenom: string
  vehicule?: boolean
  interditClient?: boolean
  prioritaire?: boolean
  dejaPlanifie?: boolean
  dejaTravaille?: boolean
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
  const [planificationDetails, setPlanificationDetails] = useState<Record<string, any>>({})
  const [selectedCandidatId, setSelectedCandidatId] = useState<string | null>(null)
  const [openCoupureDialog, setOpenCoupureDialog] = useState(false)

  useEffect(() => {
    if (!open || candidats.length === 0) return

    const fetchDispoEtPlanif = async () => {
      const jour = date.slice(0, 10)

      const { data: ipData } = await supabase
        .from("interdictions_priorites")
        .select("candidat_id, type")
        .eq("client_id", commande.client_id)

      const interditSet = new Set(
        ipData?.filter((i) => i.type === "interdiction").map((i) => i.candidat_id)
      )
      const prioritaireSet = new Set(
        ipData?.filter((i) => i.type === "priorite").map((i) => i.candidat_id)
      )

      const { data: dejaData } = await supabase
        .from("commandes")
        .select("candidat_id")
        .eq("client_id", commande.client_id)

      const dejaTravailleSet = new Set(
        (dejaData || []).map((c) => c.candidat_id).filter(Boolean)
      )

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

      const detailsMap: Record<string, any> = {}
      planifData?.forEach((p) => {
        detailsMap[p.candidat_id] = p
      })
      setPlanificationDetails(detailsMap)

      const planifieSet = new Set(planifData?.map((p) => p.candidat_id))
      const isCoupure = commande.heure_debut_matin && commande.heure_fin_matin && commande.heure_debut_soir && commande.heure_fin_soir
      const chercheMatin = !!commande.heure_debut_matin && !!commande.heure_fin_matin && !commande.heure_debut_soir
      const chercheSoir = !!commande.heure_debut_soir && !!commande.heure_fin_soir && !commande.heure_debut_matin

      const dispoList: CandidatMini[] = []
      const planifieList: CandidatMini[] = []
      const nonList: CandidatMini[] = []

      for (const c of candidats) {
        const planif = detailsMap[c.id]
        const statut = dispoMap.get(c.id)

        const excluMatin = chercheMatin && planif?.heure_debut_matin && planif?.heure_fin_matin
        const excluSoir = chercheSoir && planif?.heure_debut_soir && planif?.heure_fin_soir
        const excluCoupure = isCoupure && (planif?.heure_debut_matin || planif?.heure_debut_soir)

        if (excluMatin || excluSoir || excluCoupure) continue

        const mini: CandidatMini = {
          id: c.id,
          nom: c.nom,
          prenom: c.prenom,
          vehicule: c.vehicule,
          interditClient: interditSet.has(c.id),
          prioritaire: prioritaireSet.has(c.id),
          dejaPlanifie: planifieSet.has(c.id),
          dejaTravaille: dejaTravailleSet.has(c.id),
        }

        if (planifieSet.has(c.id)) planifieList.push(mini)
        else if (statut === "Dispo") dispoList.push(mini)
        else if (!dispoMap.has(c.id)) nonList.push(mini)
      }

      setDispos(dispoList)
      setPlanifies(planifieList)
      setNonRenseignes(nonList)
    }

    fetchDispoEtPlanif()
  }, [open, date, secteur, candidats])

  const hasHeures = (debut?: string | null, fin?: string | null) => !!(debut && fin)

  const handleSelect = async (candidatId: string) => {
    const jour = date.slice(0, 10)
    const candidat = candidats.find((c) => c.id === candidatId)
  
    const aMatin = commande.heure_debut_matin && commande.heure_fin_matin
    const aSoir = commande.heure_debut_soir && commande.heure_fin_soir
  
    if (aMatin && aSoir) {
      setSelectedCandidatId(candidatId)
      setOpenCoupureDialog(true)
      return
    }
  
    const { data: existingPlanifs } = await supabase
      .from("planification")
      .select("heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
      .eq("candidat_id", candidatId)
      .eq("date", jour)
  
    const conflitMatin =
      aMatin && existingPlanifs?.some((p) => p.heure_debut_matin && p.heure_fin_matin)
    const conflitSoir =
      aSoir && existingPlanifs?.some((p) => p.heure_debut_soir && p.heure_fin_soir)
  
    if (conflitMatin || conflitSoir) {
      toast({
        title: "Conflit de créneau",
        description: "Ce candidat a déjà une mission sur ce créneau.",
        variant: "destructive",
      })
      return
    }
  
    await supabase.from("planification").insert({
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
  
    await supabase
      .from("commandes")
      .update({
        candidat_id: candidatId,
        statut: "Validé",
      })
      .eq("id", commande.id)
  
    const { data: authData } = await supabase.auth.getUser()
    const userEmail = authData?.user?.email || null
  
    if (userEmail && candidat) {
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
          description: "Planification via PlanificationCandidatDialog",
          user_id: userId,
          date_action: new Date().toISOString(),
          apres: {
            date,
            candidat: {
              nom: candidat.nom,
              prenom: candidat.prenom,
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

  const StatusColumn = ({
    statusKey,
    candidats,
  }: {
    statusKey: keyof typeof statusConfig
    candidats: CandidatMini[]
  }) => {
    const config = statusConfig[statusKey]

    return (
      <div className={cn("flex-1 rounded-lg border overflow-hidden", config.borderColor, "border-2 flex flex-col h-full")}>
        <div className={cn("w-full flex items-center justify-between p-3", config.color, "bg-opacity-20")}>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full", config.badgeColor)}>{config.icon}</div>
            <h3 className="font-medium">
              {config.title} <span className="text-muted-foreground">({candidats.length})</span>
            </h3>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[400px] p-2 space-y-1">
          {candidats.length === 0 ? (
            <p className="text-sm text-muted-foreground italic p-3 text-center">Aucun candidat dans cette catégorie</p>
          ) : (
            candidats.map((c) => (
              <CandidatItem
                key={c.id}
                candidat={c}
                status={statusKey}
                onSelect={handleSelect}
                planification={planificationDetails[c.id]}
              />
            ))
          )}
        </div>
      </div>
    )
  }

  const CandidatItem = ({
    candidat,
    status,
    onSelect,
    planification,
  }: {
    candidat: CandidatMini
    status: keyof typeof statusConfig
    onSelect: (id: string) => void
    planification?: any
  }) => {
    const config = statusConfig[status]
    const formatHeure = (heure: string | null | undefined) => (heure ? heure.slice(0, 5) : "")

    return (
      <div
        className={cn("flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer", "hover:bg-muted/50", status === "planifie" ? "cursor-default" : "")}
        onClick={() => status !== "planifie" && onSelect(candidat.id)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">
              {candidat.nom} {candidat.prenom}
            </p>
            <div className="flex items-center gap-1">
  {candidat.vehicule && (
    <span className="p-1 rounded-full bg-muted" title="Véhicule">
      <Car className="w-4 h-4 text-blue-500" />
    </span>
  )}
  {candidat.interditClient && (
    <span className="p-1 rounded-full bg-muted" title="Interdit sur ce client">
      <Icon icon="material-symbols:do-not-disturb-on" className="w-4 h-4 text-red-500" />
    </span>
  )}
  {candidat.prioritaire && (
    <span className="p-1 rounded-full bg-muted" title="Prioritaire">
      <Icon icon="mdi:star" className="w-4 h-4 text-yellow-500" />
    </span>
  )}
  {candidat.dejaPlanifie && (
    <span className="p-1 rounded-full bg-muted" title="Déjà planifié sur ce client">
      <History className="w-4 h-4 text-amber-500" />
    </span>
  )}
  {candidat.dejaTravaille && (
    <span className="p-1 rounded-full bg-muted" title="A déjà travaillé pour ce client">
      <ArrowDownCircle className="w-4 h-4 text-violet-600" />
    </span>
  )}
</div>
</div>


          {status === "planifie" && planification && (
            <div className="text-xs text-muted-foreground mt-1">
              <div className="flex gap-2">
                {planification.heure_debut_matin && (
                  <span>
                    Matin: {formatHeure(planification.heure_debut_matin)}-{formatHeure(planification.heure_fin_matin)}
                  </span>
                )}
                {planification.heure_debut_soir && (
                  <span>
                    Soir: {formatHeure(planification.heure_debut_soir)}-{formatHeure(planification.heure_fin_soir)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {status !== "planifie" && (
          <div className={cn("p-1 rounded-full", config.badgeColor, "hover:bg-[#8ea9db] hover:text-white")}>
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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
  
          <div className="flex gap-4 h-[500px]">
            <StatusColumn statusKey="dispo" candidats={dispos} />
            <StatusColumn statusKey="nonRenseigne" candidats={nonRenseignes} />
            <StatusColumn statusKey="planifie" candidats={planifies} />
          </div>
        </DialogContent>
      </Dialog>
  
      {selectedCandidatId && (
        <PlanificationCoupureDialog
          open={openCoupureDialog}
          onClose={() => {
            setOpenCoupureDialog(false)
            setSelectedCandidatId(null)
          }}
          commande={commande}
          candidatId={selectedCandidatId}
          candidatNomPrenom={
            candidats.find((c) => c.id === selectedCandidatId)?.nom +
            " " +
            candidats.find((c) => c.id === selectedCandidatId)?.prenom
          }
          onSuccess={() => {
            onSuccess()
            setOpenCoupureDialog(false)
            onClose()
          }}
        />
      )}
    </>
  )  
}