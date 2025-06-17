import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CandidateFormTabs } from "./candidate-form-tabs"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"

interface CandidatEditDialogProps {
  candidatId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh?: () => void
}

export function CandidatEditDialog({ candidatId, open, onOpenChange, onRefresh }: CandidatEditDialogProps) {
  const [editingCandidate, setEditingCandidate] = useState<any>(null)

  useEffect(() => {
    const fetchCandidat = async () => {
      if (!candidatId) return

      const { data, error } = await supabase
        .from("candidats")
        .select("*")
        .eq("id", candidatId)
        .single()

      if (error || !data) {
        toast({ title: "Erreur", description: "Chargement du candidat échoué", variant: "destructive" })
        return
      }

      setEditingCandidate(data)
    }

    if (open && candidatId) {
      fetchCandidat()
    }
  }, [open, candidatId])

  const handleSubmit = async (data: any) => {
    // SÉCURISATION : s’assurer que les données sont bien formées
    const updatePayload = { ...data }

    if (!updatePayload.id && editingCandidate?.id) {
      updatePayload.id = editingCandidate.id
    }

    // FORMATAGE de la date_naissance
    if (typeof updatePayload.date_naissance === "string" && updatePayload.date_naissance.includes("/")) {
      const [jour, mois, annee] = updatePayload.date_naissance.split("/")
      if (jour && mois && annee) {
        updatePayload.date_naissance = `${annee}-${mois}-${jour}`
      }
    }

    const { error } = await supabase
      .from("candidats")
      .update(updatePayload)
      .eq("id", updatePayload.id)

    if (error) {
      console.error("Erreur mise à jour candidat :", error)
      toast({ title: "Erreur", description: "Échec de la mise à jour", variant: "destructive" })
      return
    }

    toast({ title: "Succès", description: "Candidat mis à jour" })

    onOpenChange(false)
    setEditingCandidate(null)
    if (onRefresh) onRefresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier le candidat</DialogTitle>
        </DialogHeader>

        {editingCandidate ? (
          <CandidateFormTabs
            initialData={editingCandidate}
            onSubmit={handleSubmit}
            onCancel={() => {
              onOpenChange(false)
              setEditingCandidate(null)
            }}
          />
        ) : (
          <div className="text-center text-muted-foreground py-12">
            Chargement du candidat...
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
