// src/components/agent/AgentPanel.tsx
import { useMemo, useState } from "react"
import { useAgent } from "@/hooks/useAgent"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export default function AgentPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { reminders, events, addReminder, addEvent, me } = useAgent()
  const [tab, setTab] = useState<"reminders" | "notes">("reminders")

  // Form reminder
  const [dueAt, setDueAt] = useState("")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [audience, setAudience] = useState<"all" | "user" | "list">("user")
  const [userIdsCsv, setUserIdsCsv] = useState("")
  const [urgent, setUrgent] = useState(false)

  // Form note/event
  const [typeEvt, setTypeEvt] = useState<"note" | "incident" | "indispo" | "preference" | "memo" | "autre">("note")
  const [text, setText] = useState("")
  const [candidatId, setCandidatId] = useState("")
  const [clientId, setClientId] = useState("")
  const [siteId, setSiteId] = useState("")
  const [secteur, setSecteur] = useState("")
  const [dateEvt, setDateEvt] = useState("")
  const [startEvt, setStartEvt] = useState("")
  const [endEvt, setEndEvt] = useState("")

  const myName = useMemo(() => (me ? `${me.prenom} ${me.nom}` : "Moi"), [me])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white/90 backdrop-blur">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Agent — ADAPTEL Lyon</h3>
            <div className="flex border rounded-full overflow-hidden">
              <button
                className={cn(
                  "px-3 py-1 text-sm",
                  tab === "reminders" ? "bg-black text-white" : "bg-white"
                )}
                onClick={() => setTab("reminders")}
              >
                Rappels
              </button>
              <button
                className={cn(
                  "px-3 py-1 text-sm",
                  tab === "notes" ? "bg-black text-white" : "bg-white"
                )}
                onClick={() => setTab("notes")}
              >
                Notes
              </button>
            </div>
          </div>
          <button
            className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
            onClick={onClose}
            aria-label="Fermer le panneau Agent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {tab === "reminders" && (
          <div className="flex-1 overflow-auto p-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
              <Input
                placeholder="Titre du rappel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="md:col-span-2"
              />
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as any)}
                className="border rounded-md px-2 py-2"
              >
                <option value="user">Utilisateur(s)</option>
                <option value="all">Tous</option>
                <option value="list">Liste (UUIDs)</option>
              </select>

              <Input
                placeholder="Contenu (optionnel)"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="md:col-span-4"
              />

              {audience !== "all" && (
                <Input
                  placeholder="UUID(s) utilisateurs, séparés par des virgules"
                  value={userIdsCsv}
                  onChange={(e) => setUserIdsCsv(e.target.value)}
                  className="md:col-span-4"
                />
              )}

              <label className="flex items-center gap-2 text-sm text-gray-600 md:col-span-4">
                <input
                  type="checkbox"
                  checked={urgent}
                  onChange={(e) => setUrgent(e.target.checked)}
                />
                Urgent (mise en valeur / auto-notif côté UI)
              </label>

              <Button
                className="md:col-span-4 bg-[#840404] hover:bg-[#750303] text-white"
                onClick={async () => {
                  if (!title.trim() || !dueAt) return
                  const ids =
                    audience === "all"
                      ? []
                      : userIdsCsv
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                  await addReminder({
                    title,
                    body: body || null,
                    due_at: new Date(dueAt).toISOString(),
                    audience,
                    user_ids: ids,
                    id: "" as any, // ignoré par Omit
                    created_at: "" as any, // ignoré par Omit
                    created_by: null as any, // ignoré par Omit
                    status: "pending" as any, // ignoré par Omit
                    urgent,
                  } as any) // cast souple pour éviter les TS2589 si types générés stricts
                  setTitle("")
                  setBody("")
                  setDueAt("")
                  setAudience("user")
                  setUserIdsCsv("")
                  setUrgent(false)
                }}
              >
                Créer le rappel
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              {reminders.length === 0 && (
                <div className="text-sm text-gray-500">Aucun rappel à venir.</div>
              )}
              {reminders.map((r) => (
                <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.title}</div>
                    {r.body && <div className="text-sm text-gray-600 truncate">{r.body}</div>}
                    <div className="text-xs text-gray-500">
                      Échéance : {new Date(r.due_at).toLocaleString()} • Audience : {r.audience}
                      {r.urgent ? " • URGENT" : ""}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{r.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "notes" && (
          <div className="flex-1 overflow-auto p-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
              <select
                value={typeEvt}
                onChange={(e) => setTypeEvt(e.target.value as any)}
                className="border rounded-md px-2 py-2"
              >
                <option value="note">Note</option>
                <option value="incident">Incident</option>
                <option value="indispo">Indisponibilité</option>
                <option value="preference">Préférence</option>
                <option value="memo">Mémo</option>
                <option value="autre">Autre</option>
              </select>

              <Input placeholder="Candidat ID (optionnel)" value={candidatId} onChange={(e) => setCandidatId(e.target.value)} />
              <Input placeholder="Client ID (optionnel)" value={clientId} onChange={(e) => setClientId(e.target.value)} />
              <Input placeholder="Établissement / Site ID (optionnel)" value={siteId} onChange={(e) => setSiteId(e.target.value)} />

              <Input placeholder="Secteur (optionnel)" value={secteur} onChange={(e) => setSecteur(e.target.value)} className="md:col-span-2" />
              <Input type="date" value={dateEvt} onChange={(e) => setDateEvt(e.target.value)} />
              <Input type="datetime-local" value={startEvt} onChange={(e) => setStartEvt(e.target.value)} />
              <Input type="datetime-local" value={endEvt} onChange={(e) => setEndEvt(e.target.value)} />

              <Input
                placeholder="Texte / Détails"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="md:col-span-4"
              />

              <Button
                className="md:col-span-4 bg-[#840404] hover:bg-[#750303] text-white"
                onClick={async () => {
                  if (!text.trim()) return
                  const entities: any = {}
                  if (candidatId) entities.candidat_id = candidatId
                  if (clientId) entities.client_id = clientId
                  if (siteId) entities.site_id = siteId
                  if (secteur) entities.secteur = secteur

                  const time_scope: any = {}
                  if (dateEvt) time_scope.date = dateEvt
                  if (startEvt) time_scope.start = new Date(startEvt).toISOString()
                  if (endEvt) time_scope.end = new Date(endEvt).toISOString()

                  await addEvent({
                    type: typeEvt,
                    text,
                    entities: Object.keys(entities).length ? entities : null,
                    time_scope: Object.keys(time_scope).length ? time_scope : null,
                    payload: null,
                    visibility: "all",
                    visible_user_ids: [],
                    id: "" as any, // ignoré par Omit
                    created_at: "" as any, // ignoré par Omit
                    created_by: null as any, // ignoré par Omit
                  } as any)

                  setText("")
                  setCandidatId("")
                  setClientId("")
                  setSiteId("")
                  setSecteur("")
                  setDateEvt("")
                  setStartEvt("")
                  setEndEvt("")
                  setTypeEvt("note")
                }}
              >
                Enregistrer la note
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              {events.length === 0 && (
                <div className="text-sm text-gray-500">Aucune note pour le moment.</div>
              )}
              {events.map((n) => (
                <div key={n.id} className="border rounded-lg p-3">
                  <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <span className="uppercase">{n.type}</span>
                    {n.entities?.candidat_id && (<><span>•</span><span>Cand: {n.entities.candidat_id}</span></>)}
                    {n.entities?.client_id && (<><span>•</span><span>Client: {n.entities.client_id}</span></>)}
                    {n.entities?.site_id && (<><span>•</span><span>Site: {n.entities.site_id}</span></>)}
                    {n.entities?.secteur && (<><span>•</span><span>Secteur: {n.entities.secteur}</span></>)}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{n.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
