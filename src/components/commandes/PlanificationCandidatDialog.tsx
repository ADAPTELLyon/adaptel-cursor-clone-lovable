import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "@/hooks/use-toast"
import type { CommandeWithCandidat } from "@/types/types-front"
import { CheckCircle2, Clock, AlertCircle, Car, History, ChevronRight, ArrowDownCircle } from "lucide-react"
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

function normalizeStatut(s?: string | null) {
  if (!s) return ""
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
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

      // Interdictions / priorités
      const { data: ipData } = await supabase
        .from("interdictions_priorites")
        .select("candidat_id, type")
        .eq("client_id", commande.client_id)

      const interditSet = new Set(ipData?.filter((i) => i.type === "interdiction").map((i) => i.candidat_id))
      const prioritaireSet = new Set(ipData?.filter((i) => i.type === "priorite").map((i) => i.candidat_id))

      // Déjà travaillé
      const { data: dejaData } = await supabase
        .from("commandes")
        .select("candidat_id")
        .eq("client_id", commande.client_id)

      const dejaTravailleSet = new Set((dejaData || []).map((c) => c.candidat_id).filter(Boolean))

      const candidatIds = candidats.map((c) => c.id)

      // Disponibilités (avec flags par créneau)
      const { data: dispoData } = await supabase
        .from("disponibilites")
        .select("candidat_id, statut, dispo_matin, dispo_soir")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", candidatIds)

      type DispoRow = { candidat_id: string; statut: string | null; dispo_matin: boolean | null; dispo_soir: boolean | null }
      const dispoMap = new Map<string, DispoRow>()
      ;(dispoData || []).forEach((d: any) => dispoMap.set(d.candidat_id, d as DispoRow))

      // Occupations via COMMANDES — Validé uniquement
      const { data: cmdData } = await supabase
        .from("commandes")
        .select("candidat_id, statut, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", candidatIds)
        .in("statut", ["Validé"])

      // Détails pour affichage (heures)
      const occMap = new Map<string, { matin: boolean; soir: boolean }>()
      const detailsMap: Record<string, any> = {}

      const touch = (id: string, which: "matin" | "soir", hd?: string | null, hf?: string | null) => {
        const prev = occMap.get(id) || { matin: false, soir: false }
        prev[which] = true
        occMap.set(id, prev)
        const d = detailsMap[id] || {}
        if (which === "matin") {
          if (!d.heure_debut_matin) {
            d.heure_debut_matin = hd || null
            d.heure_fin_matin = hf || null
          }
        } else {
          if (!d.heure_debut_soir) {
            d.heure_debut_soir = hd || null
            d.heure_fin_soir = hf || null
          }
        }
        detailsMap[id] = d
      }

      ;(cmdData || []).forEach((c: any) => {
        if (c.heure_debut_matin && c.heure_fin_matin) touch(c.candidat_id, "matin", c.heure_debut_matin, c.heure_fin_matin)
        if (c.heure_debut_soir && c.heure_fin_soir) touch(c.candidat_id, "soir", c.heure_debut_soir, c.heure_fin_soir)
      })
      setPlanificationDetails(detailsMap)

      const isCoupure = !!(commande.heure_debut_matin && commande.heure_fin_matin && commande.heure_debut_soir && commande.heure_fin_soir)
      const chercheMatin = !!commande.heure_debut_matin && !!commande.heure_fin_matin && !commande.heure_debut_soir
      const chercheSoir = !!commande.heure_debut_soir && !!commande.heure_fin_soir && !commande.heure_debut_matin

      const dispoList: CandidatMini[] = []
      const planifieList: CandidatMini[] = []
      const nonList: CandidatMini[] = []

      for (const c of candidats) {
        const occ = occMap.get(c.id) || { matin: false, soir: false }
        const dispoRow = dispoMap.get(c.id)
        const statutNorm = normalizeStatut(dispoRow?.statut)

        // Exclure seulement "Non Dispo"
        if (statutNorm === "non dispo") continue

        // Respect flags créneau si présents
        if (chercheMatin && dispoRow && dispoRow.dispo_matin === false) continue
        if (chercheSoir && dispoRow && dispoRow.dispo_soir === false) continue
        if (isCoupure && dispoRow && dispoRow.dispo_matin === false && dispoRow.dispo_soir === false) continue

        // Conflits par besoin (basés uniquement sur COMMANDES Validé)
        if (isCoupure) {
          if (occ.matin && occ.soir) continue
        } else if (chercheMatin) {
          if (occ.matin) continue
        } else if (chercheSoir) {
          if (occ.soir) continue
        }

        const mini: CandidatMini = {
          id: c.id,
          nom: c.nom,
          prenom: c.prenom,
          vehicule: c.vehicule,
          interditClient: interditSet.has(c.id),
          prioritaire: prioritaireSet.has(c.id),
          dejaPlanifie: (occ.matin || occ.soir),
          dejaTravaille: dejaTravailleSet.has(c.id),
        }

        if (occ.matin || occ.soir) planifieList.push(mini)
        else if (statutNorm === "dispo") dispoList.push(mini)
        else nonList.push(mini) // "non renseigné" ou pas de ligne
      }

      setDispos(dispoList)
      setPlanifies(planifieList)
      setNonRenseignes(nonList)
    }

    fetchDispoEtPlanif()
  }, [open, date, secteur, candidats, commande.client_id])

  const handleSelect = async (candidatId: string) => {
    const jour = date.slice(0, 10)
    const candidat = candidats.find((c) => c.id === candidatId)

    const aMatin = !!(commande.heure_debut_matin && commande.heure_fin_matin)
    const aSoir = !!(commande.heure_debut_soir && commande.heure_fin_soir)

    // Conflit via COMMANDES (Validé)
    const { data: existingCmds } = await supabase
      .from("commandes")
      .select("heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
      .eq("candidat_id", candidatId)
      .eq("date", jour)
      .eq("secteur", secteur)
      .eq("statut", "Validé")

    const occMatin = existingCmds?.some(p => p.heure_debut_matin && p.heure_fin_matin) ?? false
    const occSoir  = existingCmds?.some(p => p.heure_debut_soir && p.heure_fin_soir) ?? false

    const conflitMatin = aMatin && occMatin
    const conflitSoir  = aSoir && occSoir

    if (aMatin && aSoir) {
      setSelectedCandidatId(candidatId)
      setOpenCoupureDialog(true)
      return
    }

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
      date: jour,
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
            date: jour,
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
    onSuccess?.()
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
    const formatHeure = (h?: string | null) => (h ? h.slice(0, 5) : "")

    return (
      <div
        className={cn(
          "flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer",
          "hover:bg-muted/50",
          status === "planifie" ? "cursor-default" : ""
        )}
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
                <span className="p-1 rounded-full bg-muted" title="Déjà planifié sur ce jour">
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
              {format(new Date(date), "eeee d MMMM", { locale: fr })}
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
            (candidats.find((c) => c.id === selectedCandidatId)?.nom || "") +
            " " +
            (candidats.find((c) => c.id === selectedCandidatId)?.prenom || "")
          }
          onSuccess={() => {
            setOpenCoupureDialog(false)
            setSelectedCandidatId(null)
            onSuccess?.()
            onClose()
          }}
        />
      )}
    </>
  )
}
