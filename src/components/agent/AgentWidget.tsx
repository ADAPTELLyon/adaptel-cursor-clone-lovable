import React, { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAgent, type AgentReminder } from "@/hooks/useAgent"
import { Button } from "@/components/ui/button"
import { X, Send, Check, Clock, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

type AgentChoice = { label: string; value?: string; kind?: "client" | "candidat" | "user" | "time"; payload?: any }
type AgentReply = {
  ok: boolean
  reply: string
  choices?: AgentChoice[]
  cards?: any[]
  reminders?: any[]
  meta?: any
}

type ChatMsg = {
  id: string
  role: "user" | "agent"
  text: string
  choices?: AgentChoice[]
  cards?: any[]
}

export default function AgentWidget({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"chat" | "reminders">("chat")
  const { reminders, reloadReminders, me } = useAgent()

  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)

  // garde en mémoire un "need_time" renvoyé par le backend (title + base_date_iso)
  const needTimeRef = useRef<{ title: string; base_date_iso: string } | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [msgs, open])

  // ---------- Historique par utilisateur (localStorage) ----------
  const STORAGE_KEY = me?.id ? `agent_chat_${me.id}` : `agent_chat_anonymous`
  const LAST_SESSION_KEY = me?.id ? `agent_last_session_${me.id}` : `agent_last_session_anonymous`
  const didLoadHistory = useRef(false)

  // Reset quotidien + chargement
  useEffect(() => {
    if (!me || didLoadHistory.current) return
    didLoadHistory.current = true
    try {
      const last = localStorage.getItem(LAST_SESSION_KEY)
      const today = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })
      if (last !== today) {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.setItem(LAST_SESSION_KEY, today)
      }

      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMsg[]
        if (Array.isArray(parsed) && parsed.length) {
          setMsgs(parsed)
          return
        }
      }
      const hello = `Bonjour${me?.prenom ? ` ${me.prenom}` : ""} !\nQu’est-ce que je peux faire pour toi ?`
      pushAgent(hello)
    } catch {
      const hello = `Bonjour${me?.prenom ? ` ${me.prenom}` : ""} !\nQu’est-ce que je peux faire pour toi ?`
      pushAgent(hello)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id])

  // persiste l'historique
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs))
    } catch {}
  }, [msgs, STORAGE_KEY])

  function pushAgent(text: string, extras?: Partial<ChatMsg>) {
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "agent", text, ...(extras as any) }])
  }
  function pushUser(text: string) {
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "user", text }])
  }

  // ---- API Edge Function ----
  async function callAgentMessage(message: string): Promise<AgentReply> {
    const { data, error } = await supabase.functions.invoke("agent-chat", { body: { message } })
    if (error) return { ok: false, reply: error.message || "Erreur appel Agent." }
    return (data as AgentReply) || { ok: false, reply: "Réponse vide." }
  }
  async function callAgentFill(fill: any): Promise<AgentReply> {
    const { data, error } = await supabase.functions.invoke("agent-chat", { body: { fill } })
    if (error) return { ok: false, reply: error.message || "Erreur appel Agent." }
    return (data as AgentReply) || { ok: false, reply: "Réponse vide." }
  }

  async function handleSend(valueFromBtn?: string) {
    const value = (valueFromBtn ?? input).trim()
    if (!value) return
    setInput("")
    pushUser(value)

    // Si on a un "need_time" actif et que l'utilisateur tape une heure libre ("14:30", "14h30", "9h")
    if (needTimeRef.current) {
      const hm = value.match(/^([0-2]?\d)(?::|h)?([0-5]\d)?$/)
      if (hm) {
        setBusy(true)
        try {
          const fill = {
            action: "set_time_from_base",
            time: `${hm[1].padStart(2, "0")}:${(hm[2] || "00").padStart(2, "0")}`,
            title: needTimeRef.current.title,
            base_date_iso: needTimeRef.current.base_date_iso,
          }
          const res = await callAgentFill(fill)
          pushAgent(res.reply || "OK.", { choices: res.choices ?? [], cards: res.cards ?? [] })
          if (res.reminders && res.reminders.length) await reloadReminders()
          needTimeRef.current = null
          return
        } finally {
          setBusy(false)
        }
      }
    }

    setBusy(true)
    try {
      const res = await callAgentMessage(value)
      // si le backend nous renvoie un meta.need_time, on le stocke pour accepter une heure libre
      if (res?.meta?.need_time?.title && res?.meta?.need_time?.base_date_iso) {
        needTimeRef.current = {
          title: res.meta.need_time.title,
          base_date_iso: res.meta.need_time.base_date_iso,
        }
      } else {
        needTimeRef.current = null
      }
      pushAgent(res.reply || "OK.", { choices: res.choices ?? [], cards: res.cards ?? [] })
      if (res.reminders && res.reminders.length) await reloadReminders()
    } finally {
      setBusy(false)
    }
  }

  async function handleChoice(choice: AgentChoice) {
    // Si la choice embarque un payload → on envoie en FILL (ex: set_time_from_base)
    if (choice.payload) {
      pushUser(choice.label)
      setBusy(true)
      try {
        const res = await callAgentFill(choice.payload)
        pushAgent(res.reply || "OK.", { choices: res.choices ?? [], cards: res.cards ?? [] })
        if (res.reminders && res.reminders.length) await reloadReminders()
        needTimeRef.current = null
      } finally {
        setBusy(false)
      }
      return
    }
    // Sinon, renvoyer le label
    await handleSend(choice.label)
  }

  async function toggleReminder(r: AgentReminder) {
    await (supabase as any)
      .from("agent_reminders")
      .update({ status: r.status === "done" ? "pending" : "done" } as any)
      .eq("id", r.id)
    await reloadReminders()
  }

  function clearHistory() {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setMsgs([])
      const hello = `Bonjour${me?.prenom ? ` ${me.prenom}` : ""} !\nQu’est-ce que je peux faire pour toi ?`
      pushAgent(hello)
    } catch {}
  }

  const taRef = useRef<HTMLTextAreaElement>(null)
  function autoResize() {
    const el = taRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = Math.min(el.scrollHeight, 220) + "px"
  }
  useEffect(() => {
    autoResize()
  }, [input])

  if (!open) return null

  return (
    <div className="fixed right-6 bottom-6 z-[80]">
      <div className="w-[460px] h-[640px] rounded-2xl shadow-2xl border bg-white flex flex-col overflow-hidden">
        {/* HEADER + TABS */}
        <div className="h-12 flex items-center justify-between px-3 border-b bg-gradient-to-r from-white to-gray-50">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[#840404] text-white flex items-center justify-center font-bold">A</div>
            <div className="text-sm">
              <div className="font-semibold">Agent — ADAPTEL Lyon</div>
              <div className="text-[11px] text-gray-500">Chat • Rappels</div>
            </div>
          </div>

          <div className="flex items-center gap-1 mr-auto ml-3 rounded-full border overflow-hidden">
            <button
              className={cn("px-3 py-1 text-xs", tab === "chat" ? "bg-black text-white" : "bg-white hover:bg-gray-50")}
              onClick={() => setTab("chat")}
            >
              Chat
            </button>
            <button
              className={cn("px-3 py-1 text-xs", tab === "reminders" ? "bg-black text-white" : "bg-white hover:bg-gray-50")}
              onClick={() => setTab("reminders")}
            >
              Rappels
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
              title="Vider l'historique"
              onClick={clearHistory}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* CONTENU */}
        {tab === "chat" && (
          <>
            <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-2">
              {msgs.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user" ? "ml-auto bg-[#840404] text-white" : "bg-gray-100"
                  )}
                >
                  <div>{m.text}</div>

                  {!!m.choices?.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.choices.map((c, idx) => (
                        <button
                          key={idx}
                          className="text-xs px-2 py-1 rounded-full border hover:bg-white"
                          title={c.kind}
                          onClick={() => handleChoice(c)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {!!m.cards?.length && (
                    <div className="mt-2 space-y-2">
                      {m.cards.map((card: any, i: number) => (
                        <div key={i} className="rounded-xl border p-2 text-xs bg-white">
                          {card.type === "mission" || card.type === "mission_en_recherche" ? (
                            <>
                              <div className="font-medium text-sm">{card.client || "Client"}</div>
                              <div className="text-gray-600">{card.date}</div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {card.secteur && (
                                  <span className="rounded bg-neutral-100 border px-1.5">Secteur: {card.secteur}</span>
                                )}
                                {card.service && (
                                  <span className="rounded bg-neutral-100 border px-1.5">Service: {card.service}</span>
                                )}
                              </div>
                              {card.candidat && <div className="mt-1">Candidat : {card.candidat}</div>}
                              {card.horaires && (
                                <div className="mt-1 grid grid-cols-3 gap-1">
                                  <div>Matin: {card.horaires.matin || "-"}</div>
                                  <div>Soir: {card.horaires.soir || "-"}</div>
                                  <div>Nuit: {card.horaires.nuit || "-"}</div>
                                </div>
                              )}
                            </>
                          ) : (
                            <pre className="whitespace-pre-wrap">{JSON.stringify(card, null, 2)}</pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ZONE SAISIE */}
            <div className="p-3 border-t bg-white">
              <div className="flex items-end gap-2">
                <textarea
                  ref={taRef}
                  placeholder="Écris ici (ex: Rappel demain 10:00 d’appeler la gouvernante du client Y)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onInput={autoResize}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={2}
                  className="flex-1 resize-none rounded-md border px-3 py-2 text-sm leading-5 max-h-[220px] focus:outline-none focus:ring-1 focus:ring-neutral-300"
                  style={{ overflowY: "auto", minHeight: 64 }}
                />
                <Button onClick={() => handleSend()} disabled={busy} className="bg-[#840404] hover:bg-[#6f0303]">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {tab === "reminders" && (
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {reminders.length === 0 && <div className="text-sm text-gray-500">Aucun rappel à venir.</div>}

            {reminders.map((r) => {
              const due = new Date(r.due_at)
              const dueText = new Date(due).toLocaleString("fr-FR", {
                timeZone: "Europe/Paris",
                weekday: "short",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
              const isPast = Date.now() > due.getTime()
              return (
                <div key={r.id} className="border rounded-lg p-3 flex items-start gap-3 bg-white">
                  <button
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center border",
                      r.status === "done" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600"
                    )}
                    onClick={() => toggleReminder(r)}
                    title={r.status === "done" ? "Marqué fait — cliquer pour repasser en attente" : "Marquer fait"}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.title}</div>
                    {r.body && <div className="text-sm text-gray-700 truncate">{r.body}</div>}

                    {/* >>> SEULE LIGNE QUI CHANGE (audience masquée quand "user") <<< */}
                    <div className="mt-1 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                      <Clock className="h-3.5 w-3.5" />
                      <span className={cn(isPast ? "text-red-600" : "")}>{dueText}</span>
                      {r.audience !== "user" && <span>• Audience: {r.audience}</span>}
                      {Array.isArray(r.user_ids) && r.user_ids.length > 0 && (
                        <span>({r.user_ids.length} utilisateur·s)</span>
                      )}
                      {r.urgent ? <span className="rounded bg-red-100 text-red-700 px-1.5">URGENT</span> : null}
                    </div>
                    {/* <<< FIN DU CHANGEMENT >>> */}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
