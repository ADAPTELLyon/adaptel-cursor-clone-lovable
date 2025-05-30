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
    queryKey: ["candidates"],
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
      const [day, month, year] = formattedData.date_naissance.split('/')
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
    const { error } = await supabase
      .from("candidats")
      .update({ actif: active })
      .eq("id", id)

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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Candidats</h1>
          <Button
            onClick={() => {
              setEditingCandidate(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
          <Input
            className="pl-10"
            placeholder="Rechercher un candidat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="rounded-lg border bg-white">
          <CandidateList
            candidates={candidates}
            onEdit={handleEdit}
            onToggleActive={handleToggleActive}
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-[800px] min-h-[650px] flex flex-col">
            <DialogHeader className="border-b pb-2 mb-2">
              <DialogTitle className="text-2xl font-semibold">
                {editingCandidate ? "Modifier le candidat" : "Ajouter un candidat"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto overflow-x-hidden pr-4 scrollbar-none">
              <CandidateFormTabs
                initialData={editingCandidate}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setDialogOpen(false)
                  setEditingCandidate(null)
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
