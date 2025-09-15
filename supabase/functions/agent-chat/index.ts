// @ts-nocheck
// supabase/functions/agent-chat/index.ts
// Agent ADAPTEL — Rappels seulement (Groq prioritaire + parse local robuste + TZ Paris correct)

import { createClient } from "jsr:@supabase/supabase-js@2"

// ------------------------------ CORS ------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-tz",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ------------------------------ TZ helpers (Europe/Paris) ------------------------------
function pickTZ(req: Request) {
  const h = req.headers.get("x-agent-tz")
  return h && h.trim() ? h.trim() : "Europe/Paris"
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
function formatFrDateTZ(d: Date, tz: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d)
}
function ymdInTZ(d: Date, tz: string) {
  // renvoie yyyy-mm-dd pour la date "murale" dans tz
  const p = new Intl.DateTimeFormat("fr-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d)
  const get = (t: string) => p.find(x => x.type === t)?.value || ""
  return `${get("year")}-${get("month")}-${get("day")}`
}
function tzOffsetHoursForDate(tz: string, y: number, m1: number, d: number) {
  // offset heure d'été/hiver pour la date donnée (on sonde midi UTC)
  const probe = new Date(Date.UTC(y, m1, d, 12, 0, 0))
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(probe)
  const off = parts.find(p => p.type === "timeZoneName")?.value || "UTC"
  // ex: "GMT+2" → +2
  const m = off.match(/GMT([+-]\d+)(?::(\d{2}))?/)
  const h = m ? parseInt(m[1], 10) : 0
  const mm = m && m[2] ? parseInt(m[2], 10) : 0
  return h + (mm / 60)
}
function buildParisInstant(ymd: string, hh: number, mm: number, tz: string) {
  // construit l’instant UTC correspondant à (ymd + hh:mm) en Heure légale Paris
  const [y, m, d] = ymd.split("-").map(n => parseInt(n, 10))
  const off = tzOffsetHoursForDate(tz, y, m - 1, d) // +1 ou +2
  // Paris = UTC+off → UTC = Paris - off
  const utc = new Date(Date.UTC(y, m - 1, d, hh - off, mm, 0, 0))
  return utc
}
function addMinutes(date: Date, mins: number) {
  const d = new Date(date.getTime())
  d.setMinutes(d.getMinutes() + mins)
  return d
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

async function listAllUsers(supabase: any) {
  const { data, error } = await supabase
    .from("utilisateurs")
    .select("id, prenom, nom, email, actif")
    .eq("actif", true)
  if (error) return []
  return data || []
}
async function findUsersByName(supabase: any, raw: string) {
  if (!raw?.trim()) return []
  const q = normalize(raw)
  const { data } = await supabase
    .from("utilisateurs")
    .select("id, prenom, nom, email, actif")
    .eq("actif", true)
  if (!data?.length) return []
  // matching très simple (sans casser ta BDD)
  return data
    .map((u: any) => ({
      ...u,
      score:
        (normalize(u.prenom).includes(q) ? 1 : 0) +
        (normalize(u.nom).includes(q) ? 1 : 0),
    }))
    .filter((u: any) => u.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
}

// ------------------------------ GROQ (prioritaire) ------------------------------
const GROQ_API = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.1-70b-versatile"

async function groqIntent(message: string, tz: string, me: any) {
  const key = Deno.env.get("GROQ_API_KEY")
  if (!key) return { intent: "unknown" }

  const system = `
Tu es l'agent ADAPTEL Lyon. Tu dois répondre UNIQUEMENT par un JSON compact valide.
BUT: gestion de rappels uniquement.
INTENT: "reminder.create" ou "unknown".
Champs JSON possibles:
- intent: "reminder.create" | "unknown"
- title: string
- dateText: string            // ex: "demain", "aujourd'hui", "lundi prochain", "30/08/2025"
- timeText: string            // ex: "14h30", "14:30", "9h"
- audience: "user"|"all"|"list"
- usersText: string           // prénoms/noms cibles si audience=list (ex: "Hélène", "Céline")
Réponds strictement avec un JSON mono-ligne.
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

// ------------------------------ Parsing FR local (fallback & sécurisation) ------------------------------
const WEEKDAYS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"]
function normalize(s: string) {
  return (s || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().trim()
}
function parseExplicitTime(text: string) {
  // supporte: 14h, 14H, 14 h 30, 14:30, 14.30, 14, 09h00
  const t = normalize(text).replace(/\s+/g, "")
  const m = t.match(/\b([01]?\d|2[0-3])(?:(?:h|:|\.)([0-5]\d))?\b/)
  if (!m) return null
  const hh = parseInt(m[1], 10)
  const mm = m[2] ? parseInt(m[2], 10) : 0
  return { hh, mm }
}
function parseRelative(text: string) {
  // "dans 5 min", "dans 2 heures", "dans 1h30"
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
  // calcule prochaine occurrence du "name" à partir de la date murale Paris
  const baseYMD = ymdInTZ(baseParis, tz)
  const [y, m, d] = baseYMD.split("-").map(n => parseInt(n, 10))
  const base = new Date(Date.UTC(y, m-1, d, 12, 0, 0)) // midi UTC ce jour-là
  // jour de la semaine dans Paris
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
    // On renvoie un Date ancré à midi UTC de ce jour (évite les bascules minuit)
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

// ------------------------------ Audience parsing ------------------------------
function detectAudienceKind(text: string) {
  const t = normalize(text)
  if (/\b(tout le monde|tous les utilisateurs|toute l equipe|a tous|à tous)\b/.test(t)) return "all"
  // "à Hélène", "pour Céline", "à Christophe", etc.
  if (/\b(a|à|pour)\s+([a-zA-ZÀ-ÿ][\w\-']+)(?:\s+[a-zA-ZÀ-ÿ][\w\-']+)?\b/.test(t)) return "list"
  return "user"
}
function extractUserHint(text: string) {
  const t = normalize(text)
  // récupère après "à " ou "pour "
  const m = t.match(/\b(?:a|à|pour)\s+([a-zA-ZÀ-ÿ][\w\-']+(?:\s+[a-zA-ZÀ-ÿ][\w\-']+)?)\b/)
  return m ? m[1] : ""
}

// ------------------------------ DB: create reminder ------------------------------
async function createReminder(supabase: any, meId: string | null, args: {
  title: string, due_at: Date, audience: "user"|"all"|"list", user_ids: string[]
}) {
  const { title, due_at, audience, user_ids } = args
  const ins = await supabase
    .from("agent_reminders")
    .insert({
      created_by: meId,
      title,
      body: null,
      due_at: due_at.toISOString(), // UTC ISO
      audience,
      user_ids: audience === "list" ? user_ids : [],
      status: "pending",
      urgent: false,
    })
    .select("*")
    .single()
  return ins
}

// ------------------------------ Replies ------------------------------
function reply(text: string) {
  const msg = { id: crypto.randomUUID(), text }
  return { ok: true, reply: text, replies: [msg] }
}

// ------------------------------ Main ------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, reply: "Méthode non autorisée." }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }

  const tz = pickTZ(req) // par défaut Europe/Paris
  const supabase = supaFromReq(req)
  const me = await getMe(supabase)
  const prenom = me?.prenom || "OK"

  const body = await req.json().catch(() => ({}))
  const message: string = body?.message ?? ""

  if (!message.trim()) {
    return new Response(JSON.stringify(reply("Message vide.")), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }

  // ---------- 1) Essayez Groq (prioritaire)
  const g = await groqIntent(message, tz, me)

  // ---------- 2) Fusion Groq + parse local robuste
  // TITRE
  let title = (g.title || "").trim()
  if (!title) {
    // heuristique simple : après le dernier ":"
    const segs = message.split(":")
    if (segs.length > 1) title = segs[segs.length - 1].trim()
    if (!title) {
      // fallback mots-clés
      const m = message.match(/\b(rappel(?:le)?(?:r)?|note|noter|fais(?:\s+un)?)\b.*\b(de|pour)\b\s+(.+)/i)
      if (m && m[3]) title = m[3].trim()
    }
    if (!title) title = "Rappel"
  }

  // DATE & HEURE
  const now = nowUTC()
  const baseDate = parseDateText(g.dateText || message, tz, now) || now
  const rel = parseRelative(message)
  let hhmm = parseExplicitTime(g.timeText || message)
  let due: Date
  if (rel) {
    due = addMinutes(now, rel.amount) // ajout relatif → instant UTC correct
  } else if (hhmm) {
    const ymd = ymdInTZ(baseDate, tz)
    due = buildParisInstant(ymd, hhmm.hh, hhmm.mm, tz) // Paris wall time → UTC
  } else {
    // Pas d’heure → proposer 3 choix + saisie libre
    const need = { title, base_date_iso: buildParisInstant(ymdInTZ(baseDate, tz), 9, 0, tz).toISOString() } // ancre jour
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

  // ---------- 3) Audience
  let audience: "user"|"all"|"list" = (g.audience === "all" || g.audience === "list") ? g.audience : "user"
  // Surclasse le type si la phrase le demande explicitement
  const implied = detectAudienceKind(message)
  if (implied === "all") audience = "all"
  if (implied === "list") audience = "list"

  let userIds: string[] = []
  if (audience === "list") {
    const hint = (g.usersText && g.usersText.trim()) ? g.usersText : extractUserHint(message)
    const candidates = await findUsersByName(supabase, hint)
    if (candidates.length === 0) {
      // si on n'a pas trouvé, on repasse en user (créateur) pour ne pas te bloquer
      audience = "user"
    } else {
      // on limite à 5 pour éviter les doublons accidentels
      userIds = candidates.slice(0, 5).map((u: any) => u.id)
    }
  }

  // ---------- 4) Insert
  const ins = await createReminder(supabase, me?.id ?? null, { title, due_at: due, audience, user_ids: userIds })
  if (ins.error) {
    const txt = `Désolé ${prenom}, erreur lors de la création du rappel.`
    return new Response(JSON.stringify(reply(txt)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  // ---------- 5) Nice reply (heure affichée en Paris)
  const who =
    audience === "all"
      ? "(à tous les utilisateurs)"
      : (audience === "list"
          ? `(${userIds.length === 1 ? "1 utilisateur" : userIds.length + " utilisateurs"})`
          : "")
  const out = `C’est noté, ${prenom} : rappel « ${title} » le ${formatFrDateTimeTZ(due, tz)}${who ? " " + who : ""}.`
  return new Response(JSON.stringify(reply(out)), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
})

// ------------------------------ FILL handler (heure libre après proposition) ------------------------------
async function handleFill(req: Request) {
  const tz = pickTZ(req)
  const supabase = supaFromReq(req)
  const me = await getMe(supabase)
  const body = await req.json().catch(() => ({}))
  const fill = body?.fill ?? null
  if (!(fill?.action === "set_time_from_base" && fill?.base_date_iso && fill?.time && fill?.title)) {
    return new Response(JSON.stringify(reply("Requête invalide.")), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
  const base = new Date(fill.base_date_iso) // instant UTC ancré au bon jour
  const hm = String(fill.time).match(/^([0-2]?\d):?([0-5]\d)?$/)
  if (!hm) {
    return new Response(JSON.stringify(reply("Heure invalide.")), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
  // reconstruit le ymd (Paris) à partir de l’instant base
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

// surcharge Deno.serve pour router FILL si nécessaire
const _origServe = Deno.serve
Deno.serve = ((init: any) => {
  return _origServe(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    // essaye de lire le body sans le consommer 2 fois → on route grossièrement par présence de "fill"
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
