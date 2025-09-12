// @ts-nocheck
// Agent ADAPTEL — Rappels béton (heure Europe/Paris & audience utilisateurs), Groq prioritaire

import { createClient } from "jsr:@supabase/supabase-js@2"

// ------------------------------ CORS ------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-tz",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ------------------------------ TZ helpers (sans décalage) ------------------------------
// Nous construisons un instant UTC à partir de composants (Y/M/D h:m) "dans le fuseau Europe/Paris"
// en calculant l'offset exact (y compris changements d'heure).
type Parts = { year:number; month:number; day:number; hour:number; minute:number; second?:number }

function pickTZ(req: Request) {
  const h = req.headers.get("x-agent-tz")
  return h && h.trim() ? h.trim() : "Europe/Paris"
}
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }

// Retourne les "parts" de la date `d` dans le fuseau `tz`
function getPartsInTZ(d: Date, tz: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  })
  const parts = fmt.formatToParts(d)
  const v = (t:string)=> Number(parts.find(p=>p.type===t)?.value || "0")
  return {
    year: v("year"),
    month: v("month"),
    day: v("day"),
    hour: v("hour"),
    minute: v("minute"),
    second: v("second"),
  }
}

// Offset minutes de `tz` à l’instant `d`
function getTzOffsetMinutes(d: Date, tz: string): number {
  // timeZoneName:'shortOffset' → ex: "GMT+2", "GMT+01:00"
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  })
  const label = fmt.formatToParts(d).find(p=>p.type==="timeZoneName")?.value || "GMT+0"
  // parse "GMT+2" ou "GMT+01:00"
  const m = label.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/)
  if (!m) return 0
  const sign = m[1] === "-" ? -1 : 1
  const hh = Number(m[2] || "0")
  const mm = Number(m[3] || "0")
  return sign * (hh*60 + mm)
}

// Construit un Date (UTC) à partir de composants "locaux" dans `tz`
function makeZonedUTC(parts: Parts, tz: string): Date {
  const safe: Parts = {
    year: parts.year, month: clamp(parts.month,1,12), day: clamp(parts.day,1,31),
    hour: clamp(parts.hour,0,23), minute: clamp(parts.minute,0,59),
    second: clamp(parts.second ?? 0,0,59),
  }
  // Instant "supposé" UTC
  const provisionalUtc = new Date(Date.UTC(safe.year, safe.month-1, safe.day, safe.hour, safe.minute, safe.second))
  // Offset réel du TZ à cet instant
  const offMin = getTzOffsetMinutes(provisionalUtc, tz)
  // L’instant UTC correspondant à "YYYY-MM-DD HH:mm (dans tz)" = Date.UTC(...) - offset
  return new Date(provisionalUtc.getTime() - offMin*60_000)
}

// "Maintenant" en TZ (retourne aussi l’instant UTC)
function nowInTZ(tz: string) {
  const now = new Date()
  const p = getPartsInTZ(now, tz)
  const utc = makeZonedUTC(p, tz) // c’est le même instant
  return { utc, parts: p }
}

// Ajoute X minutes à un "maintenant" TZ puis fabrique l’UTC correct
function addMinutesInTZ(minutes: number, tz: string) {
  const { parts } = nowInTZ(tz)
  const date = new Date(Date.UTC(parts.year, parts.month-1, parts.day, parts.hour, parts.minute, 0))
  date.setUTCMinutes(date.getUTCMinutes() + minutes)
  const newParts = getPartsInTZ(date, tz)
  return makeZonedUTC(newParts, tz)
}

// Formattages FR (affichage humain)
function formatFrDateTimeTZ(dUTC: Date, tz: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    weekday:"long", day:"2-digit", month:"long", year:"numeric",
    hour:"2-digit", minute:"2-digit"
  }).format(dUTC)
}

// ------------------------------ Parsing FR (rappels) ------------------------------
const WEEKDAYS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"]

function parseHourMinuteFR(raw: string | null | undefined) {
  if (!raw) return null
  const s = raw.trim().toLowerCase().replace(/\s+/g,"")
  // 14h, 14h30, 14:30, 14H30, 9h, 9
  const m = s.match(/^([0-2]?\d)(?:[:h\.]?([0-5]?\d))?$/i)
  if (!m) return null
  const h = clamp(parseInt(m[1]!,10), 0, 23)
  const min = m[2] ? clamp(parseInt(m[2],10), 0, 59) : 0
  return { h, min }
}

function parseRelativeMinutes(text: string) {
  const t = text.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase()
  const m = t.match(/\bdans\s+(\d{1,3})\s*min(?:ute)?s?\b/)
  if (m) return parseInt(m[1], 10)
  return null
}

function parseDateWord(text: string, tz: string): Parts | null {
  const t = text.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase()
  const { parts } = nowInTZ(tz)
  // aujourd'hui
  if (/\baujourdhui\b|\baujourd'hui\b/.test(t)) {
    return { ...parts }
  }
  // demain
  if (/\bdemain\b/.test(t)) {
    const d = new Date(Date.UTC(parts.year, parts.month-1, parts.day, parts.hour, parts.minute))
    d.setUTCDate(d.getUTCDate()+1)
    const np = getPartsInTZ(d, tz)
    return { ...np }
  }
  // lundi..dimanche (+ option prochain)
  for (const w of WEEKDAYS) {
    const re = new RegExp(`\\b${w}(?:\\s+prochain)?\\b`)
    const m = t.match(re)
    if (m) {
      // trouver le prochain "w"
      const today = new Date(Date.UTC(parts.year, parts.month-1, parts.day, 12, 0))
      const todayIdx = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday:"long" }).formatToParts(today)[0]
      // plus simple : on itère jours jusqu’au nom voulu
      let probe = today
      for (let i=0;i<14;i++) {
        const name = new Intl.DateTimeFormat("fr-FR",{ timeZone: tz, weekday:"long" }).format(probe).toLowerCase()
        if (name === w) {
          if (/prochain/.test(m[0])) probe = new Date(probe.getTime()+7*86400_000)
          const np = getPartsInTZ(probe, tz)
          return { ...np, hour: 9, minute: 0 } // heure par défaut si non donnée
        }
        probe = new Date(probe.getTime()+86400_000)
      }
    }
  }
  return null
}

function parseExplicitFR(text: string, tz: string): { date: Parts, time?: {h:number,min:number} } | null {
  const t = text.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase()
  // dd/mm[/yyyy] + heure optionnelle
  const dmy = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/)
  if (dmy) {
    const { parts } = nowInTZ(tz)
    const day = clamp(parseInt(dmy[1],10),1,31)
    const mon = clamp(parseInt(dmy[2],10),1,12)
    const year = dmy[3] ? parseInt(dmy[3],10) : parts.year
    const hm = t.match(/\b(\d{1,2})(?:[:h\.]([0-5]?\d))?\b/)
    let time = null
    if (hm) {
      const hh = clamp(parseInt(hm[1],10),0,23)
      const mm = hm[2] ? clamp(parseInt(hm[2],10),0,59) : 0
      time = { h: hh, min: mm }
    }
    return { date: { year, month: mon, day, hour: 9, minute: 0 }, time: time || undefined }
  }
  return null
}

// ------------------------------ Supabase helpers ------------------------------
function supaFromReq(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!
  const authHeader = req.headers.get("Authorization") ?? ""
  return createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
}

async function getMe(supabase: any) {
  try {
    const { data: auth } = await supabase.auth.getUser()
    const email = auth?.user?.email
    if (!email) return null
    const { data } = await supabase.from("utilisateurs")
      .select("id, prenom, nom, email, actif")
      .eq("email", email)
      .maybeSingle()
    return data ?? null
  } catch { return null }
}

async function findUsersByName(supabase: any, text: string) {
  const q = (text||"").trim()
  if (!q) return []
  // tolérant nom/prénom, casse/accents
  const { data } = await supabase.from("utilisateurs")
    .select("id, prenom, nom, email, actif")
    .or(`prenom.ilike.%${q}%,nom.ilike.%${q}%`)
    .limit(10)
  return data || []
}

// ------------------------------ GROQ intent (prioritaire mais tolérant) ------------------------------
const GROQ_API = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.1-70b-versatile"

async function groqIntent(message: string, tz: string, me: any) {
  const key = Deno.env.get("GROQ_API_KEY")
  if (!key) return { intent:"unknown" }

  const system = `
Tu es l'agent ADAPTEL Lyon. Sors STRICTEMENT un JSON compact.
INTENTS:
- "reminder.create"
- "smalltalk.date_today"
- "smalltalk.time_now"
- "unknown"
Champs possibles:
- "title", "dateText", "timeText", "audienceText", "people" (array de prénoms/noms)
Réponds UNIQUEMENT avec le JSON (une seule ligne).`
  const user = `TZ=${tz}; User=${me?.prenom||""} ${me?.nom||""} (${me?.email||""})
Message: ${message}`

  try {
    const res = await fetch(GROQ_API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      })
    })
    if (!res.ok) return { intent:"unknown" }
    const j = await res.json().catch(()=>null)
    const txt = j?.choices?.[0]?.message?.content?.trim() || "{}"
    const obj = JSON.parse(txt)
    if (obj && typeof obj==="object" && obj.intent) return obj
    return { intent:"unknown" }
  } catch { return { intent:"unknown" } }
}

// ------------------------------ Audience & date building ------------------------------
function detectAudienceAll(text: string) {
  const t = text.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase()
  return /\b(a\s+tout\s+le\s+monde|a\s+tous|a\s+tous\s+les\s+utilisateurs|toute\s+l(?:e|a)\s*equipe|a\s+l[e']?equipe)\b/.test(t)
}

async function resolveAudience(supabase:any, me:any, message:string, groq:any) {
  // all ?
  if (detectAudienceAll(message) || /all/i.test(groq?.audienceText||"")) {
    return { audience:"all", user_ids:[] as string[], label:"à tous les utilisateurs" }
  }

  // personnes nommées ?
  const people = Array.isArray(groq?.people) ? groq.people : []
  const mentioned = [...people]
  // Ajout heuristique si "à Céline", "pour Hélène"
  const m = message.match(/\b(?:a|pour)\s+([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,})\b/i)
  if (m) mentioned.push(m[1])

  const ids: string[] = []
  const names: string[] = []
  for (const token of mentioned) {
    const found = await findUsersByName(supabase, token)
    if (found.length === 1) {
      ids.push(found[0].id)
      names.push(`${found[0].prenom} ${found[0].nom}`.trim())
    } else if (found.length > 1) {
      // si doublons, on ne prend personne → l’agent te demandera bientôt une précision
    }
  }

  if (ids.length > 0) return { audience:"list", user_ids: ids, label: names.join(", ") }
  // défaut → l’utilisateur courant
  return { audience:"user", user_ids: [], label: `${me?.prenom||""} ${me?.nom||""}`.trim() || "toi" }
}

function buildDueAt(message:string, tz:string, groq:any): { dueUTC: Date | null, needTime:boolean, baseLabel:string } {
  // 1) "dans X minutes"
  const rel = parseRelativeMinutes(message)
  if (rel !== null) {
    return { dueUTC: addMinutesInTZ(rel, tz), needTime:false, baseLabel:"dans " + rel + " minutes" }
  }

  // 2) date naturelle
  const dateWord = parseDateWord(groq?.dateText || message, tz)
  const explicit = parseExplicitFR(groq?.dateText || message, tz)
  // Si Groq a sorti une timeText, on la prend
  const hmGroq = parseHourMinuteFR(groq?.timeText || "")

  if (explicit) {
    const p = explicit.date
    const hm = explicit.time || hmGroq || { h: 9, min: 0 }
    const due = makeZonedUTC({ year:p.year, month:p.month, day:p.day, hour: hm.h, minute: hm.min, second:0 }, tz)
    return { dueUTC: due, needTime:false, baseLabel:`le ${new Intl.DateTimeFormat("fr-FR",{ timeZone: tz, day:"2-digit",month:"2-digit",year:"numeric"}).format(due)}` }
  }

  if (dateWord) {
    const hm = hmGroq || parseHourMinuteFR(message)
    if (!hm) {
      // il manque l’heure → proposer
      const placeholder = makeZonedUTC({ year:dateWord.year, month:dateWord.month, day:dateWord.day, hour:9, minute:0, second:0 }, tz)
      return { dueUTC: placeholder, needTime:true, baseLabel:"" }
    }
    const due = makeZonedUTC({ year:dateWord.year, month:dateWord.month, day:dateWord.day, hour: hm.h, minute: hm.min, second:0 }, tz)
    return { dueUTC: due, needTime:false, baseLabel:"" }
  }

  // 3) uniquement heure ?
  const hmOnly = parseHourMinuteFR(groq?.timeText || message)
  if (hmOnly) {
    const { parts } = nowInTZ(tz)
    const due = makeZonedUTC({ year:parts.year, month:parts.month, day:parts.day, hour: hmOnly.h, minute: hmOnly.min, second:0 }, tz)
    return { dueUTC: due, needTime:false, baseLabel:"aujourd’hui" }
  }

  // rien de sûr
  return { dueUTC: null, needTime:true, baseLabel:"" }
}

// ------------------------------ Rappels ------------------------------
async function createReminder(supabase:any, created_by:string|null, args:{
  title:string, due_at:Date, audience:"user"|"all"|"list", user_ids:string[]
}) {
  const { title, due_at, audience, user_ids } = args
  const ins = await supabase.from("agent_reminders").insert({
    created_by, title, due_at: due_at.toISOString(),
    audience, user_ids: audience === "list" ? user_ids : [],
    status: "pending", urgent: false
  }).select("*").single()
  if (ins.error) return { ok:false, error: ins.error.message }
  return { ok:true, data: ins.data }
}

// ------------------------------ Replies (compat AgentWidget) ------------------------------
function wrapReply(text: string, extras?: any) {
  const msg = { id: crypto.randomUUID(), text }
  const out: any = { ok: true, reply: text, replies: [msg] }
  if (extras) Object.assign(out, extras)
  return out
}

// ------------------------------ Route ------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok:false, reply:"Méthode non autorisée." }), { status:405, headers:{...corsHeaders,"Content-Type":"application/json"} })
  }

  const tz = pickTZ(req)
  const supabase = supaFromReq(req)
  const me = await getMe(supabase)
  const prenom = me?.prenom || "OK"

  const body = await req.json().catch(()=>({}))
  const message: string = body?.message ?? ""
  const fill = body?.fill ?? null

  if (!message && !fill) {
    return new Response(JSON.stringify(wrapReply("Message vide.")), { headers:{...corsHeaders,"Content-Type":"application/json"} })
  }

  // --------- FILL: set_time_from_base ---------
  if (fill?.action === "set_time_from_base" && fill?.base_date_iso && fill?.time) {
    const hm = parseHourMinuteFR(String(fill.time))
    if (!hm) {
      const t = "Heure invalide. Essaie par ex. 09:00, 14h30, 18:00."
      return new Response(JSON.stringify(wrapReply(t)), { headers:{...corsHeaders,"Content-Type":"application/json"} })
    }
    const base = new Date(fill.base_date_iso) // UTC
    // on re-projette la date de base en TZ, mais on remplace l’heure
    const baseParts = getPartsInTZ(base, tz)
    const due = makeZonedUTC({ year:baseParts.year, month:baseParts.month, day:baseParts.day, hour: hm.h, minute: hm.min, second:0 }, tz)
    const crt = await createReminder(supabase, me?.id ?? null, { title: fill.title || "Rappel", due_at: due, audience: "user", user_ids: [] })
    if (!crt.ok) return new Response(JSON.stringify(wrapReply("Erreur lors de la création du rappel.")), { headers:{...corsHeaders,"Content-Type":"application/json"} })
    const nice = `C’est noté, ${prenom} : rappel « ${crt.data.title} » le ${formatFrDateTimeTZ(due, tz)}.`
    return new Response(JSON.stringify(wrapReply(nice, { reminders:[crt.data] })), { headers:{...corsHeaders,"Content-Type":"application/json"} })
  }

  // --------- Raccourcis simples (date/heure) ---------
  const low = message.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase()
  if (/\b(quel(?:le)?\s+jour|date)\b/.test(low)) {
    const { utc } = nowInTZ(tz)
    const txt = `On est ${new Intl.DateTimeFormat("fr-FR",{ timeZone: tz, weekday:"long", day:"2-digit", month:"long", year:"numeric"}).format(utc)}.`
    return new Response(JSON.stringify(wrapReply(txt)), { headers:{...corsHeaders,"Content-Type":"application/json"} })
  }
  if (/\b(quelle?\s+heure\s+est[-\s]?il|quelle?\s+heure)\b/.test(low)) {
    const { utc } = nowInTZ(tz)
    const txt = `Il est ${new Intl.DateTimeFormat("fr-FR",{ timeZone: tz, hour:"2-digit", minute:"2-digit"}).format(utc)}.`
    return new Response(JSON.stringify(wrapReply(txt)), { headers:{...corsHeaders,"Content-Type":"application/json"} })
  }

  // --------- INTENT via Groq (prioritaire) ---------
  const intent = await groqIntent(message, tz, me)

  // --------- Rappel (create) ---------
  if (intent.intent === "reminder.create" || /rappel|rappelle|note|notif/i.test(message)) {
    const audience = await resolveAudience(supabase, me, message, intent)
    const title = (intent.title || "").trim() || // ex: "Contacter Y"
                  (message.split(":").pop() || "").trim() ||
                  "Rappel"

    const when = buildDueAt(message, tz, intent)
    if (when.needTime) {
      const base = when.dueUTC ?? addMinutesInTZ(60, tz)
      const need = { title, base_date_iso: base.toISOString() }
      const text = `Il me manque l’heure, ${prenom}. Tu veux planifier « ${title} » à quel horaire ?`
      const choices = ["09:00","15:00","18:00"].map(label => ({
        label,
        payload: { action:"set_time_from_base", time: label, title, base_date_iso: need.base_date_iso }
      }))
      return new Response(JSON.stringify(wrapReply(text, { choices, meta:{ need_time: need } })), { headers:{...corsHeaders,"Content-Type":"application/json"} })
    }
    if (!when.dueUTC) {
      return new Response(JSON.stringify(wrapReply(`Je n’ai pas compris la date/heure du rappel.`)), { headers:{...corsHeaders,"Content-Type":"application/json"} })
    }

    const crt = await createReminder(supabase, me?.id ?? null, {
      title, due_at: when.dueUTC, audience: audience.audience as any, user_ids: audience.user_ids
    })
    if (!crt.ok) {
      return new Response(JSON.stringify(wrapReply("Erreur lors de la création du rappel.")), { headers:{...corsHeaders,"Content-Type":"application/json"} })
    }
    const who = audience.audience === "all" ? "à tous les utilisateurs" :
                audience.audience === "list" ? `(${audience.label})` : ""
    const nice = `C’est noté, ${prenom} : rappel « ${title} » le ${formatFrDateTimeTZ(when.dueUTC, tz)}${who ? " " + who : ""}.`
    return new Response(JSON.stringify(wrapReply(nice, { reminders:[crt.data] })), { headers:{...corsHeaders,"Content-Type":"application/json"} })
  }

  // --------- Smalltalk ---------
  if (intent.intent === "smalltalk.date_today") {
    const { utc } = nowInTZ(tz)
    const txt = `On est ${new Intl.DateTimeFormat("fr-FR",{ timeZone: tz, weekday:"long", day:"2-digit", month:"long", year:"numeric"}).format(utc)}.`
    return new Response(JSON.stringify(wrapReply(txt)), { headers:{...corsHeaders,"Content-Type":"application/json"} })
  }
  if (intent.intent === "smalltalk.time_now") {
    const { utc } = nowInTZ(tz)
    const txt = `Il est ${new Intl.DateTimeFormat("fr-FR",{ timeZone: tz, hour:"2-digit", minute:"2-digit"}).format(utc)}.`
    return new Response(JSON.stringify(wrapReply(txt)), { headers:{...corsHeaders,"Content-Type":"application/json"} })
  }

  // --------- Fallback aide ---------
  const help = [
    "Je peux t’aider avec tes rappels ⏰",
    "Exemples :",
    "• « Rappelle-moi dans 5 minutes : envoyer le mail »",
    "• « Fais un rappel demain à 10h30 : appeler la gouvernante »",
    "• « Rappel à Hélène dans 15 minutes : contacter Y »",
    "• « Rappel à tout le monde lundi prochain à 11h : mettre vos CP à jour »",
  ].join("\n")
  return new Response(JSON.stringify(wrapReply(help)), { headers:{...corsHeaders,"Content-Type":"application/json"} })
})
