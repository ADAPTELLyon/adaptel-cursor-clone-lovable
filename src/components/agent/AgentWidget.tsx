// src/components/agent/AgentWidget.tsx
import React, { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Send } from "lucide-react"
import { cn } from "@/lib/utils"

type ChatMsg = {
  id: string
  role: "user" | "agent"
  text: string
  quickReplies?: Array<{ label: string; payload: any }>
  custom?: React.ReactNode
}

export default function AgentWidget({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [lastUserText, setLastUserText] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [msgs, open])

  function pushAgent(text: string, extras?: Partial<ChatMsg>) {
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "agent", text, ...extras }])
  }
  function pushUser(text: string) {
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "user", text }])
  }

  useEffect(() => {
    if (open && msgs.length === 0) {
      pushAgent("Bonjour ! Dis-moi simplement : « Rappel à Hélène demain 10h d’appeler l’Hôtel Y » ou « Problème candidat Dupont hier ». Je m’occupe du reste.")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function callAgent({ message, fill }: { message?: string; fill?: any }) {
    const { data, error } = await supabase.functions.invoke("agent-chat", {
      body: { message, fill },
    })
    if (error) throw error
    const replies = (data?.replies || []) as ChatMsg[]
    setMsgs((prev) => [...prev, ...replies.map(r => ({ ...r, role: "agent" as const }))])
  }

  async function handleSend() {
    const value = input.trim()
    if (!value) return
    setInput("")
    pushUser(value)
    setLastUserText(value)
    setBusy(true)
    try {
      await callAgent({ message: value })
    } finally {
      setBusy(false)
    }
  }

  async function handleQuick(payload: any) {
    setBusy(true)
    try {
      await callAgent({ message: lastUserText ?? "", fill: payload })
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed right-6 bottom-6 z-[80]">
      <div className="w-[380px] h-[520px] rounded-2xl shadow-2xl border bg-white flex flex-col overflow-hidden">
        <div className="h-12 flex items-center justify-between px-3 border-b bg-gradient-to-r from-white to-gray-50">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[#840404] text-white flex items-center justify-center font-bold">A</div>
            <div className="text-sm">
              <div className="font-semibold">Agent — ADAPTEL Lyon</div>
              <div className="text-[11px] text-gray-500">Rappels • Notes • Aide</div>
            </div>
          </div>
          <button className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center" onClick={onClose} aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-2">
          {msgs.map((m) => (
            <div key={m.id} className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", m.role === "user" ? "ml-auto bg-[#840404] text-white" : "bg-gray-100")}>
              <div className="whitespace-pre-wrap">{m.text}</div>
              {m.quickReplies && m.quickReplies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.quickReplies.map((q, idx) => (
                    <button key={idx} className="text-xs px-2 py-1 rounded-full border hover:bg-white" onClick={() => handleQuick(q.payload)}>
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
              {m.custom && <div className="mt-2">{m.custom}</div>}
            </div>
          ))}
        </div>

        <div className="p-3 border-t bg-white">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Écris ici (ex: Rappel à Hélène demain 10h d’appeler l’Hôtel Y)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={busy} className="bg-[#840404] hover:bg-[#6f0303]">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
