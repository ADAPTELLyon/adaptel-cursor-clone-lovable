import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ClientFormTabs } from "@/components/clients/client-form-tabs"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import type { Client } from "@/types/types-front"

interface ClientEditDialogProps {
  clientId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh?: () => void
}

export function ClientEditDialog({
  clientId,
  open,
  onOpenChange,
  onRefresh,
}: ClientEditDialogProps) {
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  useEffect(() => {
    const fetchClient = async () => {
      if (!clientId) return
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single()
      if (error || !data) {
        toast({
          title: "Erreur",
          description: "Chargement du client échoué",
          variant: "destructive",
        })
        return
      }
      setEditingClient(data)
    }
    if (open && clientId) {
      fetchClient()
    }
  }, [open, clientId])

  const handleSubmit = async (data: Partial<Client>) => {
    if (!editingClient?.id) return
    const updatePayload = { ...data }

    const { error } = await supabase
      .from("clients")
      .update(updatePayload)
      .eq("id", editingClient.id)

    if (error) {
      toast({
        title: "Erreur",
        description: "Mise à jour du client échouée",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Succès",
      description: "Client mis à jour",
    })

    onOpenChange(false)
    setEditingClient(null)
    if (onRefresh) onRefresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Modifier le client</DialogTitle>
        </DialogHeader>
        {editingClient ? (
          <ClientFormTabs
            initialData={editingClient}
            onSubmit={handleSubmit}
            onCancel={() => {
              onOpenChange(false)
              setEditingClient(null)
            }}
          />
        ) : (
          <div className="text-center text-muted-foreground py-12">
            Chargement du client...
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
