import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "@/hooks/use-toast"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"

type Props = {
  open: boolean
  onClose: () => void
  clientId: string
  secteurs: string[]
  services: string[]
  type: "priorite" | "interdiction"
  onSaved: () => void
}

export function AjoutSuiviCandidatDialog({
  open,
  onClose,
  clientId,
  secteurs,
  services,
  type,
  onSaved,
}: Props) {
  const { user } = useAuth()
  const [secteur, setSecteur] = useState("")
  const [service, setService] = useState("")
  const [candidatId, setCandidatId] = useState("")
  const [commentaire, setCommentaire] = useState("")
  const [createdBy, setCreatedBy] = useState<string | null>(null)

  const { data: candidats = [], isLoading, refetch } = useCandidatsBySecteur(secteur)

  // Auto-assign secteur si un seul
  useEffect(() => {
    if (secteurs.length === 1) setSecteur(secteurs[0])
  }, [secteurs])

  // Récupération ID utilisateur
  useEffect(() => {
    const fetchCreatedBy = async () => {
      if (!user?.email) return
      const { data, error } = await supabase
        .from("utilisateurs")
        .select("id")
        .eq("email", user.email)
        .single()

      if (!error && data?.id) setCreatedBy(data.id)
    }

    fetchCreatedBy()
  }, [user?.email])

  const handleSave = async () => {
    if (!secteur || !candidatId || !createdBy) {
      toast({ title: "Erreur", description: "Champs obligatoires manquants", variant: "destructive" })
      return
    }

    // Vérifier si ce candidat a déjà un statut sur ce client
    const { data: existants, error: checkError } = await supabase
      .from("interdictions_priorites")
      .select("id, type")
      .eq("client_id", clientId)
      .eq("candidat_id", candidatId)
      .eq("actif", true)

    if (checkError) {
      toast({ title: "Erreur", description: "Erreur de vérification", variant: "destructive" })
      return
    }

    const dejaPrioritaire = existants?.some((e) => e.type === "priorite")
    const dejaInterdit = existants?.some((e) => e.type === "interdiction")

    if (type === "priorite" && dejaPrioritaire) {
      toast({ title: "Erreur", description: "Ce candidat est déjà prioritaire pour ce client." })
      return
    }

    if (type === "interdiction" && dejaInterdit) {
      toast({ title: "Erreur", description: "Ce candidat est déjà interdit pour ce client." })
      return
    }

    if ((type === "priorite" && dejaInterdit) || (type === "interdiction" && dejaPrioritaire)) {
      toast({
        title: "Incohérence",
        description: `Ce candidat est déjà ${type === "priorite" ? "interdit" : "prioritaire"} pour ce client. Supprimez ce statut avant de le modifier.`,
        variant: "destructive",
      })
      return
    }

    const payload = {
      client_id: clientId,
      candidat_id: candidatId,
      secteur,
      service: service || null,
      type,
      commentaire: commentaire || null,
      created_by: createdBy,
      actif: true,
    }

    const { error: insertError } = await supabase
      .from("interdictions_priorites")
      .insert(payload)

    if (insertError) {
      toast({ title: "Erreur", description: `Échec de l’enregistrement : ${insertError.message}`, variant: "destructive" })
      return
    }

    toast({ title: "Ajout réussi" })
    onSaved()
    onClose()
    setSecteur("")
    setService("")
    setCandidatId("")
    setCommentaire("")
  }

  const titre = type === "priorite" ? "Ajouter une priorité" : "Ajouter une interdiction"

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {secteurs.length > 1 && (
            <div>
              <Label>Secteur *</Label>
              <Select value={secteur} onValueChange={(val) => {
                setSecteur(val)
                setCandidatId("")
                refetch()
              }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un secteur" /></SelectTrigger>
                <SelectContent>
                  {secteurs.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {services.length > 0 && (
            <div>
              <Label>Service (facultatif)</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un service" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Candidat *</Label>
            <Select value={candidatId} onValueChange={setCandidatId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Chargement..." : "Sélectionner un candidat"} />
              </SelectTrigger>
              <SelectContent>
                {candidats.length === 0 ? (
                  <div className="text-sm px-3 py-2 italic text-muted-foreground">Aucun candidat pour ce secteur</div>
                ) : (
                  candidats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom} {c.prenom}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Commentaire (facultatif)</Label>
            <Textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave}>Ajouter</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
