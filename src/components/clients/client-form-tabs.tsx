import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { MultiSelect } from "@/components/ui/multi-select"
import { toast } from "@/hooks/use-toast"
import { FormLabel } from "@/components/ui/form"

type Contact = {
  id?: string
  client_id: string
  nom: string
  prénom?: string | null
  fonction?: string | null
  telephone?: string | null
  email?: string | null
  secteur?: string | null
  services?: string[]
  actif?: boolean
}

type ClientContactsTabProps = {
  clientId: string
  selectedServices: string[]
}

export function ClientContactsTab({ clientId, selectedServices }: ClientContactsTabProps) {
  const queryClient = useQueryClient()

  const [contacts, setContacts] = useState<Contact[]>([])
  const [editingContactId, setEditingContactId] = useState<string | "new" | null>(null)
  const [formData, setFormData] = useState<Contact>({
    nom: "",
    services: [],
    actif: true,
    client_id: clientId,
  })

  useEffect(() => {
    if (!clientId) return
    fetchContacts()
    // reset edition à chaque client
    setEditingContactId(null)
    setFormData({
      nom: "",
      services: [],
      actif: true,
      client_id: clientId,
    })
  }, [clientId])

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from("contacts_clients")
      .select("*")
      .eq("client_id", clientId)
      .order("nom")
    if (error) {
      toast({ title: "Erreur chargement contacts", variant: "destructive" })
      return
    }
    setContacts(data || [])
  }

  const onChange = (field: keyof Contact, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const startEdit = (contact: Contact | "new") => {
    if (contact === "new") {
      setFormData({
        nom: "",
        services: [],
        actif: true,
        client_id: clientId,
      })
      setEditingContactId("new")
    } else {
      setFormData(contact)
      setEditingContactId(contact.id || null)
    }
  }

  const cancelEdit = () => {
    setEditingContactId(null)
    setFormData({
      nom: "",
      services: [],
      actif: true,
      client_id: clientId,
    })
  }

  const saveContact = async () => {
    if (!formData.nom || formData.nom.trim() === "") {
      toast({ title: "Le nom est obligatoire", variant: "destructive" })
      return
    }

    const payload: Contact = {
      ...formData,
      client_id: clientId,
      actif: formData.actif ?? true,
      services: formData.services || [],
      nom: formData.nom.trim(),
    }

    try {
      if (editingContactId && editingContactId !== "new") {
        const { error } = await supabase
          .from("contacts_clients")
          .update(payload)
          .eq("id", editingContactId)
        if (error) throw error
        toast({ title: "Contact mis à jour" })
      } else {
        const { error } = await supabase.from("contacts_clients").insert([payload])
        if (error) throw error
        toast({ title: "Contact ajouté" })
      }
      cancelEdit()
      fetchContacts()
      queryClient.invalidateQueries({ queryKey: ["contacts", clientId] })
    } catch {
      toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" })
    }
  }

  const deleteContact = async (id: string) => {
    if (!window.confirm("Confirmez-vous la suppression ?")) return

    const { error } = await supabase.from("contacts_clients").delete().eq("id", id)
    if (error) {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" })
      return
    }
    toast({ title: "Contact supprimé" })
    fetchContacts()
    queryClient.invalidateQueries({ queryKey: ["contacts", clientId] })
  }

  return (
    <div>
      <Button onClick={() => startEdit("new")} className="mb-4">
        + Ajouter un contact
      </Button>

      {editingContactId && (
        <div className="p-4 border rounded mb-6 space-y-4 bg-white shadow-sm">
          <FormLabel>Nom *</FormLabel>
          <Input
            value={formData.nom}
            onChange={(e) => onChange("nom", e.target.value)}
          />

          <FormLabel>Prénom</FormLabel>
          <Input
            value={formData.prénom || ""}
            onChange={(e) => onChange("prénom", e.target.value)}
          />

          <FormLabel>Fonction</FormLabel>
          <Input
            value={formData.fonction || ""}
            onChange={(e) => onChange("fonction", e.target.value)}
          />

          <FormLabel>Téléphone</FormLabel>
          <Input
            value={formData.telephone || ""}
            onChange={(e) => onChange("telephone", e.target.value)}
          />

          <FormLabel>Email</FormLabel>
          <Input
            value={formData.email || ""}
            onChange={(e) => onChange("email", e.target.value)}
          />

          <FormLabel>Secteur</FormLabel>
          <Input
            value={formData.secteur || ""}
            onChange={(e) => onChange("secteur", e.target.value)}
          />

          <FormLabel>Services</FormLabel>
          <MultiSelect
            options={selectedServices}
            selected={formData.services || []}
            onChange={(values) => onChange("services", values)}
          />

          <FormLabel>Actif</FormLabel>
          <Switch
            checked={formData.actif ?? true}
            onCheckedChange={(checked) => onChange("actif", checked)}
          />

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={cancelEdit}>
              Annuler
            </Button>
            <Button onClick={saveContact}>Enregistrer</Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="flex justify-between items-center p-3 border rounded shadow-sm bg-white"
          >
            <div>
              <strong>{contact.nom}</strong> {contact.prénom} — {contact.fonction}
              <br />
              <small>{contact.telephone} | {contact.email}</small>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => startEdit(contact)}>
                Modifier
              </Button>
              <Button size="sm" variant="destructive" onClick={() => deleteContact(contact.id!)}>
                Supprimer
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
