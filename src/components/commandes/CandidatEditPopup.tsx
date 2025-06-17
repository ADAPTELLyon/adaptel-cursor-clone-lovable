import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CandidateFormTabs } from "@/components/candidates/candidate-form-tabs"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Candidat } from "@/types/types-front"

export function CandidatEditPopup({
  open,
  onOpenChange,
  initialData
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initialData?: Candidat
}) {
  const { toast } = useToast()
  const [data, setData] = useState<Candidat | undefined>(initialData)

  useEffect(() => {
    if (!open || !initialData?.id) return
    const fetch = async () => {
      const { data: fresh, error } = await supabase
        .from("candidats")
        .select("*")
        .eq("id", initialData.id)
        .single()
      if (!error && fresh) setData(fresh)
    }
    fetch()
  }, [open, initialData?.id])

  const handleSubmit = async (form: any) => {
    const { error } = await supabase.from("candidats").update(form).eq("id", data?.id)
    if (error) {
      toast({ title: "Erreur", description: "Impossible d’enregistrer", variant: "destructive" })
    } else {
      toast({ title: "Succès", description: "Candidat mis à jour" })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-white p-6 rounded-xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-800">Modifier le candidat</DialogTitle>
        </DialogHeader>
        {data && (
          <CandidateFormTabs
            initialData={data}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
