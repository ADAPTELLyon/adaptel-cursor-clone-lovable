import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useClientsBySecteur } from "@/hooks/useClientsBySecteur"
import { usePostesTypesByClient } from "@/hooks/usePostesTypesByClient"
import { useEffect, useState } from "react"
import { format, addWeeks, startOfWeek, addDays } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import CommandeFormGauche from "./CommandeFormGauche"
import CommandeFormDroite from "./CommandeFormDroite"
import type { PosteType } from "@/types/types-front"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

export default function NouvelleCommandeDialog({
  open,
  onOpenChange,
  onRefreshDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefreshDone: () => void;
}) {
  const navigate = useNavigate()

  const [secteur, setSecteur] = useState("")
  const [clientId, setClientId] = useState("")
  const [service, setService] = useState("")
  const [semaine, setSemaine] = useState("")
  const [commentaire, setCommentaire] = useState("")
  const [motif, setMotif] = useState("Extra Usage constant")
  const [joursState, setJoursState] = useState<Record<string, boolean>>({})
  const [heuresParJour, setHeuresParJour] = useState<Record<string, any>>({})
  const [posteTypeId, setPosteTypeId] = useState("")
  const [semainesDisponibles, setSemainesDisponibles] = useState<
    { value: string; label: string; startDate: Date }[]
  >([])

  useEffect(() => {
    const semaineObj = semainesDisponibles.find(s => s.value === semaine)
    if (!semaineObj) return

    const newJoursState: Record<string, boolean> = {}
    for (let i = 0; i < 7; i++) {
      const dayKey = format(addDays(semaineObj.startDate, i), "yyyy-MM-dd")
      newJoursState[dayKey] = false
    }
    setJoursState(newJoursState)
    setHeuresParJour({})
  }, [semaine, semainesDisponibles])

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

  useEffect(() => {
    const semaines: any[] = []
    const today = new Date()
    const start = addWeeks(today, -6)
    const end = addWeeks(today, 16)
    let current = startOfWeek(start, { weekStartsOn: 1 })

    while (current <= end) {
      const weekNumber = getWeekNumber(current)
      const weekStart = format(current, "dd MMM", { locale: fr })
      const weekEnd = format(addDays(current, 6), "dd MMM", { locale: fr })
      semaines.push({
        value: weekNumber.toString(),
        label: `Semaine ${weekNumber} - ${weekStart} au ${weekEnd}`,
        startDate: current,
      })
      current = addWeeks(current, 1)
    }

    setSemainesDisponibles(semaines)
    setSemaine(getWeekNumber(new Date()).toString())
  }, [])

  useEffect(() => {
    if (open) {
      setSecteur("")
      setClientId("")
      setService("")
      setSemaine(getWeekNumber(new Date()).toString())
      setCommentaire("")
      setMotif("Extra Usage constant")
      setJoursState({})
      setHeuresParJour({})
      setPosteTypeId("")
    }
  }, [open])

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

    if (userError || !userApp?.id) {
      console.error("\u274C Utilisateur non trouv\u00e9 dans table `utilisateurs` :", userError)
      return
    }

    const userId = userApp.id
    const lignes: any[] = []

    const joursCommandes = Object.entries(joursState).filter(([_, active]) => active)
    const datesCommandes = joursCommandes.map(([date]) => date)

    const { data: commandesExistantesAll } = await supabase
      .from("commandes")
      .select("mission_slot")
      .eq("client_id", clientId)
      .eq("secteur", secteur)
      .in("date", datesCommandes)

    const existingSlots = (commandesExistantesAll || []).map((c) => c.mission_slot ?? 0)
    let baseSlot = existingSlots.length > 0 ? Math.max(...existingSlots) + 1 : 1

    for (const [key, isActive] of joursCommandes) {
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
          complement_motif: motif === "Extra Usage constant" ? null : commentaire || null,
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
      .select("id, date, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")

    if (error) {
      console.error("\u274C Erreur insertion commandes :", error)
      return
    }

    if (data && data.length > 0) {
      const historique = data.map((cmd) => ({
        table_cible: "commandes",
        action: "creation",
        ligne_id: cmd.id,
        user_id: userId,
        date_action: new Date().toISOString(),
        description: "Cr\u00e9ation de commande via NouvelleCommandeDialog",
        apres: {
          date: cmd.date,
          heure_debut_matin: cmd.heure_debut_matin,
          heure_fin_matin: cmd.heure_fin_matin,
          heure_debut_soir: cmd.heure_debut_soir,
          heure_fin_soir: cmd.heure_fin_soir,
        },
      }))

      const { error: histError } = await supabase.from("historique").insert(historique)
      if (histError) {
        console.error("\u274C Erreur insertion historique :", histError)
      }
    }

    if (onRefreshDone) {
      await onRefreshDone()
    }
    toast.success("Commandes cr\u00e9\u00e9es")
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
            clients={clients}
            services={services}
            semainesDisponibles={semainesDisponibles}
            posteTypeId={posteTypeId}
            setPosteTypeId={setPosteTypeId}
            postesTypes={postesTypes}
            setHeuresParJour={setHeuresParJour}
            setJoursState={setJoursState}
          />
          <CommandeFormDroite
            joursSemaine={joursSemaine}
            joursState={joursState}
            setJoursState={setJoursState}
            heuresParJour={heuresParJour}
            setHeuresParJour={setHeuresParJour}
            selectedPosteType={selectedPosteType}
            secteur={secteur}
            handleSave={handleSave}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getWeekNumber(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1)
  const diff =
    (+date -
      +start +
      (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000) /
    86400000
  return Math.floor((diff + start.getDay() + 6) / 7)
}