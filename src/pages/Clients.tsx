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

// ✅ Type strict basé sur ta table clients
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
      services: data.services ?? [],
      secteurs: data.secteurs ?? [],
      actif: data.actif ?? true,
    }

    const { error } = editingClient
      ? await supabase
          .from("clients")
          .update(clientToSave)
          .eq("id", editingClient.id)
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
      description: editingClient
        ? "Client modifié avec succès"
        : "Client ajouté avec succès",
    })

    setDialogOpen(false)
    setEditingClient(null)
    refetch()
  }

  const handleEdit = async (id: string) => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !data) {
      toast({
        title: "Erreur",
        description: "Impossible de charger le client",
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
    const { error } = await supabase
      .from("clients")
      .update({ actif: active })
      .eq("id", id)

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut du client",
        variant: "destructive",
      })
      return
    }

    refetch()
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Clients</h1>
          <Button
            onClick={() => {
              setEditingClient(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
          <Input
            className="pl-10"
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="rounded-lg border bg-white">
          <ClientList
            clients={clients}
            onEdit={handleEdit}
            onToggleActive={handleToggleActive}
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? "Modifier le client" : "Ajouter un client"}
              </DialogTitle>
            </DialogHeader>
            <ClientFormTabs
              initialData={editingClient || undefined}
              onSubmit={handleSubmit}
              onCancel={() => {
                setDialogOpen(false)
                setEditingClient(null)
              }}
              selectedServices={editingClient?.services || []}
            />
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
