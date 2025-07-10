import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, Search } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { supabase } from "@/integrations/supabase/client"
import MainLayout from "@/components/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ClientList } from "@/components/clients/client-list"
import { ClientFormTabs } from "@/components/clients/client-form-tabs"
import { z } from "zod"
import { formSchema } from "@/components/clients/client-form"

type Client = {
  id: string
  nom: string
  adresse?: string
  code_postal?: string
  ville?: string
  groupe?: string
  telephone?: string
  services: string[]
  secteurs: string[]
  actif: boolean
  created_by?: string
  created_at?: string
  updated_at?: string
}

type ClientFormType = z.infer<typeof formSchema> & { id: string }

export default function Clients() {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientFormType | null>(null)

  const { data: clients = [], refetch } = useQuery({
    queryKey: ["clients", search],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .ilike("nom", `%${search}%`)
        .order("nom")

      if (error || !data) {
        toast({
          title: "Erreur",
          description: "Impossible de charger les clients",
          variant: "destructive",
        })
        return []
      }

      return data.map((client): Client => {
        const rawServices = client.services as string[] | string | null | undefined
        let services: string[] = []

        if (Array.isArray(rawServices)) {
          services = rawServices
        } else if (typeof rawServices === "string") {
          services = rawServices.split(",").map((s) => s.trim())
        }

        return {
          id: client.id,
          nom: client.nom || "",
          adresse: client.adresse || "",
          code_postal: client.code_postal || "",
          ville: client.ville || "",
          groupe: client.groupe || "",
          telephone: client.telephone || "",
          services,
          secteurs: client.secteurs ?? [],
          actif: client.actif ?? true,
          created_at: client.created_at ?? "",
          created_by: client.created_by ?? "",
          updated_at: client.updated_at ?? "",
        }
      })
    },
  })

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    const clientToSave = {
      nom: data.nom || "",
      adresse: data.adresse || "",
      code_postal: data.code_postal || "",
      ville: data.ville || "",
      groupe: data.groupe || "",
      telephone: data.telephone || "",
      commentaire: data.commentaire || "",
      services: data.services ?? [],
      secteurs: data.secteurs ?? [],
      actif: data.actif ?? true,
    }

    const { error } = editingClient
      ? await supabase.from("clients").update(clientToSave).eq("id", editingClient.id)
      : await supabase.from("clients").insert([
          {
            ...clientToSave,
            id: uuidv4(),
          },
        ])

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le client",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Succès",
      description: editingClient ? "Client modifié" : "Client ajouté",
    })

    setDialogOpen(false)
    setEditingClient(null)
    refetch()
  }

  const handleEdit = async (id: string) => {
    const { data, error } = await supabase.from("clients").select("*").eq("id", id).single()

    if (error || !data) {
      toast({
        title: "Erreur",
        description: "Client introuvable",
        variant: "destructive",
      })
      return
    }

    const rawServices = data.services as string[] | string | null | undefined
    let services: string[] = []

    if (Array.isArray(rawServices)) {
      services = rawServices
    } else if (typeof rawServices === "string") {
      services = rawServices.split(",").map((s) => s.trim())
    }

    setEditingClient({
      ...data,
      id: data.id,
      nom: data.nom || "",
      services,
      secteurs: data.secteurs ?? [],
      actif: data.actif ?? true,
    })

    setDialogOpen(true)
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("clients").update({ actif: active }).eq("id", id)
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut",
        variant: "destructive",
      })
      return
    }
    refetch()
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6 min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gestion de votre portefeuille clients
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingClient(null)
              setDialogOpen(true)
            }}
            className="bg-[#840404] hover:bg-[#6a0303] text-white shadow-sm transition-all hover:shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouveau client
          </Button>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9 w-full border-0 bg-gray-50 focus-visible:ring-2 focus-visible:ring-[#840404]/20"
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="text-sm text-gray-500 font-medium">
            {clients.length} {clients.length > 1 ? "clients trouvés" : "client trouvé"}
          </div>
        </div>

        {/* Client List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <ClientList
            clients={clients}
            onEdit={handleEdit}
            onToggleActive={handleToggleActive}
          />
        </div>

        {/* Fenêtre modale propre et restaurée */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-white p-6 rounded-xl shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-800">
                {editingClient ? "Modifier le client" : "Créer un nouveau client"}
              </DialogTitle>
            </DialogHeader>
            <ClientFormTabs
              initialData={editingClient || undefined}
              onSubmit={handleSubmit}
              onCancel={() => {
                setDialogOpen(false)
                setEditingClient(null)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
