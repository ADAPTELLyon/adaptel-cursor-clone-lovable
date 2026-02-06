import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, UserPlus } from "lucide-react"
import { secteursList } from "@/lib/secteurs"
import { ClientContactDialog, ContactFormState } from "./ClientContactDialog"

interface Contact {
  id: string
  nom: string
  prénom?: string
  fonction?: string
  email?: string
  telephone?: string
  secteur?: string | null
  actif: boolean
  client_id: string
  services?: string[]
}

interface Props {
  clientId: string
  selectedServices: string[]
  secteurs?: string[]
}

export function ClientContactsTab({ clientId, selectedServices, secteurs = [] }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  // État initial du formulaire basé sur ton interface ContactFormState
  const emptyForm: ContactFormState = {
    nom: "",
    prénom: "",
    fonction: "",
    email: "",
    telephone: "",
    actif: true,
    services: [],
    secteurs: [],
  }

  const [form, setForm] = useState<ContactFormState>(emptyForm)

  useEffect(() => {
    if (clientId) fetchContacts()
  }, [clientId])

  async function fetchContacts() {
    try {
      const { data, error } = await supabase
        .from("contacts_clients")
        .select("*")
        .eq("client_id", clientId)
        .order("nom", { ascending: true })

      if (error) throw error
      setContacts(data || [])
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" })
    }
  }

  const openCreate = () => {
    setEditingContact(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (contact: Contact) => {
    setEditingContact(contact)
    setForm({
      nom: contact.nom || "",
      prénom: contact.prénom || "",
      fonction: contact.fonction || "",
      email: contact.email || "",
      telephone: contact.telephone || "",
      actif: contact.actif,
      services: contact.services || [],
      secteurs: contact.secteur ? contact.secteur.split("|") : [],
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      const payload = {
        nom: form.nom,
        prénom: form.prénom,
        fonction: form.fonction,
        email: form.email,
        telephone: form.telephone,
        actif: form.actif,
        services: form.services,
        secteur: form.secteurs.join("|"),
        client_id: clientId,
      }

      if (editingContact) {
        const { error } = await supabase
          .from("contacts_clients")
          .update(payload)
          .eq("id", editingContact.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("contacts_clients")
          .insert([payload])
        if (error) throw error
      }

      toast({ title: "Contact enregistré" })
      setDialogOpen(false)
      fetchContacts()
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!editingContact) return
    if (!confirm("Voulez-vous vraiment supprimer ce contact ?")) return

    try {
      const { error } = await supabase
        .from("contacts_clients")
        .delete()
        .eq("id", editingContact.id)

      if (error) throw error
      toast({ title: "Contact supprimé" })
      setDialogOpen(false)
      fetchContacts()
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" })
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-900">Contacts de l'établissement</h3>
        <Button onClick={openCreate} className="bg-[#840404] hover:bg-[#6a0303] gap-2">
          <UserPlus className="w-4 h-4" /> Nouveau contact
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map((contact) => (
          <div 
            key={contact.id} 
            className={`p-4 rounded-xl border transition-all ${contact.actif ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-75'}`}
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">{contact.nom} {contact.prénom}</span>
                  {!contact.actif && <Badge variant="secondary" className="text-[10px] uppercase">Inactif</Badge>}
                </div>
                <p className="text-sm text-[#840404] font-medium">{contact.fonction}</p>
                <div className="flex flex-col gap-1 mt-2">
                  {contact.email && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Mail className="w-3 h-3" /> {contact.email}
                    </div>
                  )}
                  {contact.telephone && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone className="w-3 h-3" /> {contact.telephone}
                    </div>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => openEdit(contact)} className="border-gray-200 text-gray-600">
                Modifier
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ClientContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingContact ? "Modifier le contact" : "Nouveau contact"}
        form={form}
        setForm={setForm}
        secteurOptions={secteurs}
        serviceOptions={selectedServices}
        isEditing={!!editingContact}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  )
}