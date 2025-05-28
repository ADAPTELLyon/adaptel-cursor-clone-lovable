// src/components/clients/AjoutSuiviCandidatDialog.tsx
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "@/hooks/use-toast"

type Props = {
  open: boolean
  onClose: () => void
  clientId: string
  secteurs: string[]
  services: string[]
  type: "priorite" | "interdiction"
  onSaved: () => void
}

export function AjoutSuiviCandidatDialog({ open, onClose, clientId, secteurs, services, type, onSaved }: Props) {
  const { user } = useAuth()
  const [secteur, setSecteur] = useState("")
  const [service, setService] = useState("")
  const [candidatId, setCandidatId] = useState("")
  const [commentaire, setCommentaire] = useState("")
  const [candidats, setCandidats] = useState<{ id: string; nom: string; prenom: string }[]>([])

  useEffect(() => {
    const fetchCandidats = async () => {
      if (!secteur) return
      const { data, error } = await supabase
        .from("candidats")
        .select("id, nom, prenom")
        .contains("secteurs", [secteur])
        .eq("actif", true)

      if (error) {
        toast({ title: "Erreur", description: "Chargement des candidats échoué", variant: "destructive" })
        return
      }

      setCandidats(data || [])
    }

    fetchCandidats()
  }, [secteur])

  const handleSave = async () => {
    if (!secteur || !candidatId) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires" })
      return
    }

    const { error } = await supabase.from("interdictions_priorites").insert({
      client_id: clientId,
      candidat_id: candidatId,
      secteur,
      service: service || null,
      type,
      commentaire: commentaire || null,
      created_by: user?.id ?? null,
    })

    if (error) {
      toast({ title: "Erreur", description: "Échec de l’enregistrement", variant: "destructive" })
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
              <Select value={secteur} onValueChange={setSecteur}>
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
              <SelectTrigger><SelectValue placeholder="Sélectionner un candidat" /></SelectTrigger>
              <SelectContent>
                {candidats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom} {c.prenom}</SelectItem>
                ))}
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
