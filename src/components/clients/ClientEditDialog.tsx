import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ClientFormTabs } from "@/components/clients/client-form-tabs"
import { Building2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"

interface ClientEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string | null // null si création
  onRefresh: () => void
}

export function ClientEditDialog({
  open,
  onOpenChange,
  clientId,
  onRefresh,
}: ClientEditDialogProps) {
  const { toast } = useToast()

  const [editingClient, setEditingClient] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [headerName, setHeaderName] = useState("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // aligné avec ClientFormTabs: registerSaveCurrent(fn: () => Promise<boolean>)
  const [saveCurrentFn, setSaveCurrentFn] = useState<(() => Promise<boolean>) | null>(null)

  // ✅ popup app (shadcn) au lieu de confirm navigateur
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)

  useEffect(() => {
    if (open && clientId) {
      loadClientData()
    } else if (open && !clientId) {
      setEditingClient(null)
      setHeaderName("Nouveau client")
      setHasUnsavedChanges(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId])

  async function loadClientData() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single()

      if (error) throw error
      setEditingClient(data)
      setHeaderName(data?.nom || "")
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les données du client",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // SAVE réel pour l’onglet Informations
  const saveInfosToSupabase = async (values: any): Promise<string | null> => {
    try {
      const payload = { ...(values || {}) }

      delete payload.id
      delete payload.created_at
      delete payload.updated_at

      Object.keys(payload).forEach((k) => {
        if (typeof payload[k] === "undefined") delete payload[k]
      })

      if (clientId) {
        const { data, error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", clientId)
          .select("*")
          .single()

        if (error) throw error

        setEditingClient(data)
        setHeaderName(data?.nom || headerName)

        toast({
          title: "Enregistré",
          description: "Les informations du client ont bien été mises à jour.",
        })

        return data?.id || clientId
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert(payload)
          .select("*")
          .single()

        if (error) throw error

        setEditingClient(data)
        setHeaderName(data?.nom || "Nouveau client")

        toast({
          title: "Client créé",
          description: "Le client a bien été créé.",
        })

        return data?.id || null
      }
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Impossible d'enregistrer les informations du client",
        variant: "destructive",
      })
      return null
    }
  }

  const handleMainSave = async () => {
    if (!saveCurrentFn) return
    const ok = await saveCurrentFn()
    if (ok) {
      setHasUnsavedChanges(false)
      onRefresh()
      if (!clientId) onOpenChange(false)
    }
  }

  // ✅ fermeture via popup app
  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setConfirmCloseOpen(true)
      return
    }
    onOpenChange(false)
  }

  const closeDiscard = () => {
    setConfirmCloseOpen(false)
    // on ne force pas le reset des champs ici : on abandonne juste et on ferme
    setHasUnsavedChanges(false)
    onOpenChange(false)
  }

  const closeSave = async () => {
    if (!saveCurrentFn) return
    const ok = await saveCurrentFn()
    if (!ok) return
    setConfirmCloseOpen(false)
    setHasUnsavedChanges(false)
    onRefresh()
    onOpenChange(false)
  }

  return (
    <>
      {/* ✅ Popup app (shadcn) au lieu de confirm navigateur */}
      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
            <AlertDialogDescription>
              Vous avez des modifications non enregistrées. Voulez-vous enregistrer avant de quitter ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button variant="outline" onClick={closeDiscard}>
              Ignorer
            </Button>
            <AlertDialogAction onClick={closeSave}>Enregistrer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={open}
        onOpenChange={(val) => {
          // Radix déclenche ça quand on clique à l’extérieur / ESC.
          // Si fermeture demandée -> on route via notre popup app.
          if (!val) {
            handleRequestClose()
          } else {
            onOpenChange(true)
          }
        }}
      >
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 py-4 bg-white border-b border-gray-100 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#840404]/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#840404]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  {headerName || (loading ? "Chargement..." : "Client")}
                </DialogTitle>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  {clientId ? "Édition du client" : "Création d'établissement"}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <ClientFormTabs
              initialData={editingClient}
              onSaveInfos={async (data) => {
                return await saveInfosToSupabase(data)
              }}
              setHasUnsavedChanges={setHasUnsavedChanges}
              registerSaveCurrent={(fn) => setSaveCurrentFn(() => fn)}
              onHeaderNameChange={setHeaderName}
            />
          </div>

          <DialogFooter className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              onClick={handleRequestClose}
              className="text-gray-600 hover:bg-gray-200"
            >
              Annuler
            </Button>
            <Button
              onClick={handleMainSave}
              className="bg-[#840404] hover:bg-[#6a0303] text-white px-8 shadow-sm"
            >
              {clientId ? "Enregistrer les modifications" : "Créer le client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
