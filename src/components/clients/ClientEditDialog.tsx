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
import { Building2, X } from "lucide-react"

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
  
  // États de la fiche
  const [editingClient, setEditingClient] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [headerName, setHeaderName] = useState("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // Cette fonction sera remplie par l'onglet "Informations" pour déclencher l'enregistrement
  const [saveCurrentFn, setSaveCurrentFn] = useState<(() => Promise<any>) | null>(null)

  // 1. Chargement des données au montage/ouverture
  useEffect(() => {
    if (open && clientId) {
      loadClientData()
    } else if (open && !clientId) {
      setEditingClient(null)
      setHeaderName("Nouveau client")
      setHasUnsavedChanges(false)
    }
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
      setHeaderName(data.nom)
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

  // Action de sauvegarde principale
  const handleMainSave = async () => {
    if (saveCurrentFn) {
      const result = await saveCurrentFn()
      if (result) {
        setHasUnsavedChanges(false)
        onRefresh()
        // On ne ferme pas forcément la fenêtre après save, sauf si c'est une création
        if (!clientId) onOpenChange(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && hasUnsavedChanges) {
        if (confirm("Vous avez des modifications non enregistrées. Quitter ?")) {
          onOpenChange(false)
        }
      } else {
        onOpenChange(val)
      }
    }}>
      {/* Le pointer-events-auto ici est crucial pour que les futurs pop-ups de confirmation 
          ne soient pas bloqués par cette fenêtre 
      */}
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-none shadow-2xl">
        
        {/* Header - Identique à ton design */}
        <DialogHeader className="px-6 py-4 bg-white border-b border-gray-100 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#840404]/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#840404]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">
                {headerName || "Chargement..."}
              </DialogTitle>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                {clientId ? "Édition du client" : "Création d'établissement"}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Corps de la fiche avec tes onglets */}
        <div className="flex-1 overflow-hidden">
          <ClientFormTabs
            initialData={editingClient}
            onSaveInfos={async (data) => {
              // Cette partie sera appelée par le formulaire
              return null 
            }}
            setHasUnsavedChanges={setHasUnsavedChanges}
            registerSaveCurrent={(fn) => setSaveCurrentFn(() => fn)}
            onHeaderNameChange={setHeaderName}
          />
        </div>

        {/* Footer avec boutons */}
        <DialogFooter className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
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
  )
}