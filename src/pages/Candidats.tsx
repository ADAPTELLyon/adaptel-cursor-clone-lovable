import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, Search } from "lucide-react"
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
import { CandidateList } from "@/components/candidates/candidate-list"
import { CandidateFormTabs } from "@/components/candidates/candidate-form-tabs"

export default function Candidats() {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<any>(null)

  const { data: candidates = [], refetch } = useQuery({
    queryKey: ["candidates", search],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidats")
        .select("*")
        .ilike("nom", `%${search}%`)
        .order("nom")

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de charger les candidats",
          variant: "destructive",
        })
        return []
      }

      return data
    },
  })

  useEffect(() => {
    const debounce = setTimeout(() => {
      refetch()
    }, 300)
    return () => clearTimeout(debounce)
  }, [search, refetch])

  const handleSubmit = async (data: any) => {
    const formattedData = { ...data }
    if (formattedData.date_naissance) {
      const [day, month, year] = formattedData.date_naissance.split("/")
      if (day && month && year) {
        formattedData.date_naissance = `${year}-${month}-${day}`
      }
    }

    const { error } = editingCandidate
      ? await supabase.from("candidats").update(formattedData).eq("id", editingCandidate.id)
      : await supabase.from("candidats").insert([formattedData])

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le candidat",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Succès",
      description: editingCandidate
        ? "Candidat modifié avec succès"
        : "Candidat ajouté avec succès",
    })

    setDialogOpen(false)
    setEditingCandidate(null)
    refetch()
  }

  const handleEdit = async (id: string) => {
    const { data, error } = await supabase
      .from("candidats")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !data) {
      toast({
        title: "Erreur",
        description: "Impossible de charger le candidat",
        variant: "destructive",
      })
      return
    }

    setEditingCandidate(data)
    setDialogOpen(true)
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("candidats").update({ actif: active }).eq("id", id)

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut du candidat",
        variant: "destructive",
      })
      return
    }

    refetch()
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6 min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Titre + bouton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Candidats</h1>
            <p className="text-sm text-gray-500 mt-1">Gestion des profils candidats</p>
          </div>
          <Button
            onClick={() => {
              setEditingCandidate(null)
              setDialogOpen(true)
            }}
            className="bg-[#840404] hover:bg-[#6a0303] text-white shadow-sm transition-all hover:shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouveau candidat
          </Button>
        </div>

        {/* Barre de recherche */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9 w-full border-0 bg-gray-50 focus-visible:ring-2 focus-visible:ring-[#840404]/20"
              placeholder="Rechercher un candidat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="text-sm text-gray-500 font-medium">
            {candidates.length} {candidates.length > 1 ? "candidats trouvés" : "candidat trouvé"}
          </div>
        </div>

        {/* Liste des candidats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <CandidateList
            candidates={candidates}
            onEdit={handleEdit}
            onToggleActive={handleToggleActive}
          />
        </div>

        {/* Formulaire candidat */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-white p-6 rounded-xl shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-800">
                {editingCandidate ? "Modifier le candidat" : "Ajouter un candidat"}
              </DialogTitle>
            </DialogHeader>
            <CandidateFormTabs
              initialData={editingCandidate}
              onSubmit={handleSubmit}
              onCancel={() => {
                setDialogOpen(false)
                setEditingCandidate(null)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
