/* @refresh skip */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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

const DEBUG = true
const log = (...a: any[]) => DEBUG && console.log("[PCD]", ...a)

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

/* ------------- Item (mémo) ------------- */
const CandidatItem = memo(function CandidatItem({
  candidat,
  status,
  onSelect,
  planification,
}: {
  candidat: CandidatMini
  status: keyof typeof statusConfig
  onSelect: (id: string) => void
  planification?: any
}) {
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
                <Car className="w-4 h-4" />
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
})

/* ------------- Colonne (mémo) ------------- */
const StatusColumn = memo(function StatusColumn({
  statusKey,
  candidats,
  onSelect,
  planificationDetails,
}: {
  statusKey: keyof typeof statusConfig
  candidats: CandidatMini[]
  onSelect: (id: string) => void
  planificationDetails: Record<string, any>
}) {
  const config = statusConfig[statusKey]
  return (
    <div
      className={cn(
        "flex-1 rounded-lg border overflow-hidden",
        config.borderColor,
        "border-2 flex flex-col h-full min-h-0"
      )}
    >
      <div className={cn("w-full flex items-center justify-between p-3", config.color, "bg-opacity-20")}>
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-full", config.badgeColor)}>{config.icon}</div>
          <h3 className="font-medium">
            {config.title} <span className="text-muted-foreground">({candidats.length})</span>
          </h3>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1"
        onScroll={(e) => {
          if (!DEBUG) return
          const st = (e.currentTarget as HTMLDivElement).scrollTop
          if (st % 120 < 1) log(`scroll ${statusKey}`, Math.round(st))
        }}
      >
        {candidats.length === 0 ? (
          <p className="text-sm text-muted-foreground italic p-3 text-center">Aucun candidat dans cette catégorie</p>
        ) : (
          candidats.map((c) => (
            <CandidatItem
              key={c.id}
              candidat={c}
              status={statusKey}
              onSelect={onSelect}
              planification={planificationDetails[c.id]}
            />
          ))
        )}
      </div>
    </div>
  )
})

/* ------------- Modale (mémo) ------------- */
function PlanificationCandidatDialogInner({
  open,
  onClose,
  date,
  secteur,
  service,
  commande,
  onSuccess,
}: PlanificationCandidatDialogProps) {
  if (!open) return null // ⛔ pas monté si fermé → pas d’effets ni reflow

  const { data: candidats = [] } = useCandidatsBySecteur(secteur)

  const [dispos, setDispos] = useState<CandidatMini[]>([])
  const [nonRenseignes, setNonRenseignes] = useState<CandidatMini[]>([])
  const [planifies, setPlanifies] = useState<CandidatMini[]>([])
  const [planificationDetails, setPlanificationDetails] = useState<Record<string, any>>({})
  const [selectedCandidatId, setSelectedCandidatId] = useState<string | null>(null)
  const [openCoupureDialog, setOpenCoupureDialog] = useState(false)

  // Dédup stricte du fetch
  const candidatIdsKey = useMemo(
    () => (candidats.length ? candidats.map((c) => c.id).sort().join(",") : ""),
    [candidats]
  )
  const lastSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    log("render:", Math.floor(performance.now() / 100)) // repère visuel

    if (!secteur || !date || !candidats.length) return
    const jour = date.slice(0, 10)
    const signature = `${jour}|${secteur}|${commande.id}|${candidatIdsKey}`

    if (lastSignatureRef.current === signature) return
    lastSignatureRef.current = signature

    let isCancelled = false

    ;(async () => {
      log("FETCH start", { signature })

      // Q1 : interdictions / priorités
      const { data: ipData } = await supabase
        .from("interdictions_priorites")
        .select("candidat_id, type")
        .eq("client_id", commande.client_id)
      if (isCancelled) return

      const interditSet = new Set(ipData?.filter((i) => i.type === "interdiction").map((i) => i.candidat_id))
      const prioritaireSet = new Set(ipData?.filter((i) => i.type === "priorite").map((i) => i.candidat_id))

      // Q2 : historique « a déjà travaillé »
      const { data: dejaData } = await supabase
        .from("commandes")
        .select("candidat_id")
        .eq("client_id", commande.client_id)
      if (isCancelled) return

      const dejaTravailleSet = new Set((dejaData || []).map((c) => c.candidat_id).filter(Boolean))

      // Q3 : disponibilités jour
      const { data: dispoData } = await supabase
        .from("disponibilites")
        .select("candidat_id, statut, dispo_matin, dispo_soir")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", candidats.map((c) => c.id))
      if (isCancelled) return

      type DispoRow = { candidat_id: string; statut: string | null; dispo_matin: boolean | null; dispo_soir: boolean | null }
      const dispoMap = new Map<string, DispoRow>()
      ;(dispoData || []).forEach((d: any) => dispoMap.set(d.candidat_id, d as DispoRow))

      // Q4 : occupations « Validé »
      const { data: cmdData } = await supabase
        .from("commandes")
        .select("candidat_id, statut, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", candidats.map((c) => c.id))
        .in("statut", ["Validé"])
      if (isCancelled) return

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

      const isCoupure =
        !!(commande.heure_debut_matin && commande.heure_fin_matin && commande.heure_debut_soir && commande.heure_fin_soir)
      const chercheMatin = !!commande.heure_debut_matin && !!commande.heure_fin_matin && !commande.heure_debut_soir
      const chercheSoir = !!commande.heure_debut_soir && !!commande.heure_fin_soir && !commande.heure_debut_matin

      const dispoList: CandidatMini[] = []
      const planifieList: CandidatMini[] = []
      const nonList: CandidatMini[] = []

      for (const c of candidats) {
        const occ = occMap.get(c.id) || { matin: false, soir: false }
        const dispoRow = dispoMap.get(c.id)
        const statutNorm = normalizeStatut(dispoRow?.statut)

        if (statutNorm === "non dispo") continue
        if (chercheMatin && dispoRow && dispoRow.dispo_matin === false) continue
        if (chercheSoir && dispoRow && dispoRow.dispo_soir === false) continue
        if (isCoupure && dispoRow && dispoRow.dispo_matin === false && dispoRow.dispo_soir === false) continue

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
          dejaPlanifie: occ.matin || occ.soir,
          dejaTravaille: dejaTravailleSet.has(c.id),
        }

        if (occ.matin || occ.soir) planifieList.push(mini)
        else if (statutNorm === "dispo") dispoList.push(mini)
        else nonList.push(mini)
      }

      if (!isCancelled) {
        setDispos(dispoList)
        setPlanifies(planifieList)
        setNonRenseignes(nonList)
        log("FETCH done", { signature, counts: { dispo: dispoList.length, nonRenseigne: nonList.length, planifie: planifieList.length } })
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [secteur, date, commande.id, commande.heure_debut_matin, commande.heure_fin_matin, commande.heure_debut_soir, commande.heure_fin_soir, candidatIdsKey, candidats])

  const handleSelect = useCallback(async (candidatId: string) => {
    const jour = date.slice(0, 10)
    const candidat = candidats.find((c) => c.id === candidatId)

    const aMatin = !!(commande.heure_debut_matin && commande.heure_fin_matin)
    const aSoir = !!(commande.heure_debut_soir && commande.heure_fin_soir)

    const { data: existingCmds } = await supabase
      .from("commandes")
      .select("heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
      .eq("candidat_id", candidatId)
      .eq("date", jour)
      .eq("secteur", secteur)
      .eq("statut", "Validé")

    const occMatin = existingCmds?.some((p) => p.heure_debut_matin && p.heure_fin_matin) ?? false
    const occSoir = existingCmds?.some((p) => p.heure_debut_soir && p.heure_fin_soir) ?? false

    if (aMatin && aSoir) {
      setSelectedCandidatId(candidatId)
      setOpenCoupureDialog(true)
      return
    }
    if ((aMatin && occMatin) || (aSoir && occSoir)) {
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
      .update({ candidat_id: candidatId, statut: "Validé" })
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
            candidat: { nom: candidat.nom, prenom: candidat.prenom },
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
  }, [date, secteur, commande, candidats, onClose, onSuccess])

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        {/* overflow-hidden ici ; le scroll vit à l’intérieur des colonnes */}
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden" aria-describedby="pcd-desc">
          {/* Description vide (sr-only) juste pour éviter l’avertissement Radix, aucun texte ajouté */}
          <DialogDescription id="pcd-desc" className="sr-only" />

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

          {/* Hauteur fixe + min-h-0 → pas de rebond ; 3 zones scrollables internes */}
          <div className="flex gap-4 h-[500px] min-h-0">
            <StatusColumn statusKey="dispo" candidats={dispos} onSelect={handleSelect} planificationDetails={planificationDetails} />
            <StatusColumn statusKey="nonRenseigne" candidats={nonRenseignes} onSelect={handleSelect} planificationDetails={planificationDetails} />
            <StatusColumn statusKey="planifie" candidats={planifies} onSelect={handleSelect} planificationDetails={planificationDetails} />
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

/* ------------- memo export ------------- */
const propsAreEqual = (prev: PlanificationCandidatDialogProps, next: PlanificationCandidatDialogProps) => {
  if (prev.open !== next.open) return false
  if (!next.open) return true // fermée → inutile d’aller plus loin
  return (
    prev.secteur === next.secteur &&
    prev.date === next.date &&
    (prev.service || "") === (next.service || "") &&
    prev.commande.id === next.commande.id &&
    prev.commande.heure_debut_matin === next.commande.heure_debut_matin &&
    prev.commande.heure_fin_matin === next.commande.heure_fin_matin &&
    prev.commande.heure_debut_soir === next.commande.heure_debut_soir &&
    prev.commande.heure_fin_soir === next.commande.heure_fin_soir
  )
}

export const PlanificationCandidatDialog = memo(PlanificationCandidatDialogInner, propsAreEqual)
export default PlanificationCandidatDialog
