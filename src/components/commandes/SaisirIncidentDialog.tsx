// 📁 src/components/commandes/SaisirIncidentDialog.tsx
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { secteursList } from "@/lib/secteurs"
import { useClientsBySecteur } from "@/hooks/useClientsBySecteur"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"
import { useUser } from "@/lib/useUser"
import { supabase } from "@/lib/supabase"
import { toast } from "@/components/ui/use-toast"

export default function SaisirIncidentDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [secteur, setSecteur] = useState("")
  const [clientId, setClientId] = useState("")
  const [candidatId, setCandidatId] = useState("")
  const [typeIncident, setTypeIncident] = useState("")
  const [description, setDescription] = useState("")
  const [interdiction, setInterdiction] = useState(false)

  const { clients, loading: clientsLoading } = useClientsBySecteur(secteur)
  const { data: candidats = [], isLoading: candidatsLoading } = useCandidatsBySecteur(secteur)
  const { user } = useUser()

  useEffect(() => {
    if (!open) {
      setSecteur("")
      setClientId("")
      setCandidatId("")
      setTypeIncident("")
      setDescription("")
      setInterdiction(false)
    }
  }, [open])

  const handleSave = async () => {
    if (!clientId || !candidatId || !typeIncident || !secteur || !user?.id) {
      toast({ title: "Veuillez remplir tous les champs obligatoires", variant: "destructive" })
      return
    }

    const now = new Date()
    const date_incident = now.toISOString().split("T")[0]
    const heure_incident = now.toTimeString().slice(0, 5)

    const { error: insertError } = await supabase.from("incidents").insert([
      {
        client_id: clientId,
        candidat_id: candidatId,
        type_incident: typeIncident,
        description,
        date_incident,
        heure_incident,
        mise_en_interdiction: interdiction,
        created_by: user.id,
      },
    ])

    if (insertError) {
      toast({ title: "Erreur lors de l'enregistrement", description: insertError.message, variant: "destructive" })
      return
    }

    if (interdiction) {
      const { data: existing, error: fetchError } = await supabase
        .from("interdictions_priorites")
        .select("id")
        .eq("candidat_id", candidatId)
        .eq("client_id", clientId)
        .eq("type", "interdiction")
        .eq("actif", true)

      if (fetchError) {
        toast({ title: "Erreur", description: fetchError.message, variant: "destructive" })
        return
      }

      if (existing.length > 0) {
        toast({
          title: "Déjà interdit",
          description: "Ce candidat a déjà une interdiction active pour ce client.",
          variant: "destructive",
        })
        return
      }

      const { error: interdictionError } = await supabase.from("interdictions_priorites").insert([
        {
          client_id: clientId,
          candidat_id: candidatId,
          secteur,
          service: null,
          type: "interdiction",
          commentaire: description,
          created_by: user.id,
          actif: true,
        },
      ])

      if (interdictionError) {
        toast({ title: "Incident enregistré, mais erreur sur interdiction", description: interdictionError.message, variant: "destructive" })
      }
    }

    toast({ title: "Incident enregistré avec succès" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Saisir un incident</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={secteur} onValueChange={setSecteur}>
            <SelectTrigger>
              <SelectValue placeholder="Secteur concerné" />
            </SelectTrigger>
            <SelectContent>
              {secteursList.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={clientId} onValueChange={setClientId} disabled={!secteur || clientsLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Client concerné" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={candidatId} onValueChange={setCandidatId} disabled={!secteur || candidatsLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Candidat concerné" />
            </SelectTrigger>
            <SelectContent>
              {candidats.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nom} {c.prenom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeIncident} onValueChange={setTypeIncident}>
            <SelectTrigger>
              <SelectValue placeholder="Type d'incident" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Retard">Retard</SelectItem>
              <SelectItem value="Problème tenue">Problème tenue</SelectItem>
              <SelectItem value="Mauvais retour comportement">Mauvais retour comportement</SelectItem>
              <SelectItem value="Mauvais retour travail">Mauvais retour travail</SelectItem>
              <SelectItem value="Autre">Autre</SelectItem>
            </SelectContent>
          </Select>

          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Précisions éventuelles..."
          />

          <div className="flex items-center space-x-2">
            <Checkbox id="interdiction" checked={interdiction} onCheckedChange={(val) => setInterdiction(val === true)} />
            <label htmlFor="interdiction" className="text-sm">
              Ajouter une interdiction pour ce candidat
            </label>
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} className="w-full bg-[#840404] text-white hover:bg-[#750303]">
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
