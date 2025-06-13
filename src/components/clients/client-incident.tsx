import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Trash2, User, Pencil, Save, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

type Incident = {
  id: string
  type_incident: string
  description?: string
  date_incident: string
  created_by: string
  candidat_id: string
  mise_en_interdiction?: boolean
}

type Candidat = {
  id: string
  nom: string
  prenom: string
}

type Utilisateur = {
  id: string
  nom: string
  prenom: string
}

type ClientIncidentsTabProps = {
  clientId: string
}

export function ClientIncidentsTab({ clientId }: ClientIncidentsTabProps) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [users, setUsers] = useState<Record<string, string>>({})
  const [candidats, setCandidats] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, { type: string; description: string }>>({})

  const loadIncidents = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("incidents")
      .select("*")
      .eq("client_id", clientId)
      .order("date_incident", { ascending: false })

    if (error || !data) {
      toast({ title: "Erreur chargement incidents", variant: "destructive" })
      setLoading(false)
      return
    }

    setIncidents(data)

    // Récupérer noms candidats
    const candidatIds = Array.from(new Set(data.map(i => i.candidat_id)))
    const { data: candidatsData } = await supabase
      .from("candidats")
      .select("id, nom, prenom")
      .in("id", candidatIds)

    const mapCandidats: Record<string, string> = {}
    candidatsData?.forEach((c: Candidat) => {
      mapCandidats[c.id] = `${c.prenom} ${c.nom}`
    })
    setCandidats(mapCandidats)

    // Récupérer users
    const userIds = Array.from(new Set(data.map(i => i.created_by).filter(Boolean)))
    const { data: usersData } = await supabase
      .from("utilisateurs")
      .select("id, nom, prenom")
      .in("id", userIds)

    const mapUsers: Record<string, string> = {}
    usersData?.forEach((u: Utilisateur) => {
      mapUsers[u.id] = `${u.prenom} ${u.nom}`
    })
    setUsers(mapUsers)
    setLoading(false)
  }

  useEffect(() => {
    if (clientId) loadIncidents()
  }, [clientId])

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("incidents").delete().eq("id", id)
    if (error) {
      toast({ title: "Erreur suppression", variant: "destructive" })
    } else {
      toast({ title: "Incident supprimé" })
      setIncidents((prev) => prev.filter((i) => i.id !== id))
    }
  }

  const handleSaveEdit = async (id: string) => {
    const payload = {
      type_incident: editData[id]?.type || "",
      description: editData[id]?.description || "",
    }

    const { error } = await supabase.from("incidents").update(payload).eq("id", id)
    if (error) {
      toast({ title: "Erreur mise à jour", variant: "destructive" })
    } else {
      toast({ title: "Incident modifié" })
      setEditingId(null)
      loadIncidents()
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-3/4 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6 mb-4" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-gray-400 mb-2" />
          <p className="text-gray-500">Aucun incident enregistré pour ce client</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {incidents.map((incident) => {
            const isEditing = editingId === incident.id
            return (
              <Card key={incident.id} className="border shadow-sm overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base font-semibold">
                      {candidats[incident.candidat_id] || "Candidat inconnu"}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-red-600"
                        onClick={() => handleDelete(incident.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      {isEditing ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600"
                          onClick={() => handleSaveEdit(incident.id)}
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-600"
                          onClick={() => {
                            setEditingId(incident.id)
                            setEditData((prev) => ({
                              ...prev,
                              [incident.id]: {
                                type: incident.type_incident,
                                description: incident.description || "",
                              },
                            }))
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <Separator className="mb-3" />

                <CardContent>
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={editData[incident.id]?.type || ""}
                        onChange={(e) =>
                          setEditData((prev) => ({
                            ...prev,
                            [incident.id]: { ...prev[incident.id], type: e.target.value },
                          }))
                        }
                        placeholder="Type d'incident"
                        className="bg-gray-50"
                      />
                      <Textarea
                        value={editData[incident.id]?.description || ""}
                        onChange={(e) =>
                          setEditData((prev) => ({
                            ...prev,
                            [incident.id]: { ...prev[incident.id], description: e.target.value },
                          }))
                        }
                        placeholder="Description détaillée"
                        className="bg-gray-50 min-h-[100px]"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">{incident.type_incident}</h4>
                      {incident.description && (
                        <p className="text-sm text-gray-700">{incident.description}</p>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex justify-between items-center pt-0">
                  <div className="text-xs text-gray-500">
                    {format(new Date(incident.date_incident), "EEEE dd MMMM yyyy", { locale: fr })}
                  </div>
                  <Badge variant="outline" className="gap-1 text-xs">
                    <User className="w-3 h-3" />
                    {users[incident.created_by] || "Utilisateur inconnu"}
                  </Badge>
                </CardFooter>

                {incident.mise_en_interdiction && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="destructive" className="text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Interdiction
                    </Badge>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}