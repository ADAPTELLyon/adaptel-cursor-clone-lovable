/**
 * Page de gestion des clients
 * Affiche la liste des clients avec recherche et filtres
 * Ouvre la fiche client via ClientEditDialog (création / édition)
 */

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, Search, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import MainLayout from "@/components/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { ClientList } from "@/components/clients/client-list"
import { ClientEditDialog } from "@/components/clients/ClientEditDialog"

// Types strictement conformes à ta base de données
type Client = {
  id: string
  nom: string
  adresse?: string
  code_postal?: string
  ville?: string
  groupe?: string
  telephone?: string
  commentaire?: string
  services: string[]
  secteurs: string[]
  actif: boolean
  created_by?: string
  created_at?: string
  updated_at?: string
}

type StatusFilter = "actifs" | "inactifs" | "tous"

export default function Clients() {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("actifs")

  // ✅ Ouverture fiche client
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  // Chargement des clients avec typage sécurisé
  const { data: clients = [], refetch } = useQuery({
    queryKey: ["clients", search],
    queryFn: async (): Promise<Client[]> => {
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
        throw error
      }

      return (data || []).map((client: any): Client => ({
        ...client,
        services: Array.isArray(client.services) 
          ? client.services 
          : typeof client.services === "string" 
            ? client.services.split(",").map((s: string) => s.trim())
            : [],
        secteurs: Array.isArray(client.secteurs) ? client.secteurs : [],
        actif: client.actif ?? true
      }))
    },
  })

  // Filtrage selon le statut
  const clientsFiltered = useMemo(() => {
    if (statusFilter === "tous") return clients
    if (statusFilter === "actifs") return clients.filter((c) => c.actif)
    return clients.filter((c) => !c.actif)
  }, [clients, statusFilter])

  const handleEdit = (id: string) => {
    setSelectedClientId(id)
    setEditDialogOpen(true)
  }

  const handleCreate = () => {
    setSelectedClientId(null)
    setEditDialogOpen(true)
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

  const shownCount = clientsFiltered.length

  return (
    <MainLayout>
      <div className="space-y-6 p-6 min-h-screen bg-gray-50">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestion des clients</h1>
            <p className="text-sm text-gray-600">
              {shownCount} établissement{shownCount > 1 ? "s" : ""} •{" "}
              {statusFilter === "actifs" ? "Actifs" : statusFilter === "inactifs" ? "Inactifs" : "Tous"}
            </p>
          </div>

          <Button
            onClick={handleCreate}
            className="bg-[#840404] hover:bg-[#6a0303] text-white shadow-sm px-5"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouveau client
          </Button>
        </div>

        {/* Barre de recherche et filtres */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-10 w-full border-gray-300 focus:border-[#840404] focus:ring-[#840404]"
                placeholder="Rechercher un client par nom..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search.length > 0 && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant={statusFilter === "actifs" ? "default" : "outline"}
                onClick={() => setStatusFilter("actifs")}
                className={`w-24 ${statusFilter === "actifs" ? "bg-[#840404] hover:bg-[#6a0303]" : ""}`}
              >
                Actifs
              </Button>
              <Button
                variant={statusFilter === "inactifs" ? "default" : "outline"}
                onClick={() => setStatusFilter("inactifs")}
                className={`w-24 ${statusFilter === "inactifs" ? "bg-[#840404] hover:bg-[#6a0303]" : ""}`}
              >
                Inactifs
              </Button>
              <Button
                variant={statusFilter === "tous" ? "default" : "outline"}
                onClick={() => setStatusFilter("tous")}
                className={`w-24 ${statusFilter === "tous" ? "bg-[#840404] hover:bg-[#6a0303]" : ""}`}
              >
                Tous
              </Button>
            </div>
          </div>
        </div>

        {/* Liste des clients */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <ClientList clients={clientsFiltered} onEdit={handleEdit} onToggleActive={handleToggleActive} />
        </div>

        {/* Fiche client */}
        <ClientEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          clientId={selectedClientId}
          onRefresh={() => refetch()}
        />
      </div>
    </MainLayout>
  )
}