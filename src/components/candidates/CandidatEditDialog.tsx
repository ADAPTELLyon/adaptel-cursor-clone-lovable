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

/**
 * ✅ Export nommé + default (évite toute casse selon les imports)
 */
export function CandidatEditDialog({
  candidatId,
  open,
  onOpenChange,
  onRefresh,
}: CandidatEditDialogProps) {
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
        console.error("[CandidatEditDialog] Chargement candidat échoué:", error)
        toast({
          title: "Erreur",
          description: "Chargement du candidat échoué",
          variant: "destructive",
        })
        return
      }

      setEditingCandidate(data)
    }

    if (open && candidatId) {
      fetchCandidat()
    }
  }, [open, candidatId])

  const handleSubmit = async (data: any) => {
    // 1) On sécurise l'id (cible de l'update)
    const id = data?.id || editingCandidate?.id
    if (!id) {
      console.error("[CandidatEditDialog] Update annulé : ID manquant", { data, editingCandidate })
      toast({
        title: "Erreur",
        description: "ID candidat manquant (mise à jour impossible).",
        variant: "destructive",
      })
      return
    }

    // 2) Payload : on enlève l'id (jamais dans le payload)
    const updatePayload = { ...data }
    delete updatePayload.id

    // 3) Format date_naissance (jj/mm/aaaa -> yyyy-mm-dd)
    if (
      typeof updatePayload.date_naissance === "string" &&
      updatePayload.date_naissance.includes("/")
    ) {
      const [jour, mois, annee] = updatePayload.date_naissance.split("/")
      if (jour && mois && annee) {
        updatePayload.date_naissance = `${annee}-${mois}-${jour}`
      }
    }

    // 4) Update avec retour : si 0 ligne modifiée, on le sait (sinon tu crois que c’est OK)
    const { data: updatedRow, error } = await supabase
      .from("candidats")
      .update(updatePayload)
      .eq("id", id)
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("[CandidatEditDialog] Erreur mise à jour candidat:", error, { id, updatePayload })
      toast({
        title: "Erreur",
        description: `Échec de la mise à jour${error?.message ? ` : ${error.message}` : ""}`,
        variant: "destructive",
      })
      return
    }

    // ✅ Cas clé : aucune ligne modifiée (souvent RLS/policy ou id non match ou update ignoré)
    if (!updatedRow?.id) {
      console.error(
        "[CandidatEditDialog] Aucune ligne modifiée (0 row). Causes possibles: RLS/policy, session, id non match, payload identique.",
        { id, updatePayload }
      )
      toast({
        title: "Échec",
        description: "Modification non enregistrée (aucune ligne modifiée).",
        variant: "destructive",
      })
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

export default CandidatEditDialog
