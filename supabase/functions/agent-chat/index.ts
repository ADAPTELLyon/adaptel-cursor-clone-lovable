// @ts-nocheck
// supabase/functions/agent-chat/index.ts
// Agent ADAPTEL — Rappels fiables (relatifs, dates FR, heures FR, audiences users/all/list) + smalltalk heure/date.
// Groq est TOLÉRÉ mais NON-BLOQUANT : la logique locale prime pour fiabilité.

import { createClient } from "jsr:@supabase/supabase-js@2"

// ---------------- CORS ----------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-tz",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ---------------- TZ helpers ----------------
function pickTZ(req: Request) {
  const h = req.headers.get("x-agent-tz")
  return h && h.trim() ? h.trim() : "Europe/Paris"
}
function nowInTZ(tz: string) {
  // Crée un "now" en horloge locale du TZ, puis re-crée un Date réel
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }))
}
function toISO(d: Date | string | number) {
  return new Date(d).toISOString() // UTC ISO pour stockage
}
function formatFrDateTime(d: Date, tz: string) {
  return new Date(d).toLocaleString("fr-FR", {
    timeZone: tz, weekday: "long", day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  })
}
function formatFrDate(d: Date, tz: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    timeZone: tz, weekday: "long", day: "2-digit", month: "long", year: "numeric"
  })
}
function ymdFromTZ(d: Date, tz: string) {
  return new Date(d).toLocaleDateString("fr-CA", { timeZone: tz }) // yyyy-mm-dd
}
function cloneInTZ(base: Date, tz: string) {
  const d = nowInTZ(tz)
  d.setFullYear(base.getFullYear(), base.getMonth(), base.getDate())
  d.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds())
  return d
}
function addMinutesTZ(base: Date, minutes: number, tz: string) {
  const d = cloneInTZ(base, tz)
  d.setMinutes(d.getMinutes() + minutes)
  return d
}
function addHoursTZ(base: Date, hours: number, tz: string) {
  const d = cloneInTZ(base, tz)
  d.setHours(d.getHours() + hours)
  return d
}
function addDaysTZ(base: Date, days: number, tz: string) {
  const d = cloneInTZ(base, tz)
  d.setDate(d.getDate() + days)
  return d
}
function addWeeksTZ(base: Date, w: number, tz: string) {
  return addDaysTZ(base, 7 * w, tz)
}

// ---------------- Supabase ----------------
function supaFromReq(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!
  const authHeader = req.headers.get("Authorization") ?? ""
  return createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })
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
  } catch {
    return null
  }
}

// ---------------- Smalltalk shortcuts (fiabilité UX immédiate) ----------------
function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
}
const WEEKDAYS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"]

// ---------------- Parsing FR: heure ----------------
function parseHourMinuteFR(input: string | null | undefined): {h:number,min:number}|null {
  if (!input) return null
  const t = normalize(input).replace(/\s+/g, "")
  // Ex: 14h, 14H, 14h30, 14:30, 14 30, 9h, 9
  const m = t.match(/^([0-2]?\d)(?:[:h]?([0-5]?\d))?$/)
  if (!m) return null
  const h = Math.min(23, parseInt(m[1], 10))
  const min = m[2] ? Math.min(59, parseInt(m[2], 10)) : 0
  return { h, min }
}
// tente d'extraire une heure quelque part dans la phrase
function findHourInTextFR(text: string): {h:number,min:number}|null {
  const t = normalize(text)
  // capture la 1re occurrence d'heure
  const m = t.match(/\b([01]?\d|2[0-3])(?:[:h ]?([0-5]\d))?\b/)
  if (!m) return null
  const h = parseInt(m[1],10)
  const min = m[2] ? parseInt(m[2],10) : 0
  return { h, min }
}

// ---------------- Parsing FR: relatif ----------------
function parseRelativeFR(text: string, tz: string): Date | null {
  const t = normalize(text)
  const now = nowInTZ(tz)

  // minutes
  let m = t.match(/\bdans\s+(\d+)\s*minutes?\b/)
  if (m) return addMinutesTZ(now, parseInt(m[1],10), tz)

  // heures
  m = t.match(/\bdans\s+(\d+)\s*heures?\b/)
  if (m) return addHoursTZ(now, parseInt(m[1],10), tz)

  // jours
  m = t.match(/\bdans\s+(\d+)\s*jours?\b/)
  if (m) return addDaysTZ(now, parseInt(m[1],10), tz)

  // semaines
  m = t.match(/\bdans\s+(\d+)\s*semaines?\b/)
  if (m) return addWeeksTZ(now, parseInt(m[1],10), tz)

  return null
}

// ---------------- Parsing FR: date nommée/explicite ----------------
function nextWeekdayDate(name: string, from: Date) {
  const idx = WEEKDAYS.indexOf(name)
  if (idx < 0) return null
  const cur = from.getDay()
  let diff = idx - cur
  if (diff <= 0) diff += 7
  const d = new Date(from)
  d.setDate(d.getDate() + diff)
  d.setHours(0,0,0,0)
  return d
}
function parseDateTextFR(text: string, tz: string): Date | null {
  const base = nowInTZ(tz)
  const t = normalize(text)

  if (/\baujourdhui\b/.test(t) || /\baujourd'hui\b/.test(t)) {
    const d = new Date(base); d.setHours(0,0,0,0); return d
  }
  if (/\bdemain\b/.test(t)) {
    const d = new Date(base); d.setDate(d.getDate()+1); d.setHours(0,0,0,0); return d
  }
  // mercredi prochain etc.
  for (const w of WEEKDAYS) {
    const re = new RegExp(`\\b${w}(?:\\s+prochain)?\\b`)
    const m = t.match(re)
    if (m) {
      let d = nextWeekdayDate(w, base)!
      if (/prochain/.test(m[0])) d.setDate(d.getDate() + 7)
      return d
    }
  }
  // dd/mm[/yyyy]
  const fr = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/)
  if (fr) {
    const day = parseInt(fr[1], 10)
    const mon = parseInt(fr[2], 10)
    const year = fr[3] ? parseInt(fr[3], 10) : base.getFullYear()
    const d = new Date(base); d.setFullYear(year, mon-1, day); d.setHours(0,0,0,0); return d
  }
  // yyyy-mm-dd
  const iso = t.match(/\b(20\d{2})-(0?\d|1[0-2])-(0?\d|[12]\d|3[01])\b/)
  if (iso) {
    const y = parseInt(iso[1],10), m = parseInt(iso[2],10), da = parseInt(iso[3],10)
    const d = new Date(base); d.setFullYear(y, m-1, da); d.setHours(0,0,0,0); return d
  }
  return null
}

// ---------------- Utilisateurs (audience) ----------------
async function searchUsersFromMessage(supabase: any, message: string) {
  // Renvoie la liste des utilisateurs dont prénom/nom matchent (ilike) la phrase
  const { data: users } = await supabase
    .from("utilisateurs")
    .select("id, prenom, nom, actif")
    .eq("actif", true)
  const t = normalize(message)
  const hits: any[] = []
  for (const u of users || []) {
    const full = normalize(`${u.prenom} ${u.nom}`)
    const prenom = normalize(u.prenom)
    const nom = normalize(u.nom)
    // match si au moins prénom ou nom présent (ou proche)
    if (t.includes(prenom) || t.includes(nom) || t.includes(full)) {
      hits.push(u)
      continue
    }
    // légère tolérance sur 1 faute simple (levenshtein light = présence de 80% des bigrams)
    if (isLooseMatch(t, prenom) || isLooseMatch(t, nom)) hits.push(u)
  }
  // dédoublonnage par id
  const uniq = Array.from(new Map(hits.map(u => [u.id, u])).values())
  return uniq
}
function bigrams(s: string) {
  const t = s.replace(/[^a-z0-9]/g, "")
  const arr: string[] = []
  for (let i=0;i<t.length-1;i++) arr.push(t.slice(i,i+2))
  return arr
}
function isLooseMatch(hay: string, needle: string) {
  const b1 = new Set(bigrams(hay))
  const b2 = bigrams(needle)
  if (!b2.length) return false
  let ok=0
  for (const b of b2) if (b1.has(b)) ok++
  return ok / b2.length >= 0.6 // 60% de recouvrement bigram
}

// ---------------- Extraction Titre ----------------
function extractTitle(message: string) {
  const parts = message.split(":")
  if (parts.length > 1) {
    const last = parts.slice(1).join(":").trim()
    if (last.length > 1) return last
  }
  // fallback: après "pour ..."
  const m = message.match(/\b(?:pour|:)\s*(.+)$/i)
  if (m && m[1].trim()) return m[1].trim()
  return "Rappel"
}

// ---------------- Audience detection ----------------
function detectAudienceKind(text: string): "all"|"list"|"user" {
  const t = normalize(text)
  if (
    /\ba tout le monde\b/.test(t) ||
    /\bà tout le monde\b/.test(text) ||
    /\ba tous\b/.test(t) || /\bà tous\b/.test(text) ||
    /\btous les utilisateurs\b/.test(t) ||
    /\btoute l(e|a)quipe\b/.test(t)
  ) return "all"
  // "à Céline / pour Céline / pour Hélène" etc. => on traitera comme "list" si des users trouvés
  return "user"
}

// ---------------- DB: create reminder ----------------
async function createReminder(supabase: any, args: {
  created_by: string|null,
  title: string,
  due_at_iso: string,
  audience: "user"|"list"|"all",
  user_ids: string[],
}) {
  const payload = {
    created_by: args.created_by,
    title: args.title,
    body: null,
    due_at: args.due_at_iso,
    audience: args.audience,
    user_ids: args.audience === "list" ? args.user_ids : [],
    status: "pending",
    urgent: false,
  }
  const ins = await supabase.from("agent_reminders").insert(payload).select("*").single()
  if (ins.error) {
    return { ok: false, error: ins.error.message }
  }
  return { ok: true, reminder: ins.data }
}

// ---------------- Reply wrapper (compatible widget) ----------------
function wrapReply(text: string, extras?: any) {
  const msg = { id: crypto.randomUUID(), text }
  const out: any = { ok: true, reply: text, replies: [msg] }
  if (extras) Object.assign(out, extras)
  return out
}

// ---------------- Route ----------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok:false, reply:"Méthode non autorisée." }), {
      status:405, headers:{...corsHeaders,"Content-Type":"application/json"}
    })
  }

  const tz = pickTZ(req)
  const supabase = supaFromReq(req)
  const me = await getMe(supabase)
  const prenom = me?.prenom || "OK"

  const body = await req.json().catch(()=>({}))
  const message: string = body?.message ?? ""
  if (!message.trim()) {
    return new Response(JSON.stringify(wrapReply("Message vide.")), { headers:{...corsHeaders,"Content-Type":"application/json"} })
  }

  const low = normalize(message)

  // ---------- Smalltalk fixes ----------
  if (/quel(le)?\s+jour/.test(low) || /date\s+d['e]?\s*aujourd/.test(low)) {
    const txt = `On est ${formatFrDate(nowInTZ(tz), tz)}.`
    return new Response(JSON.stringify(wrapReply(txt)), { headers:{...corsHeaders,"Content-Type":"application/json"} })
  }
  if (/quelle?\s+heure\s+est.?il/.test(low) || /\bheure\?$/.test(low)) {
    const txt = `Il est ${new Date().toLocaleTimeString("fr-FR",{ timeZone: tz, hour:"2-digit", minute:"2-digit" })}.`
    return new Response(JSON.stringify(wrapReply(txt)), { headers:{...corsHeaders,"Content-Type":"application/json"} })
  }

  // ---------- Détection "rappel" ----------
  const isReminder = /\brappel(e|)\b/.test(low) || /\bnote\s+.*rappel\b/.test(low) || /\bmet(s)?\s+.*rappel\b/.test(low)
                 || /\bdans\s+\d+\s*(minutes?|heures?|jours?|semaines?)\b/.test(low)
                 || /\bdemain\b/.test(low) || /\baujourdhui\b/.test(low) || /\bprochain\b/.test(low)
  if (!isReminder) {
    // Pour l’instant on fige sur rappels uniquement, tant que la partie candidats/clients n’est pas réactivée.
    const help = [
      "Je peux t’aider avec tes rappels ⏰",
      "Exemples :",
      "• « Rappelle-moi dans 5 minutes : envoyer le mail »",
      "• « Fais un rappel demain à 10h30 : appeler la gouvernante »",
      "• « Rappel à Hélène dans 15 minutes : contacter Y »",
      "• « Rappel à tout le monde lundi prochain à 11h : mettre vos CP à jour »",
    ].join("\n")
    return new Response(JSON.stringify(wrapReply(help)), { headers:{...corsHeaders,"Content-Type":"application/json"} })
  }

  // ---------- Parsing date/heure ----------
  // 1) relatif prioritaire ("dans 5 minutes")
  let due = parseRelativeFR(message, tz)

  // 2) sinon date explicite ("demain", "lundi", "03/09"), + heure si précisée
  if (!due) {
    const baseDay = parseDateTextFR(message, tz) || nowInTZ(tz)
    // heure si présente
    const hm = findHourInTextFR(message)
    if (hm) {
      const d = cloneInTZ(baseDay, tz)
      d.setHours(hm.h, hm.min, 0, 0)
      due = d
    } else {
      // pas d'heure → par défaut: 10:00 (heure bureau)
      const d = cloneInTZ(baseDay, tz)
      d.setHours(10, 0, 0, 0)
      due = d
    }
  }

  // Sécurité : si malgré tout due null → 30 min plus tard
  if (!due) due = addMinutesTZ(nowInTZ(tz), 30, tz)

  // ---------- Titre ----------
  const title = extractTitle(message)

  // ---------- Audience ----------
  let audience: "user"|"list"|"all" = detectAudienceKind(message)
  let user_ids: string[] = []

  if (audience === "all") {
    // rien à faire, user_ids vide
  } else {
    // Cherche des personnes nommées dans la phrase
    const found = await searchUsersFromMessage(supabase, message)
    if (found.length > 0) {
      audience = "list"
      user_ids = found.map(u => u.id)
    } else {
      // par défaut: l’émetteur
      audience = "user"
      if (me?.id) user_ids = [me.id]
    }
  }

  // ---------- Écriture BD ----------
  const { ok, error, reminder } = await createReminder(supabase, {
    created_by: me?.id ?? null,
    title,
    due_at_iso: toISO(due),
    audience,
    user_ids,
  })
  if (!ok) {
    return new Response(JSON.stringify(wrapReply("Erreur lors de la création du rappel.")), {
      headers:{...corsHeaders,"Content-Type":"application/json"}
    })
  }

  // ---------- Accusé de réception ----------
  let cible = ""
  if (audience === "all") cible = " (à tous les utilisateurs)"
  else if (audience === "list") {
    // Affiche prénoms trouvés (limite 3)
    const labels = await (async ()=>{
      if (!user_ids.length) return []
      const { data } = await supabase.from("utilisateurs").select("prenom,nom").in("id", user_ids)
      return (data||[]).map(u => u.prenom || u.nom ? `${u.prenom ?? ""} ${u.nom ?? ""}`.trim() : "Utilisateur").slice(0,3)
    })()
    if (labels.length === 1) cible = ` (${labels[0]})`
    else if (labels.length > 1) cible = ` (${labels.join(", ")}${user_ids.length>3?", …":""})`
  } else if (audience === "user") {
    // rien de spécial (toi)
  }

  const txt = `C’est noté, ${prenom} : rappel « ${title} » le ${formatFrDateTime(due, tz)}${cible}.`
  return new Response(JSON.stringify(wrapReply(txt, { reminders: [reminder] })), {
    headers:{...corsHeaders,"Content-Type":"application/json"}
  })
})
