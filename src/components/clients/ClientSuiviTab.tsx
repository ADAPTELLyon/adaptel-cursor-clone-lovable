import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import { Plus, Pencil, Trash2, Ban, FileCheck2 } from "lucide-react"
import { AjoutSuiviCandidatDialog } from "./AjoutSuiviCandidatDialog"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Input } from "@/components/ui/input"
import type { InterdictionPriorite } from "@/types/types-front"

type Props = {
  clientId: string
  secteurs: string[]
  services: string[]
}

export function ClientSuiviTab({ clientId, secteurs, services }: Props) {
  const [prioritaires, setPrioritaires] = useState<InterdictionPriorite[]>([])
  const [interdits, setInterdits] = useState<InterdictionPriorite[]>([])
  const [showDialog, setShowDialog] = useState<false | "priorite" | "interdiction">(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [commentaireTemp, setCommentaireTemp] = useState("")
  const [search, setSearch] = useState("")

  const loadData = async () => {
    const { data, error } = await supabase
      .from("interdictions_priorites")
      .select(`
        id, secteur, service, commentaire, type, created_at, created_by, actif,
        candidat:candidat_id(nom,prenom),
        user:created_by(prenom)
      `)
      .eq("client_id", clientId)
      .eq("actif", true)

    if (error) {
      toast({ title: "Erreur", description: "Chargement échoué", variant: "destructive" })
      return
    }

    const propres = data as InterdictionPriorite[]
    setPrioritaires(propres.filter((d) => d.type === "priorite"))
    setInterdits(propres.filter((d) => d.type === "interdiction"))
  }

  useEffect(() => {
    if (clientId) loadData()
  }, [clientId])

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("interdictions_priorites")
      .update({
        actif: false,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id)

    if (error) {
      toast({ title: "Erreur", description: "Suppression échouée", variant: "destructive" })
    } else {
      toast({ title: "Supprimé" })
      loadData()
    }
  }

  const handleUpdateComment = async (id: string) => {
    const { error } = await supabase
      .from("interdictions_priorites")
      .update({ commentaire: commentaireTemp, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      toast({ title: "Erreur", description: "Mise à jour échouée", variant: "destructive" })
    } else {
      toast({ title: "Commentaire modifié" })
      setEditingCommentId(null)
      setCommentaireTemp("")
      loadData()
    }
  }

  const renderCarte = (item: InterdictionPriorite) => {
    const nom = (item as any)?.candidat?.nom?.toLowerCase() || ""
    const prenom = (item as any)?.candidat?.prenom?.toLowerCase() || ""
    if (!`${prenom} ${nom}`.includes(search.toLowerCase())) return null

    return (
      <li key={item.id} className="border rounded p-3 text-sm bg-white shadow-sm space-y-2 relative">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold text-base">{item.candidat?.prenom} {item.candidat?.nom}</div>
            <div className="text-xs text-gray-600">{item.secteur}{item.service ? ` • ${item.service}` : ""}</div>
          </div>
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-gray-500 hover:text-black cursor-pointer" onClick={() => {
              setEditingCommentId(item.id)
              setCommentaireTemp(item.commentaire || "")
            }} />
            <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700 cursor-pointer" onClick={() => handleDelete(item.id)} />
          </div>
        </div>
        {editingCommentId === item.id ? (
          <div className="flex items-center gap-2">
            <Input value={commentaireTemp} onChange={(e) => setCommentaireTemp(e.target.value)} className="text-sm" />
            <Button size="sm" onClick={() => handleUpdateComment(item.id)}>Valider</Button>
          </div>
        ) : item.commentaire ? (
          <div className="text-sm italic text-gray-800">{item.commentaire}</div>
        ) : (
          <div className="text-sm text-gray-400 italic">Aucun commentaire</div>
        )}
        <div className="text-xs text-gray-500 pt-1">
          Créé le {format(new Date(item.created_at || ""), "dd MMMM yyyy", { locale: fr })} par {item.user?.prenom || "Inconnu"}
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-8">
      <div className="mt-2">
        <Input
          placeholder="Rechercher un candidat..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
        />
      </div>

      <div className="flex gap-4 max-h-[500px] overflow-auto">
        <div className="flex-1 border rounded p-4 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-green-600" />
              Candidats prioritaires
            </h3>
            <Button variant="outline" onClick={() => setShowDialog("priorite")}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>
          <ul className="space-y-2 overflow-y-auto max-h-[400px] pr-2">
            {prioritaires.map(renderCarte)}
          </ul>
        </div>

        <div className="flex-1 border rounded p-4 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-600" />
              Candidats interdits
            </h3>
            <Button variant="outline" onClick={() => setShowDialog("interdiction")}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>
          <ul className="space-y-2 overflow-y-auto max-h-[400px] pr-2">
            {interdits.map(renderCarte)}
          </ul>
        </div>
      </div>

      <AjoutSuiviCandidatDialog
        open={!!showDialog}
        type={showDialog || "priorite"}
        onClose={() => setShowDialog(false)}
        clientId={clientId}
        secteurs={secteurs}
        services={services}
        onSaved={loadData}
      />
    </div>
  )
}
