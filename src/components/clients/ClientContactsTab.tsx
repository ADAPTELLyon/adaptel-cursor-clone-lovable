import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"
import { MultiSelect } from "@/components/ui/multi-select"

interface Contact {
  id: string
  nom: string
  prénom?: string
  fonction?: string
  email?: string
  telephone?: string
  secteur?: string
  actif: boolean
  services: string[]
  client_id: string
  created_at?: string
}

interface ClientContactsTabProps {
  clientId: string
  selectedServices: string[]
}

function ClientContactsTab({ clientId, selectedServices }: ClientContactsTabProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newContact, setNewContact] = useState<Partial<Contact>>({ actif: true, services: [] })

  const loadContacts = async () => {
    const { data, error } = await supabase
      .from("contacts_clients")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true })

    if (error) {
      toast({ title: "Erreur", description: "Chargement des contacts échoué", variant: "destructive" })
      return
    }

    const safeData = (data || []).map((c) => ({
      ...c,
      services: c.services ?? [],
    })) as Contact[]

    setContacts(safeData)
  }

  useEffect(() => {
    if (clientId) {
      loadContacts()
    }
  }, [clientId])

  const handleCreate = async () => {
    if (!newContact.nom || newContact.nom.trim() === "") {
      toast({ title: "Nom requis", description: "Veuillez renseigner le nom du contact" })
      return
    }

    const insertPayload = {
      nom: newContact.nom,
      prénom: newContact.prénom || "",
      fonction: newContact.fonction || "",
      email: newContact.email || "",
      telephone: newContact.telephone || "",
      secteur: newContact.secteur || "",
      actif: newContact.actif ?? true,
      client_id: clientId,
      services: newContact.services || [],
    }

    const { error } = await supabase.from("contacts_clients").insert([insertPayload])

    if (error) {
      console.error(error)
      toast({ title: "Erreur", description: "Création échouée", variant: "destructive" })
      return
    }

    toast({ title: "Contact ajouté" })
    setDialogOpen(false)
    setNewContact({ actif: true, services: [] })
    loadContacts()
  }

  const handleToggleActif = async (contact: Contact) => {
    const { error } = await supabase
      .from("contacts_clients")
      .update({ actif: !contact.actif })
      .eq("id", contact.id)

    if (error) {
      toast({ title: "Erreur", description: "Échec de la mise à jour", variant: "destructive" })
      return
    }

    loadContacts()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Contacts</h3>
        <Button onClick={() => setDialogOpen(true)}>Ajouter un contact</Button>
      </div>

      {contacts.filter(c => c.actif).length === 0 && (
        <div className="text-muted-foreground text-sm">Aucun contact actif</div>
      )}

      <ul className="space-y-3">
        {contacts
          .filter(c => c.actif)
          .map(contact => (
            <li key={contact.id} className="border rounded p-3">
              <div className="font-semibold">{contact.nom} {contact.prénom}</div>
              <div className="text-sm text-muted-foreground">{contact.fonction}</div>
              <div className="text-sm">📧 {contact.email || "-"}</div>
              <div className="text-sm">📞 {contact.telephone || "-"}</div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm">Actif</span>
                <Switch checked={contact.actif} onCheckedChange={() => handleToggleActif(contact)} />
              </div>
            </li>
          ))}
      </ul>

      {contacts.filter(c => !c.actif).length > 0 && (
        <div className="pt-6">
          <h4 className="text-sm font-medium mb-2">Contacts inactifs</h4>
          <ul className="space-y-2">
            {contacts
              .filter(c => !c.actif)
              .map(contact => (
                <li key={contact.id} className="border rounded p-2 opacity-60">
                  <div className="text-sm">{contact.nom} {contact.prénom}</div>
                  <div className="text-xs text-muted-foreground">{contact.email} – {contact.telephone}</div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs">Actif</span>
                    <Switch checked={contact.actif} onCheckedChange={() => handleToggleActif(contact)} />
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input value={newContact.nom || ""} onChange={(e) => setNewContact({ ...newContact, nom: e.target.value })} />
            </div>
            <div>
              <Label>Prénom</Label>
              <Input value={newContact.prénom || ""} onChange={(e) => setNewContact({ ...newContact, prénom: e.target.value })} />
            </div>
            <div>
              <Label>Fonction</Label>
              <Input value={newContact.fonction || ""} onChange={(e) => setNewContact({ ...newContact, fonction: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={newContact.email || ""} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={newContact.telephone || ""} onChange={(e) => setNewContact({ ...newContact, telephone: e.target.value })} />
            </div>

            {selectedServices.length > 0 ? (
              <div>
                <Label>Services</Label>
                <MultiSelect
                  options={selectedServices}
                  selected={newContact.services || []}
                  onChange={(values) => setNewContact({ ...newContact, services: values })}
                  placeholder="Sélectionner les services"
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic">
                Aucun service défini pour ce client.
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <Label className="text-sm">Actif</Label>
              <Switch
                checked={newContact.actif ?? true}
                onCheckedChange={(checked) => setNewContact({ ...newContact, actif: checked })}
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleCreate}>Créer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { ClientContactsTab }
