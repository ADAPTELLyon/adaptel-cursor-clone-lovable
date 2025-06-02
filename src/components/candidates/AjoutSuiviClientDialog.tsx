import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { Plus } from "lucide-react"
import { useClientsBySecteur } from "@/hooks/useClientsBySecteur"
import { Client } from "@/types/types-front"

type Props = {
  open: boolean
  onClose: () => void
  type: "interdiction" | "priorite"
  candidatId: string
  secteurs: string[]
  onSaved: () => void
}

export function AjoutSuiviClientDialog({
  open,
  onClose,
  type,
  candidatId,
  secteurs,
  onSaved,
}: Props) {
  const { toast } = useToast()
  const hasOneSecteur = secteurs.length === 1

  const [secteur, setSecteur] = useState(hasOneSecteur ? secteurs[0] : "")
  const [selectedClient, setSelectedClient] = useState("")
  const [availableClients, setAvailableClients] = useState<Client[]>([])
  const [selectedClientServices, setSelectedClientServices] = useState<string[]>([])
  const [service, setService] = useState("")
  const [commentaire, setCommentaire] = useState("")

  useEffect(() => {
    if (hasOneSecteur) {
      setSecteur(secteurs[0])
    }
  }, [hasOneSecteur, secteurs])

  const { clients } = useClientsBySecteur(secteur)

  useEffect(() => {
    setAvailableClients(clients)
    setSelectedClient("")
    setSelectedClientServices([])
    setService("")
  }, [secteur, clients])

  useEffect(() => {
    const fetchServices = async () => {
      if (!selectedClient) return
      const { data, error } = await supabase
        .from("clients")
        .select("services")
        .eq("id", selectedClient)
        .single()
      if (!error && Array.isArray(data?.services)) {
        setSelectedClientServices(data.services)
      } else {
        setSelectedClientServices([])
      }
    }
    fetchServices()
  }, [selectedClient])

  const handleSave = async () => {
    if (!secteur || !selectedClient) {
      toast({
        title: "Champs requis",
        description: "Sélectionnez un secteur et un client",
        variant: "destructive",
      })
      return
    }

    const { error } = await supabase.from("interdictions_priorites").insert([
      {
        type,
        candidat_id: candidatId,
        client_id: selectedClient,
        secteur,
        service: selectedClientServices.length > 0 ? service || null : null,
        commentaire,
      },
    ])

    if (error) {
      toast({ title: "Erreur", description: "Enregistrement échoué", variant: "destructive" })
    } else {
      toast({ title: "Ajouté avec succès" })
      onSaved()
      onClose()
      setSecteur(hasOneSecteur ? secteurs[0] : "")
      setSelectedClient("")
      setService("")
      setCommentaire("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un client {type === "interdiction" ? "interdit" : "prioritaire"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!hasOneSecteur && (
            <div>
              <label className="text-sm font-medium">Secteur</label>
              <Select value={secteur} onValueChange={(val) => setSecteur(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un secteur" />
                </SelectTrigger>
                <SelectContent>
                  {secteurs.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Client</label>
            <Select value={selectedClient} onValueChange={setSelectedClient} disabled={!secteur}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un client" />
              </SelectTrigger>
              <SelectContent>
                {availableClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedClientServices.length > 0 && (
            <div>
              <label className="text-sm font-medium">Service (facultatif)</label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucun service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {selectedClientServices.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Input
            placeholder="Commentaire"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
          />

          <Button onClick={handleSave} className="w-full">
            <Plus className="h-4 w-4 mr-2" /> Ajouter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
