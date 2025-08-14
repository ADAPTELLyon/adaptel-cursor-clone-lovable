// src/hooks/useAgent.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"

// ---------------- Types ----------------
export type Utilisateur = {
  id: string
  prenom: string
  nom: string
  email: string
  actif: boolean
  created_at: string
  updated_at: string
}

export type AgentReminder = {
  id: string
  created_at: string
  created_by: string | null // utilisateurs.id
  due_at: string
  title: string
  body: string | null
  audience: "all" | "user" | "list"
  user_ids: string[] | null // utilisateurs.id[]
  status: "pending" | "done" | "canceled"
  urgent: boolean | null
}

export type AgentEvent = {
  id: string
  created_at: string
  created_by: string | null // utilisateurs.id
  type: "note" | "incident" | "indispo" | "preference" | "memo" | "autre"
  text: string
  entities: any | null // { candidat_id?, client_id?, site_id?, secteur? }
  time_scope: any | null // { date? | start?, end? }
  payload: any | null
  visibility: "private" | "all" | "list" | null
  visible_user_ids: string[] | null // utilisateurs.id[]
}

// ---------------- Utils ----------------
async function getCurrentUtilisateur(): Promise<Utilisateur | null> {
  const { data: authData, error: authErr } = await supabase.auth.getUser()
  if (authErr) {
    console.warn("[useAgent] auth error:", authErr)
    return null
  }
  const email = authData?.user?.email
  if (!email) return null

  // On résout l'utilisateur par email dans TA table `utilisateurs`
  const { data, error } = await (supabase as any)
    .from("utilisateurs")
    .select("*")
    .eq("email", email)
    .maybeSingle()

  if (error) {
    console.warn("[useAgent] utilisateurs lookup error:", error)
    return null
  }
  return (data || null) as Utilisateur | null
}

function targetsMe(r: AgentReminder, myId: string | null): boolean {
  if (r.audience === "all") return true
  if (!myId) return false
  const ids = Array.isArray(r.user_ids) ? r.user_ids : []
  return ids.includes(myId)
}

// ---------------- Core Hook ----------------
function useAgentCore(withEvents: boolean) {
  const [me, setMe] = useState<Utilisateur | null>(null)
  const [reminders, setReminders] = useState<AgentReminder[]>([])
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)

  // Résolution de l'utilisateur courant (via Auth -> utilisateurs par email)
  useEffect(() => {
    mounted.current = true
    ;(async () => {
      const u = await getCurrentUtilisateur()
      if (!mounted.current) return
      setMe(u)
    })()
    return () => {
      mounted.current = false
    }
  }, [])

  const reloadReminders = useCallback(
    async (opts?: { onlyMine?: boolean }) => {
      setLoading(true)
      const { data, error } = await (supabase as any)
        .from("agent_reminders")
        .select("*")
        .eq("status", "pending")
        .order("due_at", { ascending: true })

      if (!mounted.current) return
      if (error) {
        // Si la table n'existe pas encore, on reste silencieux pour ne pas planter l'UI
        console.warn("[useAgent] reloadReminders error (ok si table pas créée encore):", error.message)
        setReminders([])
        setLoading(false)
        return
      }

      const all = (data || []) as unknown as AgentReminder[]
      const filtered =
        opts?.onlyMine === false ? all : all.filter((r) => targetsMe(r, me?.id ?? null))
      setReminders(filtered)
      setLoading(false)
    },
    [me?.id]
  )

  const reloadEvents = useCallback(async () => {
    if (!withEvents) return
    setLoading(true)
    const { data, error } = await (supabase as any)
      .from("agent_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)

    if (!mounted.current) return
    if (error) {
      console.warn("[useAgent] reloadEvents error (ok si table pas créée encore):", error.message)
      setEvents([])
      setLoading(false)
      return
    }
    setEvents((data || []) as unknown as AgentEvent[])
    setLoading(false)
  }, [withEvents])

  // Chargements initiaux
  useEffect(() => {
    reloadReminders()
  }, [reloadReminders])

  useEffect(() => {
    if (withEvents) {
      ;(async () => {
        await reloadEvents()
      })()
    }
  }, [withEvents, reloadEvents])

  // Realtime
  useEffect(() => {
    const chRem = (supabase as any)
      .channel("rt_agent_reminders")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_reminders" }, (payload: any) => {
        const rec = payload.new as AgentReminder
        if (payload.eventType === "INSERT") {
          if (targetsMe(rec, me?.id ?? null)) {
            setReminders((prev) => {
              if (prev.some((p) => p.id === rec.id)) return prev
              return [...prev, rec].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
            })
          }
        } else if (payload.eventType === "UPDATE") {
          setReminders((prev) => prev.map((r) => (r.id === rec.id ? rec : r)))
        } else if (payload.eventType === "DELETE") {
          const oldId = (payload.old as any)?.id
          setReminders((prev) => prev.filter((r) => r.id !== oldId))
        }
      })
      .subscribe()

    let chEvt: any = null
    if (withEvents) {
      chEvt = (supabase as any)
        .channel("rt_agent_events")
        .on("postgres_changes", { event: "*", schema: "public", table: "agent_events" }, (payload: any) => {
          if (payload.eventType === "INSERT") {
            const rec = payload.new as AgentEvent
            setEvents((prev) => {
              if (prev.some((p) => p.id === rec.id)) return prev
              return [rec, ...prev]
            })
          } else if (payload.eventType === "UPDATE") {
            const rec = payload.new as AgentEvent
            setEvents((prev) => prev.map((e) => (e.id === rec.id ? rec : e)))
          } else if (payload.eventType === "DELETE") {
            const oldId = (payload.old as any)?.id
            setEvents((prev) => prev.filter((e) => e.id !== oldId))
          }
        })
        .subscribe()
    }

    return () => {
      ;(supabase as any).removeChannel(chRem)
      if (chEvt) (supabase as any).removeChannel(chEvt)
    }
  }, [me?.id, withEvents])

  // Badge (rappels <= 24h)
  const badgeCount = useMemo(() => {
    const now = Date.now()
    const in24 = now + 24 * 60 * 60 * 1000
    return reminders.filter((r) => r.status === "pending" && new Date(r.due_at).getTime() <= in24).length
  }, [reminders])

  // Actions
  const addReminder = useCallback(
    async (input: Omit<AgentReminder, "id" | "created_at" | "created_by" | "status">) => {
      const payload = {
        ...input,
        created_by: me?.id ?? null,
        status: "pending" as const,
      }
      const { data, error } = await (supabase as any)
        .from("agent_reminders")
        .insert(payload)
        .select("*")
        .single()
      if (error) throw error
      const rec = (data || null) as unknown as AgentReminder
      if (rec && targetsMe(rec, me?.id ?? null)) {
        setReminders((prev) => [...prev, rec].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()))
      }
      return rec
    },
    [me?.id]
  )

  const addEvent = useCallback(
    async (input: Omit<AgentEvent, "id" | "created_at" | "created_by">) => {
      const payload = {
        ...input,
        created_by: me?.id ?? null,
      }
      const { data, error } = await (supabase as any)
        .from("agent_events")
        .insert(payload)
        .select("*")
        .single()
      if (error) throw error
      const rec = (data || null) as unknown as AgentEvent
      if (rec) setEvents((prev) => [rec, ...prev])
      return rec
    },
    [me?.id]
  )

  return {
    me,
    loading,
    reminders,
    events,
    badgeCount,
    reloadReminders,
    reloadEvents,
    addReminder,
    addEvent,
  }
}

// ---------------- Public hooks ----------------
export function useAgentBadge() {
  // léger : uniquement rappels
  return useAgentCore(false)
}

export function useAgent() {
  // complet : rappels + events
  return useAgentCore(true)
}
