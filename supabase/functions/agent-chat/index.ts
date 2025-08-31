// @ts-nocheck
// supabase/functions/agent-chat/index.ts
// Agent ADAPTEL — Rappels (inchangé) + Candidats (résolution + attributs)

import { createClient } from "jsr:@supabase/supabase-js@2"

// ------------------------------ CORS ------------------------------
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-tz",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ------------------------------ TZ utils ------------------------------
function partsFromTZ(dateUTC: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  })
  const parts = Object.fromEntries(dtf.formatToParts(dateUTC).map((p) => [p.type, p.value])) as any
  return {
    year: +parts.year, month: +parts.month, day: +parts.day,
    hour: +parts.hour, minute: +parts.minute, second: +parts.second,
  }
}
function tzOffsetMsAt(guessUTC: Date, tz: string) {
  const p = partsFromTZ(guessUTC, tz)
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUTC - guessUTC.getTime()
}
function makeDateInTZ(tz: string, year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const offset = tzOffsetMsAt(guess, tz)
  return new Date(guess.getTime() - offset)
}
function getTZYMD(date: Date, tz: string) {
  const p = partsFromTZ(date, tz)
  return { y: p.year, m: p.month, d: p.day }
}
function formatFrDateTime(d: Date | string, tz: string) {
  return new Date(d).toLocaleString("fr-FR", {
    timeZone: tz, weekday: "long", day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}
function formatFrDate(d: Date | string, tz: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    timeZone: tz, weekday: "long", day: "2-digit", month: "long", year: "numeric",
  })
}
function pickTZ(req: Request) {
  const h = req.headers.get("x-agent-tz")
  return h && h.trim() ? h.trim() : "Europe/Paris"
}

// ------------------------------ Parsing dates/heures (rappels) ------------------------------
const WEEKDAYS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"]

function parseHourMinuteFR(s?: string | null) {
  if (!s) return null
  const m = s.trim().toLowerCase().match(/^([0-2]?\d)(?:[:hH]([0-5]?\d))?$/)
  if (!m) return null
  const h = Math.min(23, parseInt(m[1], 10))
  const min = m[2] ? Math.min(59, parseInt(m[2], 10)) : 0
  return { h, min }
}
function parseHourFromText(raw?: string | null) {
  if (!raw) return null
  const t = raw.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  const re = /(^|[^\d])([01]?\d|2[0-3])(?:[:hH]([0-5]\d))?([^\d]|$)/gu
  let match: RegExpExecArray | null = null
  let last: {h:number,min:number} | null = null
  while ((match = re.exec(t)) !== null) {
    const h = parseInt(match[2], 10)
    const mm = match[3] ? parseInt(match[3], 10) : 0
    last = { h, min: mm }
  }
  return last
}
function parseRelativeFR(text: string | null | undefined): number | null {
  if (!text) return null
  const t = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
  if (/\b(maintenant|tout\s*de\s*suite)\b/.test(t)) return 60_000
  let m = t.match(/\bdans\s+(\d{1,3})\s*(minutes?|mins?|mn|m)\b/)
  if (m) return Math.max(1, parseInt(m[1], 10)) * 60_000
  m = t.match(/\bdans\s+(\d{1,2})\s*(heures?|h)\b/)
  if (m) return Math.max(1, parseInt(m[1], 10)) * 3_600_000
  m = t.match(/\bdans\s+(\d{1,2})h(\d{1,2})\b/)
  if (m) return (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) * 60_000
  return null
}
function nextWeekdayDate(name: string, baseUTC: Date, tz: string) {
  const p = partsFromTZ(baseUTC, tz)
  const baseWeekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getDay()
  const idx = WEEKDAYS.indexOf(name)
  if (idx < 0) return null
  let diff = idx - baseWeekday
  if (diff <= 0) diff += 7
  const dYMD = new Date(Date.UTC(p.year, p.month - 1, p.day))
  dYMD.setUTCDate(dYMD.getUTCDate() + diff)
  return { y: dYMD.getUTCFullYear(), m: dYMD.getUTCMonth() + 1, d: dYMD.getUTCDate() }
}
function parseDateTextFR(dateText: string | null | undefined, tz: string):
  | { mode: "relative", deltaMs: number }
  | { mode: "ymd", y: number, m: number, d: number }
  | null {
  if (!dateText) return null
  const baseUTC = new Date()
  const t = dateText.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

  const rel = parseRelativeFR(t)
  if (rel != null) return { mode: "relative", deltaMs: rel }

  if (/\baujourdhui\b/.test(t) || /\baujourd'hui\b/.test(t)) {
    const { y, m, d } = getTZYMD(baseUTC, tz)
    return { mode: "ymd", y, m, d }
  }
  if (/\bdemain\b/.test(t)) {
    const { y, m, d } = getTZYMD(baseUTC, tz)
    const d0 = new Date(Date.UTC(y, m - 1, d))
    d0.setUTCDate(d0.getUTCDate() + 1)
    return { mode: "ymd", y: d0.getUTCFullYear(), m: d0.getUTCMonth() + 1, d: d0.getUTCDate() }
  }
  for (const w of WEEKDAYS) {
    const re = new RegExp(`\\b${w}(?:\\s+prochain)?\\b`)
    const m = t.match(re)
    if (m) {
      let target = nextWeekdayDate(w, baseUTC, tz)!
      if (/prochain/.test(m[0])) {
        const d0 = new Date(Date.UTC(target.y, target.m - 1, target.d))
        d0.setUTCDate(d0.getUTCDate() + 7)
        target = { y: d0.getUTCFullYear(), m: d0.getUTCMonth() + 1, d: d0.getUTCDate() }
      }
      return { mode: "ymd", ...target }
    }
  }
  const fr = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/)
  if (fr) {
    const { y:cy } = getTZYMD(baseUTC, tz)
    return { mode: "ymd", y: fr[3] ? +fr[3] : cy, m: +fr[2], d: +fr[1] }
  }
  const iso = t.match(/\b(20\d{2})-(0?\d|1[0-2])-(0?\d|[12]\d|3[01])\b/)
  if (iso) return { mode: "ymd", y: +iso[1], m: +iso[2], d: +iso[3] }
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
    const { data } = await supabase.from("utilisateurs")
      .select("id, prenom, nom, email, actif")
      .eq("email", email).eq("actif", true)
      .maybeSingle()
    return data ?? null
  } catch { return null }
}
async function getAllUsers(supabase: any) {
  const { data } = await supabase.from("utilisateurs")
    .select("id, prenom, nom, email, actif")
    .eq("actif", true)
  return (data || []) as Array<{id:string, prenom:string, nom:string, email:string, actif:boolean}>
}

// ------------------------------ Groq intents ------------------------------
const GROQ_API = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODELS = ["llama-3.1-70b-versatile", "llama-3.1-8b-instant"] as const

async function groqParse(message: string, tz: string, me: any) {
  const key = Deno.env.get("GROQ_API_KEY")
  if (!key) return { intent: "unknown" }

  const system = `
Tu es un parseur strict pour l'agent ADAPTEL Lyon. Retourne UNIQUEMENT un JSON valide en une ligne.
Intents autorisés:
- "reminder.create"  // créer un rappel
- "candidate.resolve" // je cherche un candidat (retourner candidateName, secteur?)
- "candidate.attribute" // question d'attribut candidat, ex: vehicule, age, secteurs, telephone, email, ville
- "smalltalk.date_today" | "smalltalk.time_now" | "unknown"

Champs possibles:
- candidateName: string
- secteur: "etages"|"cuisine"|"salle"|"plonge"|"reception"
- attribute: "vehicule"|"age"|"secteurs"|"telephone"|"email"|"ville"
- dateText: string
- timeText: string
- title: string
- note: string
Exemples valides:
{"intent":"candidate.attribute","candidateName":"Dupont","attribute":"vehicule"}
{"intent":"candidate.resolve","candidateName":"Jean Dupont","secteur":"cuisine"}
{"intent":"reminder.create","title":"appeler Paul","dateText":"demain","timeText":"11h"}`
  const user = `TZ=${tz}; User=${me?.prenom || ""} ${me?.nom || ""} (${me?.email || ""})
Message: ${message}`

  for (const model of GROQ_MODELS) {
    const payload = { model, temperature: 0.1, response_format: { type: "json_object" as const }, messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ] }
    const res = await fetch(GROQ_API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null)
    if (!res || !res.ok) continue
    const j = await res.json().catch(() => null)
    const txt = j?.choices?.[0]?.message?.content?.trim() || "{}"
    try { const obj = JSON.parse(txt); if (obj && typeof obj.intent === "string") return obj } catch {}
  }
  return { intent: "unknown" }
}

// ------------------------------ Rappels (DB) ------------------------------
async function createReminder(
  supabase: any,
  userId: string | null,
  args: { title: string, body?: string | null, due_at: string, audience: "all"|"user"|"list", user_ids: string[] }
) {
  const { title, body = null, due_at, audience, user_ids } = args
  const write_user_ids = audience === "all" ? [] : user_ids
  const ins = await supabase
    .from("agent_reminders")
    .insert({
      created_by: userId,
      title, body, due_at, audience,
      user_ids: write_user_ids,
      status: "pending", urgent: false,
    })
    .select("*")
    .single()
  if (ins.error) return { ok: false, error: ins.error.message, reminders: [] }
  return { ok: true, reminders: [ins.data] }
}

// ------------------------------ Replies ------------------------------
function wrapReply(text: string, extras?: any) {
  const msg = { id: crypto.randomUUID(), text }
  const out: any = { ok: true, reply: text, replies: [msg] }
  if (extras) Object.assign(out, extras)
  return out
}

// ------------------------------ Smalltalk local ------------------------------
function localSmalltalk(low: string, tz: string) {
  if (/quel(le)?\s+jour\s+(on|sommes\-?nous|est\-?on)\s*(aujourd.?hui)?\s*\??/.test(low)) {
    return `On est ${formatFrDate(new Date(), tz)}.`
  }
  if (/quelle?\s+heure\s+est\-?il\??/.test(low)) {
    return `Il est ${new Date().toLocaleTimeString("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" })}.`
  }
  return null
}

// ------------------------------ Audience & Titre (rappels) ------------------------------
function normalize(s: string) { return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase() }
function detectAudienceAll(raw: string): boolean {
  const t = normalize(raw)
  if (/\ba\s*tous(\s+les)?\s+utilisateurs?\b/.test(t)) return true
  if (/\ba\s*toute?\s+l[' ]?equipe\b/.test(t)) return true
  if (/\b(?:a|à)\s*tous\b/.test(t)) return true
  if (/\b(?:a|à)\s*tout\s+le\s+monde\b/.test(t)) return true
  if (/\bpour\s+tous\b/.test(t)) return true
  if (/\bpour\s+tout\s+le\s+monde\b/.test(t)) return true
  return false
}
function textHasAlias(t: string, alias: string) {
  const re = new RegExp(`(^|[^\\p{L}])${alias}([^\\p{L}]|$)`, "u")
  return re.test(t)
}
function findMentionedUsers(raw: string, users: Array<{id:string, prenom:string, nom:string, email:string}>) {
  const t = normalize(raw)
  const hits: Array<{id:string, label:string}> = []
  for (const u of users) {
    const pn = normalize(u.prenom)
    const nn = normalize(u.nom)
    const aliases = [pn, nn, `${pn} ${nn}`, `${nn} ${pn}`]
    if (aliases.some(a => textHasAlias(t, a))) {
      hits.push({ id: u.id, label: `${u.prenom} ${u.nom}`.trim() })
    }
  }
  return hits
}
function extractTitleFromMessage(raw: string, fallback: string) {
  const lastColon = raw.lastIndexOf(":")
  if (lastColon >= 0 && lastColon < raw.length - 1) {
    const tail = raw.slice(lastColon + 1).trim()
    if (tail.length >= 2) return tail
  }
  const m = raw.match(/(?:\bde\b|\bpour\b)\s+(.{3,})$/i)
  if (m) {
    const tail = m[1].trim()
    if (tail.length >= 2) return tail
  }
  return fallback
}

// ------------------------------ Candidats: helpers ------------------------------
function normalizeLike(s: string) { return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim() }

async function findCandidates(
  supabase: any,
  rawQuery: string,
  secteur?: string | null
) {
  const q = normalizeLike(rawQuery)
  if (!q) return []

  // découpage éventuel (ex: "jean dupont")
  const parts = q.split(/\s+/).filter(Boolean)
  let data: any[] = []

  if (parts.length >= 2) {
    const a = parts[0], b = parts.slice(1).join(" ")
    // nom=a prenom=b
    let r1 = await supabase.from("candidats")
      .select("id, nom, prenom, secteurs, vehicule, actif, ville, email, telephone, date_naissance")
      .eq("actif", true)
      .ilike("nom", a + "%")
      .ilike("prenom", b + "%")
      .limit(10)
    data = r1.data || []
    if (!data.length) {
      // inversé
      let r2 = await supabase.from("candidats")
        .select("id, nom, prenom, secteurs, vehicule, actif, ville, email, telephone, date_naissance")
        .eq("actif", true)
        .ilike("nom", b + "%")
        .ilike("prenom", a + "%")
        .limit(10)
      data = r2.data || []
    }
  }

  // fallback: contient q dans nom OU prenom
  if (!data.length) {
    const r3 = await supabase.from("candidats")
      .select("id, nom, prenom, secteurs, vehicule, actif, ville, email, telephone, date_naissance")
      .eq("actif", true)
      .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%`)
      .limit(10)
    data = r3.data || []
  }

  // si secteur mentionné → on met en tête ceux qui matchent ce secteur
  if (secteur && ["etages","cuisine","salle","plonge","reception"].includes(secteur)) {
    const yes = data.filter(c => Array.isArray(c.secteurs) && c.secteurs.includes(secteur))
    const no  = data.filter(c => !Array.isArray(c.secteurs) || !c.secteurs.includes(secteur))
    data = [...yes, ...no]
  }

  return data
}

function humanVehicule(v?: boolean | null) {
  if (v === true) return "oui"
  if (v === false) return "non"
  return "inconnu"
}
function calcAge(date_naissance?: string | null): number | null {
  if (!date_naissance) return null
  const d = new Date(date_naissance + "T00:00:00Z")
  if (isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getUTCFullYear() - d.getUTCFullYear()
  const m = today.getUTCMonth() - d.getUTCMonth()
  if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age--
  return age
}
async function getCandidateById(supabase: any, id: string) {
  const { data } = await supabase.from("candidats")
    .select("id, nom, prenom, secteurs, vehicule, actif, ville, email, telephone, date_naissance")
    .eq("id", id).maybeSingle()
  return data || null
}

// ------------------------------ Route ------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, reply: "Méthode non autorisée." }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" }
    })
  }

  const tz = pickTZ(req)
  const supabase = supaFromReq(req)
  const me = await getMe(supabase)
  const users = await getAllUsers(supabase)
  const prenom = me?.prenom || "OK"

  const body = await req.json().catch(() => ({}))
  const message: string = body?.message ?? ""
  const fill = body?.fill ?? null

  // ---------- FILL: rappels (inchangé) ----------
  if (fill?.action === "set_time_from_base" && fill?.base_date_iso && fill?.time && fill?.title) {
    const base = new Date(fill.base_date_iso)
    const baseParts = partsFromTZ(base, tz)
    const hm = String(fill.time).match(/^([0-2]?\d):?([0-5]\d)?$/)
    const H = hm ? parseInt(hm[1], 10) : 9
    const M = hm && hm[2] ? parseInt(hm[2], 10) : 0
    const dueAt = makeDateInTZ(tz, baseParts.year, baseParts.month, baseParts.day, H, M, 0)

    const audience: "all"|"user"|"list" = fill.audience === "all" || fill.audience === "list" ? fill.audience : "user"
    let user_ids: string[] = []
    if (audience === "user") user_ids = me?.id ? [me.id] : []
    if (audience === "list" && Array.isArray(fill.user_ids)) user_ids = fill.user_ids

    const crt = await createReminder(supabase, me?.id ?? null, {
      title: fill.title, due_at: dueAt.toISOString(), audience, user_ids
    })
    if (!crt.ok) {
      return new Response(JSON.stringify(wrapReply("Erreur lors de la création du rappel.")), {
        headers: { ...CORS, "Content-Type": "application/json" }
      })
    }
    const who = audience === "all"
      ? " (à tous les utilisateurs)"
      : audience === "list"
        ? ` (${user_ids.map(id => users.find(u => u.id === id)?.prenom || "sélection").join(", ")})`
        : ""
    const txt = `C’est noté, ${prenom} : rappel « ${fill.title} » le ${formatFrDateTime(dueAt, tz)}${who}.`
    return new Response(JSON.stringify(wrapReply(txt, { reminders: crt.reminders })), {
      headers: { ...CORS, "Content-Type": "application/json" }
    })
  }
  if (fill?.action === "set_recipients" && Array.isArray(fill.user_ids) && fill.title) {
    const audience: "list" = "list"
    if (fill.base_date_iso && fill.time) {
      const base = new Date(fill.base_date_iso)
      const baseParts = partsFromTZ(base, tz)
      const hm = String(fill.time).match(/^([0-2]?\d):?([0-5]\d)?$/)
      const H = hm ? parseInt(hm[1], 10) : 9
      const M = hm && hm[2] ? parseInt(hm[2], 10) : 0
      const dueAt = makeDateInTZ(tz, baseParts.year, baseParts.month, baseParts.day, H, M, 0)
      const crt = await createReminder(supabase, me?.id ?? null, {
        title: fill.title, due_at: dueAt.toISOString(), audience, user_ids: fill.user_ids
      })
      if (!crt.ok) {
        return new Response(JSON.stringify(wrapReply("Erreur lors de la création du rappel.")), {
          headers: { ...CORS, "Content-Type": "application/json" }
        })
      }
      const who = ` (${fill.user_ids.map(id => users.find(u => u.id === id)?.prenom || "sélection").join(", ")})`
      const txt = `C’est noté, ${prenom} : rappel « ${fill.title} » le ${formatFrDateTime(dueAt, tz)}${who}.`
      return new Response(JSON.stringify(wrapReply(txt, { reminders: crt.reminders })), {
        headers: { ...CORS, "Content-Type": "application/json" }
      })
    }
    if (fill.base_date_iso) {
      const need = { title: fill.title, base_date_iso: fill.base_date_iso }
      const text = `Il me manque l’heure, ${prenom}. Tu veux planifier « ${fill.title} » à quel horaire ?`
      const choices = [
        { label: "09:00", payload: { action: "set_time_from_base", time: "09:00", title: fill.title, base_date_iso: need.base_date_iso, audience: "list", user_ids: fill.user_ids } },
        { label: "15:00", payload: { action: "set_time_from_base", time: "15:00", title: fill.title, base_date_iso: need.base_date_iso, audience: "list", user_ids: fill.user_ids } },
        { label: "18:00", payload: { action: "set_time_from_base", time: "18:00", title: fill.title, base_date_iso: need.base_date_iso, audience: "list", user_ids: fill.user_ids } },
      ]
      return new Response(JSON.stringify(wrapReply(text, { choices, meta: { need_time: need } })), {
        headers: { ...CORS, "Content-Type": "application/json" }
      })
    }
  }

  // ---------- Vide ----------
  if (!message.trim()) {
    return new Response(JSON.stringify(wrapReply("Message vide.")), {
      headers: { ...CORS, "Content-Type": "application/json" }
    })
  }

  // ---------- Smalltalk local ----------
  const low = normalize(message)
  const small = localSmalltalk(low, tz)
  if (small) {
    return new Response(JSON.stringify(wrapReply(small)), {
      headers: { ...CORS, "Content-Type": "application/json" }
    })
  }

  // ---------- Groq prioritaire ----------
  let intent: any = null
  try { intent = await groqParse(message, tz, me) } catch { intent = { intent: "unknown" } }

  // =======================
  // Rappels (existants)
  // =======================
  if (intent.intent === "reminder.create") {
    let title = extractTitleFromMessage(message, (intent.title || intent.note || "Rappel").toString().trim() || "Rappel")
    // audience
    let audience: "all"|"user"|"list" = "user"
    let user_ids: string[] = me?.id ? [me.id] : []
    const isAll = detectAudienceAll(message)
    if (isAll) { audience = "all"; user_ids = [] }
    else {
      const hits = findMentionedUsers(message, users).filter(u => !me || u.id !== me.id)
      if (hits.length === 1) { audience = "list"; user_ids = [hits[0].id] }
      else if (hits.length > 1) {
        // choix destinataires…
        let parsed = parseDateTextFR(intent.dateText || "", tz)
        if (!parsed) parsed = parseDateTextFR(message, tz)
        let ymd = parsed && parsed.mode === "ymd" ? parsed : null
        if (!ymd) { const p = partsFromTZ(new Date(), tz); ymd = { mode: "ymd", y: p.year, m: p.month, d: p.day } as any }
        const baseDate = makeDateInTZ(tz, (ymd as any).y, (ymd as any).m, (ymd as any).d, 0, 0, 0)
        const text = `Tu veux l’envoyer à qui exactement ?`
        const choices = hits.slice(0,5).map(h => ({
          label: h.label,
          payload: { action: "set_recipients", user_ids: [h.id], title, base_date_iso: baseDate.toISOString() }
        }))
        return new Response(JSON.stringify(wrapReply(text, { choices })), {
          headers: { ...CORS, "Content-Type": "application/json" }
        })
      }
    }
    // relatifs ?
    const relA = parseRelativeFR(intent.dateText || "")
    const relB = relA == null ? parseRelativeFR(message) : null
    const relDelta = relA ?? relB
    if (relDelta != null) {
      const dueAt = new Date(Date.now() + relDelta)
      const crt = await createReminder(supabase, me?.id ?? null, { title, due_at: dueAt.toISOString(), audience, user_ids })
      if (!crt.ok) return new Response(JSON.stringify(wrapReply("Erreur lors de la création du rappel.")), { headers: { ...CORS, "Content-Type": "application/json" } })
      const who = audience === "all" ? " (à tous les utilisateurs)" : audience === "list" ? ` (${user_ids.map(id => users.find(u => u.id === id)?.prenom || "sélection").join(", ")})` : ""
      const nice = `C’est noté, ${prenom} : rappel « ${title} » le ${formatFrDateTime(dueAt, tz)}${who}.`
      return new Response(JSON.stringify(wrapReply(nice, { reminders: crt.reminders })), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    // calendaire
    let parsed = parseDateTextFR(intent.dateText || "", tz); if (!parsed) parsed = parseDateTextFR(message, tz)
    let ymd = parsed && parsed.mode === "ymd" ? parsed : null
    if (!ymd) { const p = partsFromTZ(new Date(), tz); ymd = { mode: "ymd", y: p.year, m: p.month, d: p.day } as any }
    let hm = parseHourMinuteFR(intent.timeText || ""); if (!hm) hm = parseHourFromText(message)
    if (!hm) {
      const baseDate = makeDateInTZ(tz, (ymd as any).y, (ymd as any).m, (ymd as any).d, 0, 0, 0)
      const need = { title, base_date_iso: baseDate.toISOString() }
      const text = `Il me manque l’heure, ${prenom}. Tu veux planifier « ${title} » à quel horaire ?`
      const choices = [
        { label: "09:00", payload: { action: "set_time_from_base", time: "09:00", title, base_date_iso: need.base_date_iso, audience, user_ids } },
        { label: "15:00", payload: { action: "set_time_from_base", time: "15:00", title, base_date_iso: need.base_date_iso, audience, user_ids } },
        { label: "18:00", payload: { action: "set_time_from_base", time: "18:00", title, base_date_iso: need.base_date_iso, audience, user_ids } },
      ]
      return new Response(JSON.stringify(wrapReply(text, { choices, meta: { need_time: need } })), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    const dueAt = makeDateInTZ(tz, (ymd as any).y, (ymd as any).m, (ymd as any).d, hm.h, hm.min, 0)
    const crt = await createReminder(supabase, me?.id ?? null, { title, due_at: dueAt.toISOString(), audience, user_ids })
    if (!crt.ok) return new Response(JSON.stringify(wrapReply("Erreur lors de la création du rappel.")), { headers: { ...CORS, "Content-Type": "application/json" } })
    const who = audience === "all" ? " (à tous les utilisateurs)" : audience === "list" ? ` (${user_ids.map(id => users.find(u => u.id === id)?.prenom || "sélection").join(", ")})` : ""
    const nice = `C’est noté, ${prenom} : rappel « ${title} » le ${formatFrDateTime(dueAt, tz)}${who}.`
    return new Response(JSON.stringify(wrapReply(nice, { reminders: crt.reminders })), { headers: { ...CORS, "Content-Type": "application/json" } })
  }

  // =======================
  // CANDIDATS — résolution & attributs
  // =======================

  // FILL: action déclenchée par un bouton de choix candidat
  if (fill?.action === "candidate_info" && fill?.candidate_id && fill?.attribute) {
    const c = await getCandidateById(supabase, fill.candidate_id)
    if (!c) {
      return new Response(JSON.stringify(wrapReply("Candidat introuvable.")), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    const full = `${c.nom} ${c.prenom}`.trim()
    const attr = String(fill.attribute)
    if (attr === "vehicule") {
      return new Response(JSON.stringify(wrapReply(`${full} est-il véhiculé ? → ${humanVehicule(c.vehicule)}.`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (attr === "age") {
      const age = calcAge(c.date_naissance)
      return new Response(JSON.stringify(wrapReply(`${full} a ${age ?? "un âge inconnu"}${age ? " ans" : ""}.`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (attr === "secteurs") {
      const list = Array.isArray(c.secteurs) && c.secteurs.length ? c.secteurs.join(", ") : "aucun secteur renseigné"
      return new Response(JSON.stringify(wrapReply(`Secteurs de ${full} : ${list}.`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (attr === "telephone") {
      return new Response(JSON.stringify(wrapReply(`Téléphone de ${full} : ${c.telephone || "non renseigné"}.`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (attr === "email") {
      return new Response(JSON.stringify(wrapReply(`Email de ${full} : ${c.email || "non renseigné"}.`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (attr === "ville") {
      return new Response(JSON.stringify(wrapReply(`Ville de ${full} : ${c.ville || "non renseignée"}.`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    // fallback
    return new Response(JSON.stringify(wrapReply(`Attribut « ${attr} » non pris en charge (encore).`)), { headers: { ...CORS, "Content-Type": "application/json" } })
  }

  if (intent.intent === "candidate.attribute" || intent.intent === "candidate.resolve") {
    const name = (intent.candidateName || "").trim()
    const secteur = (intent.secteur || null) as (null | "etages"|"cuisine"|"salle"|"plonge"|"reception")
    const attribute = intent.attribute || null

    if (!name) {
      return new Response(JSON.stringify(wrapReply(`Tu parles de quel·le candidat·e, ${prenom} ?`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    const matches = await findCandidates(supabase, name, secteur)

    if (!matches.length) {
      return new Response(JSON.stringify(wrapReply(`Je ne trouve aucun·e candidat·e proche de « ${name} ».`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (matches.length > 1) {
      const choices = matches.slice(0, 6).map((c: any) => {
        const label = `${c.nom} ${c.prenom}`.trim()
        // si demande d’attribut → payload pour réponse directe après clic
        if (attribute) {
          return { label, payload: { action: "candidate_info", candidate_id: c.id, attribute } }
        }
        // sinon, simple “sélection”
        return { label, payload: { action: "candidate_info", candidate_id: c.id, attribute: "secteurs" } }
      })
      const text = `J’ai plusieurs correspondances. De qui parlais-tu ?`
      return new Response(JSON.stringify(wrapReply(text, { choices })), { headers: { ...CORS, "Content-Type": "application/json" } })
    }

    // un seul match
    const c = matches[0]
    const full = `${c.nom} ${c.prenom}`.trim()
    if (!attribute || intent.intent === "candidate.resolve") {
      // simple confirmation de résolution
      const list = Array.isArray(c.secteurs) && c.secteurs.length ? c.secteurs.join(", ") : "—"
      const text = `Trouvé : ${full} (secteurs: ${list}).`
      return new Response(JSON.stringify(wrapReply(text, { entity: { type: "candidate", id: c.id, label: full } })), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (attribute === "vehicule") {
      return new Response(JSON.stringify(wrapReply(`${full} est-il véhiculé ? → ${humanVehicule(c.vehicule)}.`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (attribute === "age") {
      const age = calcAge(c.date_naissance)
      return new Response(JSON.stringify(wrapReply(`${full} a ${age ?? "un âge inconnu"}${age ? " ans" : ""}.`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (attribute === "secteurs") {
      const list = Array.isArray(c.secteurs) && c.secteurs.length ? c.secteurs.join(", ") : "aucun secteur renseigné"
      return new Response(JSON.stringify(wrapReply(`Secteurs de ${full} : ${list}.`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (attribute === "telephone") {
      return new Response(JSON.stringify(wrapReply(`Téléphone de ${full} : ${c.telephone || "non renseigné"}.`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (attribute === "email") {
      return new Response(JSON.stringify(wrapReply(`Email de ${full} : ${c.email || "non renseigné"}.`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (attribute === "ville") {
      return new Response(JSON.stringify(wrapReply(`Ville de ${full} : ${c.ville || "non renseignée"}.`)), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    return new Response(JSON.stringify(wrapReply(`Attribut « ${attribute} » non pris en charge (encore).`)), { headers: { ...CORS, "Content-Type": "application/json" } })
  }

  // ---------- Fallback ----------
  const txt = `Pour l’instant, je gère les rappels ⏰ et la recherche candidats 👤 (véhicule, âge, secteurs, téléphone, email, ville).`
  return new Response(JSON.stringify(wrapReply(txt)), {
    headers: { ...CORS, "Content-Type": "application/json" }
  })
})
