import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { format, getWeek, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import { ClipboardList, Clock, MessageCircle } from "lucide-react"

interface Props {
  open: boolean
  onClose: () => void
  date: string
  clientId: string
  secteur: string
  service?: string | null
  missionSlot?: number | null
  onSuccess?: () => void
}

type PosteType = {
  id: string
  nom: string
  heure_debut_matin?: string | null
  heure_fin_matin?: string | null
  heure_debut_soir?: string | null
  heure_fin_soir?: string | null
  poste_base?: {
    nom: string
    secteur: string
  }
}

export function CommandeJourneeDialog({
  open,
  onClose,
  date,
  clientId,
  secteur,
  service,
  missionSlot,
  onSuccess,
}: Props) {
  const [openLocal, setOpenLocal] = useState(open)
  const [heureDebutMatin, setHeureDebutMatin] = useState("")
  const [heureFinMatin, setHeureFinMatin] = useState("")
  const [heureDebutSoir, setHeureDebutSoir] = useState("")
  const [heureFinSoir, setHeureFinSoir] = useState("")
  const [commentaire, setCommentaire] = useState("")
  const [postes, setPostes] = useState<PosteType[]>([])
  const [selectedPosteId, setSelectedPosteId] = useState("")
  const [loading, setLoading] = useState(false)

  const isEtages = secteur === "Étages"

  useEffect(() => {
    setOpenLocal(open)
  }, [open])

  useEffect(() => {
    const fetchPostes = async () => {
      const { data, error } = await supabase
        .from("postes_types_clients")
        .select(`
          id,
          nom,
          heure_debut_matin,
          heure_fin_matin,
          heure_debut_soir,
          heure_fin_soir,
          poste_base:poste_base_id (
            nom,
            secteur
          )
        `)
        .eq("client_id", clientId)

      if (error) {
        console.error("Erreur Supabase :", error)
        return
      }

      const postesFiltres = (data || []).filter(
        (p) => p.poste_base?.secteur === secteur
      )

      setPostes(postesFiltres)
    }

    if (openLocal) {
      fetchPostes()
      setHeureDebutMatin("")
      setHeureFinMatin("")
      setHeureDebutSoir("")
      setHeureFinSoir("")
      setCommentaire("")
      setSelectedPosteId("")
    }
  }, [openLocal, clientId, secteur])

  const handleClose = () => {
    setOpenLocal(false)
    onClose()
  }

  const handleSelectPoste = (posteId: string) => {
    setSelectedPosteId(posteId)
    const poste = postes.find((p) => p.id === posteId)
    if (!poste) return
    setHeureDebutMatin(poste.heure_debut_matin?.slice(0, 5) || "")
    setHeureFinMatin(poste.heure_fin_matin?.slice(0, 5) || "")
    setHeureDebutSoir(poste.heure_debut_soir?.slice(0, 5) || "")
    setHeureFinSoir(poste.heure_fin_soir?.slice(0, 5) || "")
  }

  const formatHeureInput = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 4)
    if (cleaned.length < 3) return cleaned
    return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`
  }

  const handleSubmit = async () => {
    setLoading(true)

    const { data: authData } = await supabase.auth.getUser()
    const userEmail = authData?.user?.email || null

    if (!userEmail) {
      console.error("Email utilisateur non récupéré")
      setLoading(false)
      return
    }

    const { data: userApp } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("email", userEmail)
      .single()

    const userId = userApp?.id || null

    if (!userId) {
      console.error("Utilisateur introuvable dans table utilisateurs")
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("commandes")
      .insert({
        date,
        client_id: clientId,
        secteur,
        service,
        statut: "En recherche",
        heure_debut_matin: heureDebutMatin || null,
        heure_fin_matin: heureFinMatin || null,
        heure_debut_soir: heureDebutSoir || null,
        heure_fin_soir: heureFinSoir || null,
        commentaire: commentaire || null,
        created_by: userId,
        mission_slot: missionSlot ?? 0,
      })
      .select("id, date, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")

    setLoading(false)

    if (!error && data && data.length > 0) {
      const cmd = data[0]

      const historique = {
        table_cible: "commandes",
        ligne_id: cmd.id,
        action: "creation",
        description: "Création de commande journée",
        user_id: userId,
        date_action: new Date().toISOString(),
        apres: {
          date: cmd.date,
          heure_debut_matin: cmd.heure_debut_matin,
          heure_fin_matin: cmd.heure_fin_matin,
          heure_debut_soir: cmd.heure_debut_soir,
          heure_fin_soir: cmd.heure_fin_soir,
        },
      }

      const { error: histError } = await supabase
        .from("historique")
        .insert(historique)

      if (histError) {
        console.error("Erreur enregistrement historique :", histError)
      }

      handleClose()
      if (onSuccess) onSuccess()
    } else {
      console.error("Erreur création commande journée :", error)
    }
  }

  const startOfWeekISO = (dateStr: string) => {
    const d = parseISO(dateStr)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff)).toISOString().slice(0, 10)
  }

  const dateLabel = format(new Date(date), "EEEE d MMMM yyyy", { locale: fr })

  return (
    <Dialog open={openLocal} onOpenChange={(val) => { if (!val) handleClose() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Création commande – {dateLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {postes.length > 0 && (
            <div className="mt-4">
              <Label className="text-sm mb-1 block flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                Poste type
              </Label>
              <Select value={selectedPosteId} onValueChange={handleSelectPoste}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir un poste type" />
                </SelectTrigger>
                <SelectContent>
                  {postes.map((poste) => (
                    <SelectItem key={poste.id} value={poste.id}>
                      {poste.nom} ({poste.poste_base?.nom}) &nbsp;–&nbsp;
                      {poste.heure_debut_matin?.slice(0, 5) || "--:--"} / {poste.heure_fin_matin?.slice(0, 5) || "--:--"}
                      {secteur !== "Étages" && poste.heure_debut_soir ? (
                        <> &nbsp;–&nbsp; {poste.heure_debut_soir?.slice(0, 5)} / {poste.heure_fin_soir?.slice(0, 5)}</>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="mt-4">
            <Label className="block text-sm mb-1 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Créneau matin / midi
            </Label>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="--:--"
                value={heureDebutMatin}
                onChange={(e) => setHeureDebutMatin(formatHeureInput(e.target.value))}
              />
              <Input
                type="text"
                inputMode="numeric"
                placeholder="--:--"
                value={heureFinMatin}
                onChange={(e) => setHeureFinMatin(formatHeureInput(e.target.value))}
              />
            </div>
          </div>

          {!isEtages && (
            <div className="mt-4">
              <Label className="block text-sm mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Créneau soir
              </Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="--:--"
                  value={heureDebutSoir}
                  onChange={(e) => setHeureDebutSoir(formatHeureInput(e.target.value))}
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="--:--"
                  value={heureFinSoir}
                  onChange={(e) => setHeureFinSoir(formatHeureInput(e.target.value))}
                />
              </div>
            </div>
          )}

          <div className="mt-4">
            <Label className="block text-sm mb-1 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
              Commentaire (facultatif)
            </Label>
            <Input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-[#840404] hover:bg-[#750303] text-white"
            >
              Créer la commande
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}