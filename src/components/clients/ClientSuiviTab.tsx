import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { Plus, Trash2, Pencil, UserCheck, UserX } from "lucide-react"
import { AjoutSuiviCandidatDialog } from "./AjoutSuiviCandidatDialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type SuiviItem = {
  id: string
  candidat_id: string
  type: "priorite" | "interdiction"
  commentaire: string | null
  secteur: string | null
  service: string | null
  created_at: string | null
  created_by: string | null
  actif: boolean
  candidat?: { nom?: string | null; prenom?: string | null } | null
  user?: { prenom?: string | null } | null
}

type Props = {
  clientId: string
  secteurs: string[]
  services: string[]
}

const SERVICE_NONE = "__NONE__"

const prettyLabel = (v: string) => {
  const s = (v || "").trim()
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const cleanList = (list: string[]) =>
  (list || []).map((x) => (x || "").trim()).filter((x) => x.length > 0)

export function ClientSuiviTab({ clientId, secteurs, services }: Props) {
  const [items, setItems] = useState<SuiviItem[]>([])
  const [loading, setLoading] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"priorite" | "interdiction">("priorite")

  const [search, setSearch] = useState("")

  // Edition
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<SuiviItem | null>(null)
  const [editSecteur, setEditSecteur] = useState("")
  const [editService, setEditService] = useState<string>(SERVICE_NONE)
  const [editCommentaire, setEditCommentaire] = useState("")

  // ✅ Confirm suppression (popup app)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SuiviItem | null>(null)

  const secteursClean = useMemo(() => cleanList(secteurs), [secteurs])
  const servicesClean = useMemo(() => cleanList(services), [services])

  const loadData = async () => {
    if (!clientId) return
    setLoading(true)

    const { data, error } = await supabase
      .from("interdictions_priorites")
      .select(`
        id, candidat_id, type, commentaire, secteur, service, created_at, created_by, actif,
        candidat:candidat_id(nom, prenom),
        user:created_by(prenom)
      `)
      .eq("client_id", clientId)
      .eq("actif", true)
      .order("created_at", { ascending: false })

    setLoading(false)

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger le suivi candidats.",
        variant: "destructive",
      })
      return
    }

    setItems((data || []) as unknown as SuiviItem[])
  }

  useEffect(() => {
    if (clientId) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items

    return items.filter((it) => {
      const nom = `${it.candidat?.prenom || ""} ${it.candidat?.nom || ""}`.toLowerCase()
      const sec = (it.secteur || "").toLowerCase()
      const srv = (it.service || "").toLowerCase()
      const com = (it.commentaire || "").toLowerCase()
      return nom.includes(q) || sec.includes(q) || srv.includes(q) || com.includes(q)
    })
  }, [items, search])

  const prioritaires = filtered.filter((d) => d.type === "priorite")
  const interdits = filtered.filter((d) => d.type === "interdiction")

  const openCreate = (type: "priorite" | "interdiction") => {
    setDialogType(type)
    setDialogOpen(true)
  }

  const openEdit = (it: SuiviItem) => {
    setEditing(it)
    setEditSecteur(it.secteur || "")
    setEditService(it.service ? it.service : SERVICE_NONE) // ✅ plus de ""
    setEditCommentaire(it.commentaire || "")
    setEditOpen(true)
  }

  // ✅ Pop-up suppression interne
  const askDelete = (it: SuiviItem) => {
    setDeleteTarget(it)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return

    const { error } = await supabase
      .from("interdictions_priorites")
      .update({ actif: false, updated_at: new Date().toISOString() } as never)
      .eq("id", deleteTarget.id)

    if (error) {
      toast({ title: "Erreur", description: "Suppression échouée", variant: "destructive" })
      return
    }

    toast({ title: "Supprimé" })
    setDeleteOpen(false)
    setDeleteTarget(null)
    loadData()
  }

  const handleSaveEdit = async () => {
    if (!editing?.id) return

    if (!editSecteur) {
      toast({
        title: "Erreur",
        description: "Le secteur est obligatoire.",
        variant: "destructive",
      })
      return
    }

    const serviceToSave = editService === SERVICE_NONE ? null : editService

    const { error } = await supabase
      .from("interdictions_priorites")
      .update({
        secteur: editSecteur,
        service: serviceToSave,
        commentaire: editCommentaire || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editing.id)

    if (error) {
      toast({ title: "Erreur", description: "Mise à jour échouée", variant: "destructive" })
      return
    }

    toast({ title: "Modifié" })
    setEditOpen(false)
    setEditing(null)
    loadData()
  }

  const renderCard = (it: SuiviItem, tone: "green" | "red") => {
    const nom = `${it.candidat?.prenom || ""} ${it.candidat?.nom || ""}`.trim() || "Candidat"
    const dateTxt = it.created_at
      ? format(new Date(it.created_at), "dd MMM yyyy", { locale: fr })
      : null

    return (
      <div
        key={it.id}
        className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:border-gray-300 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{nom}</div>

            <div className="mt-1 flex flex-wrap gap-2">
              {it.secteur ? (
                <Badge
                  variant="outline"
                  className={
                    tone === "green"
                      ? "rounded-md bg-green-50 text-green-800 border-green-200"
                      : "rounded-md bg-red-50 text-red-800 border-red-200"
                  }
                >
                  {prettyLabel(it.secteur)}
                </Badge>
              ) : null}

              {it.service ? (
                <Badge variant="outline" className="rounded-md bg-gray-50 text-gray-700 border-gray-200">
                  {prettyLabel(it.service)}
                </Badge>
              ) : null}
            </div>

            <div className="mt-2 text-sm">
              {it.commentaire ? (
                <div className="italic text-gray-800 break-words">{it.commentaire}</div>
              ) : (
                <div className="italic text-gray-400">Aucun commentaire</div>
              )}
            </div>

            <div className="mt-2 text-xs text-gray-500">
              {dateTxt ? (
                <>
                  Créé le {dateTxt}{" "}
                  {it.user?.prenom ? <>par {it.user.prenom}</> : null}
                </>
              ) : null}
            </div>
          </div>

          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 text-gray-600 hover:text-gray-900"
              onClick={() => openEdit(it)}
              disabled={loading}
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 text-gray-600 hover:text-red-600"
              onClick={() => askDelete(it)} // ✅ plus confirm()
              disabled={loading}
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Recherche */}
      <div className="sticky top-0 z-10 bg-white pb-3">
        <Input
          placeholder="Rechercher un candidat, un secteur, un service, un commentaire..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10"
        />
      </div>

      <div className="flex gap-4 max-h-[560px] overflow-auto">
        {/* PRIORITAIRES */}
        <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4 min-w-[320px]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-600" />
              <div className="font-semibold text-gray-900">Candidats prioritaires</div>
              <Badge className="ml-1 rounded-md bg-white border border-gray-200 text-gray-700">
                {prioritaires.length}
              </Badge>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => openCreate("priorite")}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </div>

          <Separator className="mb-3" />

          <div className="space-y-3 overflow-y-auto max-h-[470px] pr-1">
            {prioritaires.length === 0 ? (
              <div className="text-sm text-gray-500 italic text-center py-6">
                Aucun candidat prioritaire.
              </div>
            ) : (
              prioritaires.map((it) => renderCard(it, "green"))
            )}
          </div>
        </div>

        {/* INTERDITS */}
        <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4 min-w-[320px]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-600" />
              <div className="font-semibold text-gray-900">Candidats interdits</div>
              <Badge className="ml-1 rounded-md bg-white border border-gray-200 text-gray-700">
                {interdits.length}
              </Badge>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => openCreate("interdiction")}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </div>

          <Separator className="mb-3" />

          <div className="space-y-3 overflow-y-auto max-h-[470px] pr-1">
            {interdits.length === 0 ? (
              <div className="text-sm text-gray-500 italic text-center py-6">
                Aucun candidat interdit.
              </div>
            ) : (
              interdits.map((it) => renderCard(it, "red"))
            )}
          </div>
        </div>
      </div>

      {/* POPUP CREATION */}
      <AjoutSuiviCandidatDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        clientId={clientId}
        secteurs={secteurs}
        services={services}
        type={dialogType}
        onSaved={loadData}
      />

      {/* POPUP MODIFICATION */}
      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          if (!v) {
            setEditOpen(false)
            setEditing(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le suivi</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">
                {(editing?.candidat?.prenom || "")} {(editing?.candidat?.nom || "")}
              </span>
              {editing?.type ? (
                <span className="ml-2 text-xs text-gray-500">
                  ({editing.type === "priorite" ? "Prioritaire" : "Interdit"})
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Secteur *</Label>
              <Select value={editSecteur} onValueChange={setEditSecteur}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Sélectionner un secteur" />
                </SelectTrigger>
                <SelectContent>
                  {(secteursClean || []).map((s) => (
                    <SelectItem key={s} value={s}>
                      {prettyLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {servicesClean?.length ? (
              <div className="space-y-2">
                <Label>Service (facultatif)</Label>
                <Select value={editService} onValueChange={setEditService}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Sélectionner un service" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* ✅ Radix: pas de value="" */}
                    <SelectItem value={SERVICE_NONE}>— Aucun —</SelectItem>
                    {servicesClean.map((s) => (
                      <SelectItem key={s} value={s}>
                        {prettyLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Commentaire (facultatif)</Label>
              <Textarea value={editCommentaire} onChange={(e) => setEditCommentaire(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveEdit} className="bg-[#840404] hover:bg-[#6a0303]">
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ CONFIRM SUPPRESSION (popup app) */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(v) => {
          setDeleteOpen(v)
          if (!v) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cet élément sera désactivé (historique conservé).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
