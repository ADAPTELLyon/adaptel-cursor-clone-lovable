import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { Plus, Trash2, UserCheck, UserX, Pencil } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { AjoutSuiviCandidatDialog } from "./AjoutSuiviCandidatDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

type Props = {
  clientId: string
  secteurs: string[]
  services: string[]
}

type SuiviRow = {
  id: string
  client_id: string
  candidat_id: string
  type: "priorite" | "interdiction"
  secteur: string | null
  service: string | null
  commentaire: string | null
  actif: boolean | null
  created_at: string | null
  created_by: string | null
  candidat?: { nom?: string | null; prenom?: string | null } | null
  user?: { prenom?: string | null } | null
}

function fullName(item: SuiviRow) {
  const p = (item.candidat?.prenom || "").trim()
  const n = (item.candidat?.nom || "").trim()
  return `${p} ${n}`.trim()
}

export function ClientSuiviTab({ clientId, secteurs, services }: Props) {
  const [prioritaires, setPrioritaires] = useState<SuiviRow[]>([])
  const [interdits, setInterdits] = useState<SuiviRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"priorite" | "interdiction">("priorite")
  const [search, setSearch] = useState("")

  // --- Edition (sans toucher au popup Ajout) ---
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<SuiviRow | null>(null)
  const [editSecteur, setEditSecteur] = useState<string>("")
  const [editService, setEditService] = useState<string>("")
  const [editCommentaire, setEditCommentaire] = useState<string>("")
  const [savingEdit, setSavingEdit] = useState(false)

  const fetchSuivis = async () => {
    if (!clientId) return

    const { data, error } = await supabase
      .from("interdictions_priorites")
      .select(
        `
        id, client_id, candidat_id, type, secteur, service, commentaire, actif, created_at, created_by,
        candidat:candidat_id(nom, prenom),
        user:created_by(prenom)
      `
      )
      .eq("client_id", clientId)
      .eq("actif", true)

    if (error) {
      console.error("Erreur fetchSuivis (client):", error)
      toast({
        title: "Erreur",
        description: "Impossible de charger le suivi candidats.",
        variant: "destructive",
      })
      setPrioritaires([])
      setInterdits([])
      return
    }

    const rows = (data || []) as unknown as SuiviRow[]
    setPrioritaires(rows.filter((r) => r.type === "priorite"))
    setInterdits(rows.filter((r) => r.type === "interdiction"))
  }

  useEffect(() => {
    fetchSuivis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const filteredPrioritaires = useMemo(() => {
    const q = (search || "").toLowerCase().trim()
    if (!q) return prioritaires
    return prioritaires.filter((it) => fullName(it).toLowerCase().includes(q))
  }, [prioritaires, search])

  const filteredInterdits = useMemo(() => {
    const q = (search || "").toLowerCase().trim()
    if (!q) return interdits
    return interdits.filter((it) => fullName(it).toLowerCase().includes(q))
  }, [interdits, search])

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cet élément de suivi ?")) return

    const { error } = await supabase
      .from("interdictions_priorites")
      .update({ actif: false, updated_at: new Date().toISOString() } as never)
      .eq("id", id)

    if (error) {
      console.error("Erreur delete suivi:", error)
      toast({ title: "Erreur", description: "Suppression échouée", variant: "destructive" })
      return
    }

    toast({ title: "Supprimé" })
    fetchSuivis()
  }

  const openEdit = (item: SuiviRow) => {
    setEditing(item)
    setEditSecteur(item.secteur || "")
    setEditService(item.service || "")
    setEditCommentaire(item.commentaire || "")
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editing?.id) return
    setSavingEdit(true)
    try {
      const payload = {
        secteur: editSecteur || null,
        service: editService || null,
        commentaire: editCommentaire || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("interdictions_priorites")
        .update(payload as never)
        .eq("id", editing.id)

      if (error) {
        console.error("Erreur update suivi:", error)
        toast({ title: "Erreur", description: "Mise à jour échouée", variant: "destructive" })
        return
      }

      toast({ title: "Modifié" })
      setEditOpen(false)
      setEditing(null)
      await fetchSuivis()
    } finally {
      setSavingEdit(false)
    }
  }

  const renderItem = (item: SuiviRow, tone: "green" | "red") => {
    const name = fullName(item) || "Candidat"
    const dateLabel =
      item.created_at ? format(new Date(item.created_at), "dd MMMM yyyy", { locale: fr }) : "—"

    return (
      <li key={item.id} className="rounded-xl border border-gray-200 bg-white shadow-sm p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{name}</div>

            <div className="text-xs text-gray-600 mt-0.5">
              {(item.secteur || "").trim()}
              {item.service ? ` • ${item.service}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(item)}
              className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(item.id)}
              className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {item.commentaire ? (
          <div className="text-sm italic text-gray-800">{item.commentaire}</div>
        ) : (
          <div className="text-sm text-gray-400 italic">Aucun commentaire</div>
        )}

        <div className="text-xs text-gray-500 pt-1">
          Créé le {dateLabel} par {item.user?.prenom || "Inconnu"}
        </div>

        <div className="pt-1">
          <span
            className={[
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
              tone === "green"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200",
            ].join(" ")}
          >
            {tone === "green" ? "Prioritaire" : "Interdiction"}
          </span>
        </div>
      </li>
    )
  }

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      {/* BARRE FIXE (plus de scroll global qui la fait disparaître) */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="w-full max-w-sm">
            <Input
              placeholder="Rechercher un candidat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 2 COLONNES avec scroll interne uniquement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* PRIORITAIRES */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b bg-white rounded-t-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold flex items-center gap-2 text-gray-900">
                <UserCheck className="h-5 w-5 text-green-600" />
                Candidats prioritaires
              </h3>

              <Button
                size="sm"
                onClick={() => {
                  setDialogType("priorite")
                  setDialogOpen(true)
                }}
                className="bg-green-600 hover:bg-green-700 gap-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>
          </div>

          <div className="p-4 flex-1 min-h-0">
            <ul className="space-y-3 overflow-y-auto h-full pr-2">
              {filteredPrioritaires.map((it) => renderItem(it, "green"))}
              {filteredPrioritaires.length === 0 ? (
                <li className="text-sm text-gray-500 italic text-center py-6">
                  Aucun candidat prioritaire
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        {/* INTERDITS */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b bg-white rounded-t-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold flex items-center gap-2 text-gray-900">
                <UserX className="h-5 w-5 text-red-600" />
                Candidats interdits
              </h3>

              <Button
                size="sm"
                onClick={() => {
                  setDialogType("interdiction")
                  setDialogOpen(true)
                }}
                className="bg-red-600 hover:bg-red-700 gap-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>
          </div>

          <div className="p-4 flex-1 min-h-0">
            <ul className="space-y-3 overflow-y-auto h-full pr-2">
              {filteredInterdits.map((it) => renderItem(it, "red"))}
              {filteredInterdits.length === 0 ? (
                <li className="text-sm text-gray-500 italic text-center py-6">
                  Aucun candidat interdit
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>

      {/* DIALOG AJOUT (inchangé) */}
      <AjoutSuiviCandidatDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        clientId={clientId}
        secteurs={secteurs}
        services={services}
        type={dialogType}
        onSaved={fetchSuivis}
      />

      {/* DIALOG EDIT (simple, fiable) */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          if (!o) {
            setEditOpen(false)
            setEditing(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Modifier suivi — {editing ? fullName(editing) : ""}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Tu modifies uniquement les infos utiles (secteur / service / commentaire).
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Secteur</Label>
                <select
                  className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                  value={editSecteur}
                  onChange={(e) => setEditSecteur(e.target.value)}
                >
                  <option value="">— Non précisé —</option>
                  {(secteurs || []).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Service</Label>
                <select
                  className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                  value={editService}
                  onChange={(e) => setEditService(e.target.value)}
                >
                  <option value="">— Non précisé —</option>
                  {(services || []).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Commentaire</Label>
              <textarea
                value={editCommentaire}
                onChange={(e) => setEditCommentaire(e.target.value)}
                placeholder="Ajouter un commentaire…"
                className="w-full rounded-md border border-gray-300 p-3 text-sm resize-none h-24 bg-white focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditOpen(false)
                setEditing(null)
              }}
              disabled={savingEdit}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={saveEdit}
              disabled={savingEdit}
              className="bg-[#840404] hover:bg-[#6a0303]"
            >
              {savingEdit ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
