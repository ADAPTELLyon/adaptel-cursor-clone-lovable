import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, UserCheck, UserX } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { AjoutSuiviCandidatDialog } from "./AjoutSuiviCandidatDialog"

// On utilise 'any' ici temporairement pour les tables pour forcer la compilation
export function ClientSuiviTab({ clientId, secteurs, services }: any) {
  const [suivis, setSuivis] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"priorite" | "interdiction">("priorite")

  useEffect(() => {
    if (clientId) fetchSuivis()
  }, [clientId])

  async function fetchSuivis() {
    // Utilisation de .from<any> pour éviter l'erreur de typage sur le nom de la table
    const { data, error } = await (supabase as any)
      .from("suivi_candidats_clients") 
      .select(`
        id,
        candidat_id,
        type,
        commentaire,
        candidats (nom, prenom)
      `)
      .eq("client_id", clientId)

    if (error) {
      console.error("Erreur fetchSuivis:", error)
      return
    }
    setSuivis(data || [])
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce suivi ?")) return
    const { error } = await (supabase as any).from("suivi_candidats_clients").delete().eq("id", id)
    if (!error) {
      toast({ title: "Suivi supprimé" })
      fetchSuivis()
    }
  }

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-gray-900">Candidats prioritaires</h3>
          </div>
          <Button size="sm" onClick={() => { setDialogType("priorite"); setDialogOpen(true); }} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-1" /> Ajouter
          </Button>
        </div>
        <div className="grid gap-2">
          {suivis.filter(s => s.type === "priorite").map(s => (
            <div key={s.id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
              <span className="font-medium">{s.candidats?.prenom} {s.candidats?.nom}</span>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}><Trash2 className="w-4 h-4 text-gray-400" /></Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-gray-900">Candidats interdits</h3>
          </div>
          <Button size="sm" onClick={() => { setDialogType("interdiction"); setDialogOpen(true); }} className="bg-red-600 hover:bg-red-700">
            <Plus className="w-4 h-4 mr-1" /> Ajouter
          </Button>
        </div>
        <div className="grid gap-2">
          {suivis.filter(s => s.type === "interdiction").map(s => (
            <div key={s.id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
              <span className="font-medium">{s.candidats?.prenom} {s.candidats?.nom}</span>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}><Trash2 className="w-4 h-4 text-gray-400" /></Button>
            </div>
          ))}
        </div>
      </div>

      <AjoutSuiviCandidatDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        clientId={clientId}
        secteurs={secteurs}
        services={services}
        type={dialogType}
        onSaved={fetchSuivis}
      />
    </div>
  )
}