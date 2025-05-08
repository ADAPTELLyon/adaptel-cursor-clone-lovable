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
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"

interface Props {
  open: boolean
  onClose: () => void
  date: string
  clientId: string
  secteur: string
  service?: string | null
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
    setHeureDebutMatin(poste.heure_debut_matin || "")
    setHeureFinMatin(poste.heure_fin_matin || "")
    setHeureDebutSoir(poste.heure_debut_soir || "")
    setHeureFinSoir(poste.heure_fin_soir || "")
  }

  const formatHeureInput = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 4)
    if (cleaned.length < 3) return cleaned
    return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`
  }

  const handleSubmit = async () => {
    setLoading(true)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    const userId = userData?.user?.id || null
    if (!userId) {
      console.error("Utilisateur non récupéré")
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
      })
      .select("id")

    setLoading(false)

    if (!error && data && data.length > 0) {
      const historique = {
        table_cible: "commandes",
        ligne_id: data[0].id,
        action: "creation",
        description: "Création de commande",
        user_id: userId,
        date_action: new Date().toISOString(),
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

  const dateLabel = format(new Date(date), "EEEE d MMMM yyyy", { locale: fr })

  return (
    <Dialog open={openLocal} onOpenChange={(val) => { if (!val) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Création commande – {dateLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {postes.length > 0 && (
            <div>
              <Label className="text-sm mb-1 block">Poste type</Label>
              <Select value={selectedPosteId} onValueChange={handleSelectPoste}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir un poste type" />
                </SelectTrigger>
                <SelectContent>
                  {postes.map((poste) => (
                    <SelectItem key={poste.id} value={poste.id}>
                      {poste.nom} ({poste.poste_base?.nom})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="block text-sm mb-1">Créneau matin / midi</Label>
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
            <div>
              <Label className="block text-sm mb-1">Créneau soir</Label>
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

          <div>
            <Label className="block text-sm mb-1">Commentaire (facultatif)</Label>
            <Input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          </div>

          <div className="pt-2 flex justify-end">
            <Button onClick={handleSubmit} disabled={loading}>
              Créer la commande
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
