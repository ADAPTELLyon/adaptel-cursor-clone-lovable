import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, Search } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { supabase } from "@/integrations/supabase/client"
import MainLayout from "@/components/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ClientList } from "@/components/clients/client-list"
import { ClientFormTabs } from "@/components/clients/client-form-tabs"

export default function Clients() {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<any>(null)

  const { data: clients = [], refetch } = useQuery({
    queryKey: ["clients", search],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .ilike("nom", `%${search}%`)
        .order("nom")

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de charger les clients",
          variant: "destructive",
        })
        return []
      }

      return data.map(client => ({
        ...client,
        services: Array.isArray(client.services)
          ? client.services
          : typeof client.services === "string"
          ? client.services.split(",")
          : [],
        secteurs: Array.isArray(client.secteurs)
          ? client.secteurs
          : typeof client.secteurs === "string"
          ? client.secteurs.split(",")
          : [],
      }))
    },
  })

  const handleSubmit = async (data: any) => {
    try {
      const toSave = {
        ...data,
        services: Array.isArray(data.services) ? data.services : [],
        secteurs: Array.isArray(data.secteurs) ? data.secteurs : [],
      }

      if (!editingClient) {
        toSave.id = uuidv4()
        const { error } = await supabase.from("clients").insert([toSave])
        if (error) throw error
        toast({ title: "Succès", description: "Client ajouté avec succès" })
      } else {
        const { error } = await supabase
          .from("clients")
          .update(toSave)
          .eq("id", editingClient.id)
        if (error) throw error
        toast({ title: "Succès", description: "Client modifié avec succès" })
      }

      setDialogOpen(false)
      setEditingClient(null)
      refetch()
    } catch (error) {
      console.error("Erreur lors de l'enregistrement", error)
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le client",
        variant: "destructive",
      })
    }
  }

  const handleEdit = async (id: string) => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger le client",
        variant: "destructive",
      })
      return
    }

    setEditingClient({
      ...data,
      services: Array.isArray(data.services)
        ? data.services
        : typeof data.services === "string"
        ? data.services.split(",")
        : [],
      secteurs: Array.isArray(data.secteurs)
        ? data.secteurs
        : typeof data.secteurs === "string"
        ? data.secteurs.split(",")
        : [],
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
              initialData={editingClient ?? undefined}
              selectedServices={editingClient?.services || []}
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
