import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useClientsBySecteur } from "@/hooks/useClientsBySecteur"
import { usePostesTypesByClient } from "@/hooks/usePostesTypesByClient"
import { useEffect, useState } from "react"
import {
  format,
  addWeeks,
  startOfWeek,
  addDays,
  getISOWeek,
  getISOWeekYear,
} from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import CommandeFormGauche from "./CommandeFormGauche"
import CommandeFormDroite from "./CommandeFormDroite"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export default function NouvelleCommandeDialog({
  open,
  onOpenChange,
  onRefreshDone,
  commande,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefreshDone: () => void
  commande?: any
}) {
  const navigate = useNavigate()

  const [secteur, setSecteur] = useState("")
  const [clientId, setClientId] = useState("")
  const [service, setService] = useState("")
  const [semaine, setSemaine] = useState("") // 👈 plus de valeur par défaut
  const [commentaire, setCommentaire] = useState("")
  const [complementMotif, setComplementMotif] = useState("")
  const [motif, setMotif] = useState("Extra Usage constant")
  const [joursState, setJoursState] = useState<Record<string, boolean>>({})
  const [heuresParJour, setHeuresParJour] = useState<Record<string, any>>({})
  const [posteTypeId, setPosteTypeId] = useState("")
  const [plannedByDay, setPlannedByDay] = useState<Record<string, string[]>>({})

  const [semainesDisponibles, setSemainesDisponibles] = useState<
    { value: string; label: string; startDate: Date }[]
  >([])

  // Quand on change de semaine
  useEffect(() => {
    const semaineObj = semainesDisponibles.find((s) => s.value === semaine)
    if (!semaineObj) return

    const newJoursState: Record<string, boolean> = {}
    for (let i = 0; i < 7; i++) {
      const dayKey = format(addDays(semaineObj.startDate, i), "yyyy-MM-dd")
      newJoursState[dayKey] = false
    }
    if (!commande) {
      setJoursState(newJoursState)
      setHeuresParJour({})
      setPlannedByDay({})
    }
  }, [semaine, semainesDisponibles, commande])

  const { clients } = useClientsBySecteur(secteur)
  const selectedClient = clients.find((c) => c.id === clientId)
  const services = selectedClient?.services || []

  const { postesTypes } = usePostesTypesByClient(clientId, secteur)
  const selectedPosteType = postesTypes.find((pt) => pt.id === posteTypeId)

  const semaineObj = semainesDisponibles.find((s) => s.value === semaine)
  const joursSemaine = semaineObj
    ? Array.from({ length: 7 }, (_, i) => {
        const date = addDays(semaineObj.startDate, i)
        return {
          jour: format(date, "EEEE dd MMMM", { locale: fr }),
          key: format(date, "yyyy-MM-dd"),
        }
      })
    : []

  // Construction de la liste des semaines (cohérente + pas de 53)
  useEffect(() => {
    const semaines: { value: string; label: string; startDate: Date }[] = []
    const today = new Date()
    const start = addWeeks(today, -6)
    const end = addWeeks(today, 16)
    let current = startOfWeek(start, { weekStartsOn: 1 })

    while (current <= end) {
      const { week, year, value } = getWeekMeta(current)

      const weekStart = format(current, "dd MMM", { locale: fr })
      const weekEnd = format(addDays(current, 6), "dd MMM", { locale: fr })

      semaines.push({
        value,
        label: `Semaine ${String(week).padStart(2, "0")} - ${weekStart} au ${weekEnd}`,
        startDate: current,
      })

      current = addWeeks(current, 1)
    }

    setSemainesDisponibles(semaines)
    setSemaine("") // l'user choisit
  }, [])

  // Reset / pré-remplissage à l'ouverture
  useEffect(() => {
    if (!open) return

    // MODE CREATION
    if (!commande) {
      setSecteur("")
      setClientId("")
      setService("")
      setSemaine("")
      setCommentaire("")
      setComplementMotif("")
      setMotif("Extra Usage constant")
      setJoursState({})
      setHeuresParJour({})
      setPosteTypeId("")
      setPlannedByDay({})
      return
    }

    // MODE EDITION
    const run = async () => {
      const dateCmd = new Date(commande.date)
      const monday = startOfWeek(dateCmd, { weekStartsOn: 1 })

      const { value: weekValue } = getWeekMeta(dateCmd)

      setSecteur(commande.secteur || "")
      setClientId(commande.client_id || "")
      setService(commande.service || "")
      setSemaine(weekValue)
      setCommentaire(commande.commentaire || "")
      setComplementMotif(commande.complement_motif || "")
      setMotif(commande.motif_contrat || "Extra Usage constant")
      setJoursState({ [commande.date]: true })
      setHeuresParJour({
        [commande.date]: {
          debutMatin: commande.heure_debut_matin || "",
          finMatin: commande.heure_fin_matin || "",
          debutSoir: commande.heure_debut_soir || "",
          finSoir: commande.heure_fin_soir || "",
          nbPersonnes: 1,
        },
      })
      setPosteTypeId("")
      setPlannedByDay({ [commande.date]: [""] })

      const fullWeek: Record<string, boolean> = {}
      for (let i = 0; i < 7; i++) {
        const key = format(addDays(monday, i), "yyyy-MM-dd")
        fullWeek[key] = false
      }

      const weekStart = format(monday, "yyyy-MM-dd")
      const weekEnd = format(addDays(monday, 6), "yyyy-MM-dd")

      let q = supabase
        .from("commandes")
        .select(
          "date, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir, mission_slot, service"
        )
        .eq("client_id", commande.client_id)
        .eq("secteur", commande.secteur)
        .eq("mission_slot", commande.mission_slot ?? 0)
        .gte("date", weekStart)
        .lte("date", weekEnd)

      if (commande.service) q = q.eq("service", commande.service)
      else q = q.is("service", null)

      const { data, error } = await q
      if (error) {
        const key = format(dateCmd, "yyyy-MM-dd")
        setJoursState({ ...fullWeek, [key]: true })
        setHeuresParJour({
          [key]: {
            debutMatin: (commande.heure_debut_matin || "").slice(0, 5),
            finMatin: (commande.heure_fin_matin || "").slice(0, 5),
            debutSoir: (commande.heure_debut_soir || "").slice(0, 5),
            finSoir: (commande.heure_fin_soir || "").slice(0, 5),
            nbPersonnes: 1,
          },
        })
        setPlannedByDay({ [key]: [""] })
        return
      }

      const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "")
      const heures: Record<string, any> = {}

      ;(data || []).forEach((cmd) => {
        const key = format(new Date(cmd.date), "yyyy-MM-dd")
        fullWeek[key] = true
        heures[key] = {
          debutMatin: hhmm(cmd.heure_debut_matin),
          finMatin: hhmm(cmd.heure_fin_matin),
          debutSoir: hhmm(cmd.heure_debut_soir),
          finSoir: hhmm(cmd.heure_fin_soir),
          nbPersonnes: 1,
        }
      })

      if ((data || []).length === 0) {
        const key = format(dateCmd, "yyyy-MM-dd")
        fullWeek[key] = true
        heures[key] = {
          debutMatin: hhmm(commande.heure_debut_matin),
          finMatin: hhmm(commande.heure_fin_matin),
          debutSoir: hhmm(commande.heure_debut_soir),
          finSoir: hhmm(commande.heure_fin_soir),
          nbPersonnes: 1,
        }
      }

      setJoursState(fullWeek)
      setHeuresParJour(heures)
      setPlannedByDay(
        Object.fromEntries(Object.keys(fullWeek).map((k) => [k, [""]]))
      )
    }
    run()
  }, [open, commande])

  useEffect(() => {
    if (motif === "Extra Usage constant" && complementMotif !== "") {
      setComplementMotif("")
    }
  }, [motif, complementMotif])

  const handleSave = async () => {
    if (!clientId || !secteur || !semaine) return

    const { data: authData } = await supabase.auth.getUser()
    const userEmail = authData?.user?.email || null
    if (!userEmail) return

    const { data: userApp, error: userError } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("email", userEmail)
      .single()

    if (userError || !userApp?.id) return
    const userId = userApp.id

    // ----- ÉDITION -----
    if (commande) {
      const datesToUpdate = Object.keys(joursState).filter((d) => !!joursState[d])
      if (datesToUpdate.length === 0) {
        toast.error("Aucune journée à mettre à jour")
        return
      }

      let q = supabase
        .from("commandes")
        .update({
          service: service || null,
          motif_contrat: motif,
          complement_motif:
            motif === "Extra Usage constant" ? null : complementMotif || null,
          commentaire: commentaire || null,
        })
        .eq("client_id", clientId)
        .eq("secteur", secteur)
        .eq("mission_slot", commande.mission_slot ?? 0)
        .in("date", datesToUpdate)

      if (commande.service) q = q.eq("service", commande.service)
      else q = q.is("service", null)

      const { data: updatedRows, error: updErr } = await q.select("id, date")
      if (updErr) {
        toast.error("Échec de la mise à jour")
        return
      }

      if (updatedRows && updatedRows.length > 0) {
        const historique = updatedRows.map((row) => ({
          table_cible: "commandes",
          action: "modification",
          ligne_id: row.id,
          user_id: userId,
          date_action: new Date().toISOString(),
          description: "Modification service/motif via édition de commande",
          apres: {
            service: service || null,
            motif_contrat: motif,
            complement_motif:
              motif === "Extra Usage constant"
                ? null
                : complementMotif || null,
            commentaire: commentaire || null,
            date: row.date,
          },
        }))
        await supabase.from("historique").insert(historique)
      }

      onRefreshDone?.()
      toast.success("Commande mise à jour")
      onOpenChange(false)
      return
    }

    // ----- CRÉATION -----
    const lignes: any[] = []
    const joursCommandes = Object.entries(joursState).filter(
      ([_, active]) => active
    )
    const datesCommandes = joursCommandes.map(([date]) => date)

    const { data: commandesExistantesAll } = await supabase
      .from("commandes")
      .select("mission_slot")
      .eq("client_id", clientId)
      .eq("secteur", secteur)
      .in("date", datesCommandes)

    const existingSlots = (commandesExistantesAll || []).map(
      (c) => c.mission_slot ?? 0
    )
    const baseSlot = existingSlots.length > 0 ? Math.max(...existingSlots) + 1 : 1

    for (const [key] of joursCommandes) {
      const heure = heuresParJour[key] || {}
      const nb = heure.nbPersonnes || 1
      for (let i = 0; i < nb; i++) {
        lignes.push({
          client_id: clientId,
          secteur,
          service: service || null,
          date: key,
          statut: "En recherche",
          heure_debut_matin: heure.debutMatin || null,
          heure_fin_matin: heure.finMatin || null,
          heure_debut_soir: heure.debutSoir || null,
          heure_fin_soir: heure.finSoir || null,
          motif_contrat: motif,
          complement_motif:
            motif === "Extra Usage constant"
              ? null
              : complementMotif || null,
          commentaire: commentaire || null,
          created_by: userId,
          mission_slot: baseSlot + i,
        })
      }
    }

    if (lignes.length === 0) return

    const { data, error } = await supabase
      .from("commandes")
      .insert(lignes)
      .select(
        "id, date, mission_slot, secteur, service, client_id, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir"
      )

    if (error) {
      toast.error("Échec création commandes")
      return
    }

    // 🔴 HISTO avec noms candidats
    const uniqueCandIds = Array.from(
      new Set(
        Object.values(plannedByDay)
          .flat()
          .filter(Boolean)
      )
    ) as string[]

    const candidatNames = new Map<string, { nom: string; prenom: string }>()
    if (uniqueCandIds.length > 0) {
      const { data: candRows } = await supabase
        .from("candidats")
        .select("id, nom, prenom")
        .in("id", uniqueCandIds)
      ;(candRows || []).forEach((r: any) => {
        candidatNames.set(r.id, { nom: r.nom || "", prenom: r.prenom || "" })
      })
    }

    // Pré-planif post-insert
    try {
      const byDateSlot = new Map<string, any>()
      for (const row of data || []) {
        byDateSlot.set(`${row.date}|${row.mission_slot}`, row)
      }

      const planifRows: any[] = []
      const updates: Array<{ id: string; candidat_id: string }> = []
      const histPlanif: any[] = []

      for (const [dateStr, ids] of Object.entries(plannedByDay)) {
        if (!joursState[dateStr]) continue
        const heure = heuresParJour[dateStr] || {}
        const nb = heure.nbPersonnes || 1
        for (let i = 0; i < nb; i++) {
          const candId = ids?.[i]
          if (!candId) continue
          const cmd = byDateSlot.get(`${dateStr}|${baseSlot + i}`)
          if (!cmd) continue

          planifRows.push({
            commande_id: cmd.id,
            candidat_id: candId,
            date: dateStr,
            secteur,
            statut: "Validé",
            heure_debut_matin: cmd.heure_debut_matin,
            heure_fin_matin: cmd.heure_fin_matin,
            heure_debut_soir: cmd.heure_debut_soir,
            heure_fin_soir: cmd.heure_fin_soir,
          })

          updates.push({ id: cmd.id, candidat_id: candId })

          const nomPrenom = candidatNames.get(candId) || { nom: "", prenom: "" }
          histPlanif.push({
            table_cible: "commandes",
            ligne_id: cmd.id,
            action: "planification",
            description: "Planification via création de commande (pré-sélection)",
            user_id: userId,
            date_action: new Date().toISOString(),
            apres: {
              date: dateStr,
              candidat: { nom: nomPrenom.nom, prenom: nomPrenom.prenom },
              heure_debut_matin: cmd.heure_debut_matin,
              heure_fin_matin: cmd.heure_fin_matin,
              heure_debut_soir: cmd.heure_debut_soir,
              heure_fin_soir: cmd.heure_fin_soir,
            },
          })
        }
      }

      if (planifRows.length > 0) {
        const { error: perr } = await supabase.from("planification").insert(planifRows)
        if (!perr) {
          await Promise.all(
            updates.map((u) =>
              supabase
                .from("commandes")
                .update({ candidat_id: u.candidat_id, statut: "Validé" })
                .eq("id", u.id)
            )
          )
          if (histPlanif.length > 0) {
            await supabase.from("historique").insert(histPlanif)
          }

          try {
            window.dispatchEvent(new CustomEvent("planif:updated"))
            window.dispatchEvent(new CustomEvent("adaptel:refresh-planning-client"))
            window.dispatchEvent(new CustomEvent("adaptel:refresh-commandes"))
          } catch {}
        }
      }
    } catch (e) {
      console.error("Pré-planif post-insert :", e)
    }

    onRefreshDone?.()
    toast.success("Commandes créées")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle commande</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <CommandeFormGauche
            secteur={secteur}
            setSecteur={setSecteur}
            clientId={clientId}
            setClientId={setClientId}
            service={service}
            setService={setService}
            semaine={semaine}
            setSemaine={setSemaine}
            motif={motif}
            setMotif={setMotif}
            commentaire={commentaire}
            setCommentaire={setCommentaire}
            complementMotif={complementMotif}
            setComplementMotif={setComplementMotif}
            clients={clients}
            services={services}
            semainesDisponibles={semainesDisponibles}
            posteTypeId={posteTypeId}
            setPosteTypeId={setPosteTypeId}
            postesTypes={postesTypes}
            setHeuresParJour={setHeuresParJour}
            setJoursState={setJoursState}
          />

          <div className={commande ? "relative opacity-60" : ""}>
            {commande && (
              <div
                className="absolute inset-0 z-[5] pointer-events-auto"
                aria-hidden="true"
              />
            )}
            <CommandeFormDroite
              joursSemaine={joursSemaine}
              joursState={joursState}
              setJoursState={setJoursState}
              heuresParJour={heuresParJour}
              setHeuresParJour={setHeuresParJour}
              selectedPosteType={selectedPosteType}
              secteur={secteur}
              handleSave={handleSave}
              clientId={clientId}
              plannedByDay={plannedByDay}
              setPlannedByDay={setPlannedByDay}
            />
          </div>
        </div>

        {commande && (
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave}>Valider</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Cohérence app : ISO week + normalisation "pas de 53".
 * Si une date tombe en ISO week 53, on force semaine 01 de l'année suivante.
 */
function getWeekMeta(date: Date) {
  let week = getISOWeek(date)
  let year = getISOWeekYear(date)

  if (week === 53) {
    week = 1
    year = year + 1
  }

  const value = `${year}-W${String(week).padStart(2, "0")}`
  return { week, year, value }
}
