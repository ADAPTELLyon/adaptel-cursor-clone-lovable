// @ts-nocheck
// supabase/functions/agent-chat/index.ts
// Agent ADAPTEL — Rappels (create / list / update_time / cancel) + smalltalk
// - Groq prioritaire (JSON strict) + fallback FR local fiable
// - Europe/Paris (conversion murale -> UTC correcte)
// - Respecte l'utilisateur connecté via Supabase Auth
// - Réponses compactes pour l'app (ok/reply/replies)

import { createClient } from "jsr:@supabase/supabase-js@2"

// ------------------------------ CORS ------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-tz",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
}

// ------------------------------ TZ helpers (Europe/Paris) ------------------------------
const DEFAULT_TZ = "Europe/Paris"

function pickTZ(req: Request) {
  const h = req.headers.get("x-agent-tz")
  return h && h.trim() ? h.trim() : DEFAULT_TZ
}
function nowUTC() {
  return new Date()
}
function formatFrDateTimeTZ(d: Date, tz: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}
function ymdInTZ(d: Date, tz: string) {
  const p = new Intl.DateTimeFormat("fr-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d)
  const get = (t: string) => p.find(x => x.type === t)?.value || ""
  return `${get("year")}-${get("month")}-${get("day")}`
}
function tzOffsetHoursForDate(tz: string, y: number, m1: number, d: number) {
  const probe = new Date(Date.UTC(y, m1, d, 12, 0, 0))
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(probe)
  const off = parts.find(p => p.type === "timeZoneName")?.value || "UTC"
  const m = off.match(/GMT([+-]\d+)(?::(\d{2}))?/)
  const h = m ? parseInt(m[1], 10) : 0
  const mm = m && m[2] ? parseInt(m[2], 10) : 0
  return h + (mm / 60)
}
function buildParisInstant(ymd: string, hh: number, mm: number, tz: string) {
  const [y, m, d] = ymd.split("-").map(n => parseInt(n, 10))
  const off = tzOffsetHoursForDate(tz, y, m - 1, d)
  return new Date(Date.UTC(y, m - 1, d, hh - off, mm, 0, 0))
}
function addMinutes(date: Date, mins: number) {
  const d = new Date(date.getTime())
  d.setMinutes(d.getMinutes() + mins)
  return d
}

// ------------------------------ Text helpers ------------------------------
const WEEKDAYS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"]
function normalize(s: string) {
  return (s || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().trim()
}
function parseExplicitTime(text: string) {
  const t = normalize(text).replace(/\s+/g, "")
  const m = t.match(/\b([01]?\d|2[0-3])(?:(?:h|:|\.)([0-5]\d))?\b/)
  if (!m) return null
  const hh = parseInt(m[1], 10)
  const mm = m[2] ? parseInt(m[2], 10) : 0
  return { hh, mm }
}
function parseRelative(text: string) {
  const t = normalize(text)
  const m1 = t.match(/\bdans\s+(\d{1,3})\s*(minute|minutes|min|mn)\b/)
  if (m1) return { kind: "minutes", amount: parseInt(m1[1], 10) }
  const m2 = t.match(/\bdans\s+(\d{1,2})\s*(heure|heures|h)\b/)
  if (m2) return { kind: "minutes", amount: parseInt(m2[1], 10) * 60 }
  const m3 = t.match(/\bdans\s+(\d{1,2})h(\d{1,2})\b/)
  if (m3) return { kind: "minutes", amount: parseInt(m3[1],10)*60 + parseInt(m3[2],10) }
  return null
}
function nextWeekdayDate(name: string, baseParis: Date, tz: string) {
  const baseYMD = ymdInTZ(baseParis, tz)
  const [y, m, d] = baseYMD.split("-").map(n => parseInt(n, 10))
  const base = new Date(Date.UTC(y, m-1, d, 12, 0, 0))
  const wd = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long" }).format(base).toLowerCase()
  const curIdx = WEEKDAYS.indexOf(wd)
  const idx = WEEKDAYS.indexOf(name)
  let diff = idx - curIdx
  if (diff <= 0) diff += 7
  const target = new Date(base)
  target.setUTCDate(target.getUTCDate() + diff)
  return target
}
function parseDateText(text: string, tz: string, now: Date) {
  const t = normalize(text)
  if (!t) return null
  if (/\baujourdhui\b/.test(t) || /\baujourd'hui\b/.test(t)) return now
  if (/\bdemain\b/.test(t)) return addMinutes(now, 24*60)
  for (const w of WEEKDAYS) {
    const re = new RegExp(`\\b${w}(?:\\s+prochain)?\\b`)
    const m = t.match(re)
    if (m) {
      const baseParis = now
      let d = nextWeekdayDate(w, baseParis, tz)
      if (/prochain/.test(m[0])) d = addMinutes(d, 7*24*60)
      return d
    }
  }
  const fr = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/)
  if (fr) {
    const day = parseInt(fr[1], 10)
    const mon = parseInt(fr[2], 10)
    const year = fr[3] ? parseInt(fr[3], 10) : parseInt(ymdInTZ(now, tz).split("-")[0], 10)
    return new Date(Date.UTC(year, mon - 1, day, 12, 0, 0))
  }
  const iso = t.match(/\b(20\d{2})-(0?\d|1[0-2])-(0?\d|[12]\d|3[01])\b/)
  if (iso) {
    const y = parseInt(iso[1], 10)
    const m = parseInt(iso[2], 10)
    const da = parseInt(iso[3], 10)
    return new Date(Date.UTC(y, m - 1, da, 12, 0, 0))
  }
  return null
}

// ------------------------------ Supabase helpers ------------------------------
function supaFromReq(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!
  const authHeader = req.headers.get("Authorization") ?? ""
  return createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } })
}
async function getMe(supabase: any) {
  try {
    const { data: auth } = await supabase.auth.getUser()
    const email = auth?.user?.email
    if (!email) return null
    const { data } = await supabase
      .from("utilisateurs")
      .select("id, prenom, nom, email")
      .eq("email", email)
      .maybeSingle()
    return data ?? null
  } catch {
    return null
  }
}

// ------------------------------ DB: reminders ------------------------------
async function createReminder(supabase: any, meId: string | null, args: {
  title: string, due_at: Date, audience: "user"|"all"|"list", user_ids: string[]
}) {
  const { title, due_at, audience, user_ids } = args
  return await supabase
    .from("agent_reminders")
    .insert({
      created_by: meId,
      title,
      body: null,
      due_at: due_at.toISOString(),
      audience,
      user_ids: audience === "list" ? user_ids : [],
      status: "pending",
      urgent: false,
    })
    .select("*")
    .single()
}
async function listMyPending(supabase: any, meId: string | null) {
  const q = supabase
    .from("agent_reminders")
    .select("id,title,due_at,audience,status")
    .eq("status","pending")
    .order("due_at",{ ascending:true })
    .limit(10)
  if (meId) q.eq("created_by", meId)
  return await q
}
async function latestMyPending(supabase: any, meId: string | null) {
  const q = supabase
    .from("agent_reminders")
    .select("id,title,due_at,audience,status")
    .eq("status","pending")
    .order("created_at",{ ascending:false })
    .limit(1)
    .maybeSingle()
  if (meId) q.eq("created_by", meId)
  return await q
}
async function updateReminderTime(supabase: any, id: string, newDue: Date) {
  return await supabase
    .from("agent_reminders")
    .update({ due_at: newDue.toISOString() })
    .eq("id", id)
    .select("*")
    .single()
}
async function cancelReminder(supabase: any, id: string) {
  return await supabase
    .from("agent_reminders")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("id,title,status")
    .single()
}

// ------------------------------ GROQ ------------------------------
const GROQ_API = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.1-70b-versatile"

async function groqIntent(message: string, tz: string, me: any) {
  const key = Deno.env.get("GROQ_API_KEY")
  if (!key) return { intent: "unknown" }

  const system = `
Tu es l'agent ADAPTEL. Réponds STRICTEMENT en JSON valide mono-ligne.
Possible intents:
- "reminder.create"  (créer un rappel)
- "reminder.update_time" (changer l'heure/le jour du dernier rappel pertinent de l'utilisateur)
- "reminder.cancel" (annuler le dernier rappel pertinent)
- "reminder.list"   (lister prochains rappels)
- "smalltalk"        (réponse brève polie)
Champs:
- intent: string
- title?: string
- dateText?: string
- timeText?: string
- newTimeText?: string
- audience?: "user"|"all"|"list"
- usersText?: string
Réponds UNIQUEMENT le JSON. Pas de texte autour.
`
  const user = `TZ=${tz}; USER=${me?.prenom || ""} ${me?.nom || ""} (${me?.email || ""})\nMessage: ${message}`

  const body = {
    model: GROQ_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  }

  try {
    const res = await fetch(GROQ_API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { intent: "unknown" }
    const j = await res.json().catch(() => null)
    const txt = j?.choices?.[0]?.message?.content?.trim() || "{}"
    try {
      const obj = JSON.parse(txt)
      if (obj && typeof obj === "object" && obj.intent) return obj
    } catch {}
    return { intent: "unknown" }
  } catch {
    return { intent: "unknown" }
  }
}

// ------------------------------ Replies ------------------------------
function reply(text: string) {
  const msg = { id: crypto.randomUUID(), text }
  return { ok: true, reply: text, replies: [msg] }
}

// ------------------------------ Main ------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method === "GET") {
    const payload = { ok: true, service: "agent-chat", ts: new Date().toISOString() }
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, reply: "Méthode non autorisée." }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }

  const tz = pickTZ(req)
  const supabase = supaFromReq(req)
  const me = await getMe(supabase)
  const prenom = me?.prenom || "OK"

  const body = await req.json().catch(() => ({}))
  const message: string = (body?.message ?? "").toString()

  if (!message.trim()) {
    return new Response(JSON.stringify(reply("Message vide.")), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }

  // ---------- 1) Intent via Groq
  const g = await groqIntent(message, tz, me)
  const intent: string = g.intent || "unknown"

  // ---------- 2) Router intents
  const now = nowUTC()

  // --- reminder.create
  if (intent === "reminder.create") {
    // TITLE
    let title = (g.title || "").trim()
    if (!title) {
      const segs = message.split(":")
      if (segs.length > 1) title = segs[segs.length - 1].trim()
      if (!title) {
        const m = message.match(/\b(rappel(?:le)?(?:r)?|note|noter|fais(?:\s+un)?)\b.*\b(de|pour)\b\s+(.+)/i)
        if (m && m[3]) title = m[3].trim()
      }
      if (!title) title = "Rappel"
    }

    // DATE & HEURE
    const baseDate = parseDateText(g.dateText || message, tz, now) || now
    const rel = parseRelative(message)
    let hhmm = parseExplicitTime(g.timeText || message)

    let due: Date
    if (rel) {
      due = addMinutes(now, rel.amount)
    } else if (hhmm) {
      const ymd = ymdInTZ(baseDate, tz)
      due = buildParisInstant(ymd, hhmm.hh, hhmm.mm, tz)
    } else {
      const need = { title, base_date_iso: buildParisInstant(ymdInTZ(baseDate, tz), 9, 0, tz).toISOString() }
      const text = `Il me manque l’heure, ${prenom}. Tu veux planifier « ${title} » à quel horaire ?`
      const choices = [
        { label: "09:00", payload: { action: "set_time_from_base", time: "09:00", title, base_date_iso: need.base_date_iso } },
        { label: "15:00", payload: { action: "set_time_from_base", time: "15:00", title, base_date_iso: need.base_date_iso } },
        { label: "18:00", payload: { action: "set_time_from_base", time: "18:00", title, base_date_iso: need.base_date_iso } },
      ]
      return new Response(JSON.stringify({ ok: true, reply: text, replies: [{ id: crypto.randomUUID(), text }], choices, meta: { need_time: need } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // AUDIENCE (par défaut user)
    let audience: "user"|"all"|"list" = (g.audience === "all" || g.audience === "list") ? g.audience : "user"
    const usersText = (g.usersText || "").trim()
    let userIds: string[] = []
    if (audience === "list" && usersText) {
      // option simple : pas de résolution compliquée pour l’instant → repli user
      audience = "user"
    }

    const ins = await createReminder(supabase, me?.id ?? null, { title, due_at: due, audience, user_ids: userIds })
    if (ins.error) {
      const txt = `Désolé ${prenom}, erreur lors de la création du rappel.`
      return new Response(JSON.stringify(reply(txt)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    const out = `C’est noté, ${prenom} : rappel « ${title} » le ${formatFrDateTimeTZ(due, tz)}${audience==="all"?" (à tous les utilisateurs)":""
      }.`
    return new Response(JSON.stringify(reply(out)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  // --- reminder.list
  if (intent === "reminder.list") {
    const { data, error } = await listMyPending(supabase, me?.id ?? null)
    if (error) {
      return new Response(JSON.stringify(reply(`Désolé ${prenom}, je n’ai pas pu lister tes rappels.`)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    if (!data?.length) {
      return new Response(JSON.stringify(reply(`Tu n’as aucun rappel en attente, ${prenom}.`)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    const lines = data.map((r: any, i: number) => {
      const d = new Date(r.due_at)
      return `${i+1}. « ${r.title} » — ${formatFrDateTimeTZ(d, tz)}`
    })
    const text = `Tes prochains rappels :\n` + lines.join("\n")
    return new Response(JSON.stringify(reply(text)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  // --- reminder.update_time (du dernier rappel en attente)
  if (intent === "reminder.update_time") {
    const { data: last, error: e1 } = await latestMyPending(supabase, me?.id ?? null)
    if (e1 || !last) {
      return new Response(JSON.stringify(reply(`Je n’ai pas trouvé de rappel récent à modifier, ${prenom}.`)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    const newT = parseExplicitTime(g.newTimeText || g.timeText || message)
    const baseDate = new Date(last.due_at)
    if (!newT) {
      const txt = `Il me manque la nouvelle heure, ${prenom}. Donne-moi un horaire (ex: 16:00).`
      return new Response(JSON.stringify(reply(txt)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    // Conserve le même jour (Paris) et change l’heure
    const ymd = ymdInTZ(baseDate, tz)
    const newDue = buildParisInstant(ymd, newT.hh, newT.mm, tz)
    const { error: e2 } = await updateReminderTime(supabase, last.id, newDue)
    if (e2) {
      return new Response(JSON.stringify(reply(`Impossible de modifier l’heure du rappel, ${prenom}.`)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    const txt = `C’est modifié, ${prenom} : « ${last.title} » passe à ${formatFrDateTimeTZ(newDue, tz)}.`
    return new Response(JSON.stringify(reply(txt)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  // --- reminder.cancel (du dernier rappel en attente)
  if (intent === "reminder.cancel") {
    const { data: last, error: e1 } = await latestMyPending(supabase, me?.id ?? null)
    if (e1 || !last) {
      return new Response(JSON.stringify(reply(`Je n’ai pas trouvé de rappel récent à annuler, ${prenom}.`)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    const { error: e2 } = await cancelReminder(supabase, last.id)
    if (e2) {
      return new Response(JSON.stringify(reply(`Impossible d’annuler le rappel, ${prenom}.`)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
    const txt = `C’est annulé, ${prenom} : « ${last.title} ».`
    return new Response(JSON.stringify(reply(txt)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  // --- smalltalk / unknown
  const small = normalize(message)
  if (intent === "smalltalk" || /\b(bonjour|salut|merci|ok|super)\b/.test(small)) {
    return new Response(JSON.stringify(reply(`Oui ${prenom} ? Tu peux me demander de créer, lister, modifier ou annuler un rappel.`)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }

  // fallback: propose aide
  return new Response(JSON.stringify(reply(`Je peux gérer tes rappels, ${prenom} : « crée un rappel… », « liste mes rappels », « passe-le à 16h », « annule le dernier ».`)), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })
})

// ------------------------------ FILL handler (heure manquante) ------------------------------
async function handleFill(req: Request) {
  const tz = pickTZ(req)
  const supabase = supaFromReq(req)
  const me = await getMe(supabase)
  const body = await req.json().catch(() => ({}))
  const fill = body?.fill ?? null
  if (!(fill?.action === "set_time_from_base" && fill?.base_date_iso && fill?.time && fill?.title)) {
    return new Response(JSON.stringify(reply("Requête invalide.")), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
  const base = new Date(fill.base_date_iso)
  const hm = String(fill.time).match(/^([0-2]?\d):?([0-5]\d)?$/)
  if (!hm) {
    return new Response(JSON.stringify(reply("Heure invalide.")), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
  const ymd = ymdInTZ(base, tz)
  const hh = parseInt(hm[1], 10)
  const mm = hm[2] ? parseInt(hm[2], 10) : 0
  const due = buildParisInstant(ymd, hh, mm, tz)

  const ins = await createReminder(supaFromReq(req), me?.id ?? null, {
    title: String(fill.title),
    due_at: due,
    audience: "user",
    user_ids: [],
  })
  const prenom = me?.prenom || "OK"
  if (ins.error) {
    return new Response(JSON.stringify(reply("Erreur lors de la création du rappel.")), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
  const text = `C’est noté, ${prenom} : rappel « ${fill.title} » le ${formatFrDateTimeTZ(due, tz)}.`
  return new Response(JSON.stringify(reply(text)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
}

// Router FILL si nécessaire
const _origServe = Deno.serve
Deno.serve = ((init: any) => {
  return _origServe(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    try {
      const clone = req.clone()
      const body = await clone.json().catch(() => ({}))
      if (body?.fill?.action === "set_time_from_base") {
        return handleFill(req)
      }
    } catch {}
    return (init as any)(req)
  })
}) as any
