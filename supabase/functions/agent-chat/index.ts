// @ts-nocheck
// supabase/functions/agent-chat/index.ts
// Edge Function (Deno) — Agent ADAPTEL (Groq-first V2 + regex fallback + rappels fiables)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ---------------- CORS ----------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ---------------- Utils Dates (Europe/Paris) ----------------
function nowParis() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }))
}
function toISO(d: Date | string) {
  return new Date(d).toISOString()
}
function formatFrDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      weekday: "long",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

// ---------------- Supabase helper ----------------
function supaFromReq(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!
  const authHeader = req.headers.get("Authorization") ?? ""
  return createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })
}
async function getCurrentUtilisateur(supabase: any) {
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

// ---------------- Tables agent_* : Rappels ----------------
async function createReminder(supabase: any, userId: string | null, args: any) {
  const { title, body = null, due_at, audience = "user", user_ids = [] } = args
  const finalAudience = audience || "user"
  const finalUsers =
    finalAudience === "user" ? (userId ? [userId, ...user_ids].filter(Boolean) : user_ids) : user_ids

  const ins = await supabase
    .from("agent_reminders")
    .insert({
      created_by: userId,
      title,
      body,
      due_at,
      audience: finalAudience,
      user_ids: finalUsers,
      status: "pending",
      urgent: false,
    })
    .select("*")
    .single()
  if (ins.error) return { ok: false, error: ins.error.message, reminders: [] }
  return { ok: true, reminders: [ins.data] }
}

// ---------------- Parseur FR Rappel (déterministe) ----------------
const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"]

function tryParseReminderFR(message: string) {
  const raw = message.trim()
  const txt = raw.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

  // mot-clé rappel (pour éviter de détourner les requêtes planning)
  const hasReminderKeyword = /\brappel(?:le|-?moi)?\b/.test(txt)

  function baseAbs() {
    return nowParis()
  }
  function nextWeekdayDate(name: string, from: Date) {
    const idx = WEEKDAYS.indexOf(name)
    if (idx < 0) return null
    const cur = from.getDay()
    let diff = idx - cur
    if (diff <= 0) diff += 7
    const d = new Date(from)
    d.setDate(d.getDate() + diff)
    d.setHours(9, 0, 0, 0)
    return d
  }
  function parseHourMinute(str: string) {
    const m = str.match(/(\d{1,2})(?:(?:h|:)?(\d{2}))?/)
    if (!m) return null
    const h = Math.min(23, parseInt(m[1], 10))
    const min = Math.min(59, m[2] ? parseInt(m[2], 10) : 0)
    return { h, min }
  }
  function extractTitle(afterIdx: number) {
    const tail = raw.slice(afterIdx).trim().replace(/^(de|d'|pour|:|-|—)\s*/i, "")
    if (tail.length >= 3) return tail
    const m = raw.match(/rappel(?:le|-?moi)?\s*(?:de|d'|pour|:)?\s*(.+)$/i)
    if (m && m[1] && m[1].trim().length >= 3) return m[1].trim()
    return "Rappel"
  }

  // (1) RELATIF — partir de l'instant réel (UTC)
  const rel = txt.match(/\bdans\s+(un|une|\d+)\s*(seconde?s?|sec?s?|minutes?|mn|mins?|min|heures?|h|jours?|j)\b/)
  if (rel) {
    const nRaw = rel[1]
    const unit = rel[2]
    const n = nRaw === "un" || nRaw === "une" ? 1 : parseInt(nRaw, 10)
    const d = new Date()
    const u = unit
    if (/^sec/.test(u)) d.setSeconds(d.getSeconds() + n)
    else if (/^min|mn/.test(u) || /^mins?$/.test(u)) d.setMinutes(d.getMinutes() + n)
    else if (/^heure|^h$/.test(u)) d.setHours(d.getHours() + n)
    else if (/^jour|^j$/.test(u)) d.setDate(d.getDate() + n)
    else d.setMinutes(d.getMinutes() + n)
    const idx = rel.index! + rel[0].length
    return { kind: "relative", title: extractTitle(idx), due_at_iso: toISO(d), isReminder: true }
  }

  // (2) Le reste du parseur ne s’active que si mot-clé rappel présent
  if (!hasReminderKeyword) return null

  // 2a) demain
  const demPos = txt.indexOf("demain")
  if (demPos >= 0) {
    const d = baseAbs()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    const after = raw.slice(demPos)
    const time = after.match(/\b(?:a|à)\s*([0-2]?\d(?:[:h]\d{2})?)\b/i)
    if (time) {
      const hm = parseHourMinute(time[1])
      if (hm) d.setHours(hm.h, hm.min, 0, 0)
      return { kind: "absolute", title: extractTitle(demPos + time.index! + time[0].length), due_at_iso: toISO(d), isReminder: true }
    }
    return { kind: "need_time", title: extractTitle(demPos + "demain".length), base_date_iso: toISO(d), isReminder: true }
  }

  // 2b) aujourd'hui
  const aujPos = txt.indexOf("aujourdhui")
  if (aujPos >= 0) {
    const d = baseAbs()
    d.setHours(9, 0, 0, 0)
    const after = raw.slice(aujPos)
    const time = after.match(/\b(?:a|à)\s*([0-2]?\d(?:[:h]\d{2})?)\b/i)
    if (time) {
      const hm = parseHourMinute(time[1])
      if (hm) d.setHours(hm.h, hm.min, 0, 0)
      return { kind: "absolute", title: extractTitle(aujPos + time.index! + time[0].length), due_at_iso: toISO(d), isReminder: true }
    }
    return { kind: "need_time", title: extractTitle(aujPos + "aujourd'hui".length), base_date_iso: toISO(d), isReminder: true }
  }

  // 2c) jour de semaine
  for (const name of WEEKDAYS) {
    const re = new RegExp(`\\b${name}(?:\\s+prochain)?\\b`)
    const m = txt.match(re)
    if (m) {
      let d = nextWeekdayDate(name, baseAbs())!
      if (/prochain/.test(m[0])) d.setDate(d.getDate() + 7)
      const after = raw.slice(m.index!)
      const t = after.match(/\b(?:a|à)\s*([0-2]?\d(?:[:h]\d{2})?)\b/i)
      if (t) {
        const hm = t[1].match(/(\d{1,2})(?:(?:h|:)?(\d{2}))?/)
        if (hm) d.setHours(parseInt(hm[1], 10), hm[2] ? parseInt(hm[2], 10) : 0, 0, 0)
        return { kind: "absolute", title: extractTitle(m.index! + t.index! + t[0].length), due_at_iso: toISO(d), isReminder: true }
      }
      return { kind: "need_time", title: extractTitle(m.index! + m[0].length), base_date_iso: toISO(d), isReminder: true }
    }
  }

  // 2d) dates FR / ISO
  const absFR = txt.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/)
  if (absFR) {
    const day = parseInt(absFR[1], 10)
    const mon = parseInt(absFR[2], 10)
    const year = absFR[3] ? parseInt(absFR[3], 10) : nowParis().getFullYear()
    const d = baseAbs()
    d.setFullYear(year, mon - 1, day)
    d.setHours(9, 0, 0, 0)
    const after = raw.slice(absFR.index!)
    const t = after.match(/\b(?:a|à)\s*([0-2]?\d(?:[:h]\d{2})?)\b/i)
    if (t) {
      const hm = t[1].match(/(\d{1,2})(?:(?:h|:)?(\d{2}))?/)
      if (hm) d.setHours(parseInt(hm[1], 10), hm[2] ? parseInt(hm[2], 10) : 0, 0, 0)
      return { kind: "absolute", title: extractTitle(absFR.index! + t.index! + t[0].length), due_at_iso: toISO(d), isReminder: true }
    }
    return { kind: "need_time", title: extractTitle(absFR.index! + absFR[0].length), base_date_iso: toISO(d), isReminder: true }
  }

  const absISO = txt.match(/\b(20\d{2})-(0?\d|1[0-2])-(0?\d|[12]\d|3[01])\b/)
  if (absISO) {
    const y = parseInt(absISO[1], 10)
    const m = parseInt(absISO[2], 10)
    const da = parseInt(absISO[3], 10)
    const d = baseAbs()
    d.setFullYear(y, m - 1, da)
    d.setHours(9, 0, 0, 0)
    const after = raw.slice(absISO.index!)
    const t = after.match(/\b(?:a|à)\s*([0-2]?\d(?:[:h]\d{2})?)\b/i)
    if (t) {
      const hm = t[1].match(/(\d{1,2})(?:(?:h|:)?(\d{2}))?/)
      if (hm) d.setHours(parseInt(hm[1], 10), hm[2] ? parseInt(hm[2], 10) : 0, 0, 0)
      return { kind: "absolute", title: extractTitle(absISO.index! + t.index! + t[0].length), due_at_iso: toISO(d), isReminder: true }
    }
    return { kind: "need_time", title: extractTitle(absISO.index! + absISO[0].length), base_date_iso: toISO(d), isReminder: true }
  }

  return null
}

// ---------------- Réponse standard ----------------
type AgentReply = {
  ok: boolean
  reply: string
  choices?: Array<{ label: string; value?: string; kind?: "time" | "client" | "candidat" | "user"; payload?: any }>
  cards?: any[]
  reminders?: any[]
  meta?: any
}
function reply(text: string, extras: Partial<AgentReply> = {}): AgentReply {
  return { ok: true, reply: text, choices: [], cards: [], reminders: [], ...extras }
}

// ---------------- GROQ (intention d’abord) ----------------
async function callGroqIntent(message: string) {
  const apiKey = Deno.env.get("GROQ_API_KEY")
  if (!apiKey) return null

  // Donnons à Groq le contexte de schéma minimal utile
  const system = `
Tu es l'agent ADAPTEL Lyon. Langue: FR. Fuseau: Europe/Paris.
Tu réponds en JSON compact avec "action".
Tu n'utilises "reminder.create" QUE si le message contient explicitement un rappel (mots-clés: "rappel", "rappelle-moi", "rappel:").
Sinon, classe en "query.*" ou "disambiguate.*".
Schéma (lecture seule):
- candidats(id, prenom, nom, vehicule)
- clients(id, nom)
- commandes(id, date_jour, candidat_id, client_id, secteur, service,
  heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir, heure_debut_nuit, heure_fin_nuit, statut)
- interdictions_priorites(candidat_id, client_id, actif, statut)  // statut peut valoir "interdit"
Objectifs principaux:
- "où travaille X demain" => {"action":"query.candidat_where_tomorrow","candidat_name":"X"}
- "est-ce que X est interdit chez/au Y" => {"action":"query.is_candidat_forbidden_on_client","candidat_name":"X","client_name":"Y"}
- Désambiguïsation => {"action":"disambiguate.candidat","options":[{"id":"?","label":"Paul Dupont"},...]} ou "disambiguate.client".
Exemples:
{"action":"query.candidat_where_tomorrow","candidat_name":"BOOFULU"}
{"action":"query.is_candidat_forbidden_on_client","candidat_name":"Pievand","client_name":"Novotel Bron"}
{"action":"reminder.create","title":"Appeler la gouvernante","when":"demain 11h"} // uniquement si mot-clé rappel
`.trim()

  const user = `Message: ${message}`

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.1-70b-versatile",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  }).catch(() => null)

  if (!res || !res.ok) return null
  const out = await res.json().catch(() => null)
  const text = out?.choices?.[0]?.message?.content
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// ---------------- Fallback heuristique FR (si Groq hésite) ----------------
function cheapIntentFR(message: string) {
  const txt = message.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  // Où travaille X demain ?
  const m1 = txt.match(/\bou\s*travaille\s+([a-z0-9\u00C0-\u017F\s'-]+)\s+demain\b/i)
  if (m1) {
    const name = m1[1].trim()
    return { action: "query.candidat_where_tomorrow", candidat_name: name }
  }
  // Est-ce que X est interdit (chez|au|aux) Y ?
  const m2 = txt.match(/\best\s*-?\s*ce\s*que\s+([a-z0-9\u00C0-\u017F\s'-]+)\s+est\s+interdit\s+(?:chez|au|aux)\s+([a-z0-9\u00C0-\u017F\s'-]+)\b/i)
  if (m2) {
    const cand = m2[1].trim()
    const cli = m2[2].trim()
    return { action: "query.is_candidat_forbidden_on_client", candidat_name: cand, client_name: cli }
  }
  return null
}

// ---------------- Helpers lecture (adapter si besoin) ----------------
async function findCandidatByName(supabase: any, name: string) {
  const trimmed = (name || "").trim()
  if (!trimmed) return []
  const { data } = await supabase
    .from("candidats")
    .select("id, prenom, nom, vehicule")
    .or(`prenom.ilike.%${trimmed}%,nom.ilike.%${trimmed}%`)
    .limit(10)
  return data || []
}
async function findClientByName(supabase: any, name: string) {
  const trimmed = (name || "").trim()
  if (!trimmed) return []
  const { data } = await supabase.from("clients").select("id, nom").ilike("nom", `%${trimmed}%`).limit(10)
  return data || []
}
async function missionsCandidatByDate(supabase: any, candidatId: string, dateISO: string) {
  const day = dateISO.slice(0, 10)
  const { data } = await supabase
    .from("commandes")
    .select(
      `
      id,
      date_jour,
      statut,
      secteur,
      service,
      client:clients(id, nom),
      candidat:candidats(id, prenom, nom),
      heure_debut_matin, heure_fin_matin,
      heure_debut_soir, heure_fin_soir,
      heure_debut_nuit, heure_fin_nuit
    `
    )
    .eq("date_jour", day)
    .eq("candidat_id", candidatId)
  return (data || []).map((x: any) => ({
    type: x.statut === "En recherche" ? "mission_en_recherche" : "mission",
    client: x.client?.nom || "Client",
    date: x.date_jour,
    secteur: x.secteur || null,
    service: x.service || null,
    candidat: x.candidat ? `${x.candidat.prenom} ${x.candidat.nom}` : null,
    horaires: {
      matin: x.heure_debut_matin && x.heure_fin_matin ? `${x.heure_debut_matin}-${x.heure_fin_matin}` : "-",
      soir: x.heure_debut_soir && x.heure_fin_soir ? `${x.heure_debut_soir}-${x.heure_fin_soir}` : "-",
      nuit: x.heure_debut_nuit && x.heure_fin_nuit ? `${x.heure_debut_nuit}-${x.heure_fin_nuit}` : "-",
    },
  }))
}
async function checkInterdiction(supabase: any, candidatId: string, clientId: string) {
  // 1) tentative via interdictions_priorites (statut="interdit" ou actif=true)
  let interdit = false
  {
    const { data } = await supabase
      .from("interdictions_priorites")
      .select("actif, statut")
      .eq("candidat_id", candidatId)
      .eq("client_id", clientId)
      .maybeSingle()
    if (data) {
      if (data.actif === true) interdit = true
      if ((data.statut || "").toLowerCase() === "interdit") interdit = true
    }
  }
  if (interdit) return { interdit: true }
  // 2) fallback éventuel (ancienne table)
  {
    const { data } = await supabase
      .from("interdictions_candidat_client")
      .select("actif")
      .eq("candidat_id", candidatId)
      .eq("client_id", clientId)
      .maybeSingle()
    if (data?.actif) return { interdit: true }
  }
  return { interdit: false }
}

// ---------------- Route ----------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, reply: "Méthode non autorisée." }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = supaFromReq(req)
    const me = await getCurrentUtilisateur(supabase)
    const userId = me?.id ?? null
    const prenom = me?.prenom ?? "OK"
    const body = await req.json().catch(() => ({}))
    const message = (body?.message ?? "").toString()
    const fill = body?.fill ?? null

    // --------- FILL (choix d’heure depuis UI) ---------
    if (fill?.action === "set_time_from_base" && fill?.base_date_iso && fill?.time && fill?.title) {
      const d = new Date(fill.base_date_iso)
      const hm = String(fill.time).match(/^([0-2]?\d):?([0-5]\d)?$/)
      if (hm) {
        const h = parseInt(hm[1], 10)
        const m = hm[2] ? parseInt(hm[2], 10) : 0
        d.setHours(h, m, 0, 0)
      }
      const crt = await createReminder(supabase, userId, {
        title: fill.title,
        body: null,
        due_at: toISO(d),
        audience: "user",
        user_ids: [],
      })
      if (!crt.ok) {
        return new Response(JSON.stringify(reply("Erreur lors de la création du rappel.")), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      const nice = `Ok ${prenom}, rappel « ${fill.title} » le ${formatFrDateTime(toISO(d))}.`
      return new Response(JSON.stringify(reply(nice, { reminders: crt.reminders })), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // --------- 1) GROQ EN PREMIER ---------
    let intent = await callGroqIntent(message)

    // --------- 2) Parse RAPPEL seulement si Groq dit reminder.* OU si mot-clé rappel présent ---------
    const parsed = tryParseReminderFR(message)
    const isReminderIntent = intent?.action?.startsWith?.("reminder.") || parsed?.isReminder

    if (isReminderIntent) {
      if (parsed?.kind === "need_time") {
        const text = `Il me manque l’heure, ${prenom}. Tu veux que je planifie « ${parsed.title} » à quel horaire ?`
        const choices = [
          {
            label: "09:00",
            kind: "time",
            payload: { action: "set_time_from_base", time: "09:00", title: parsed.title, base_date_iso: parsed.base_date_iso },
          },
          {
            label: "15:00",
            kind: "time",
            payload: { action: "set_time_from_base", time: "15:00", title: parsed.title, base_date_iso: parsed.base_date_iso },
          },
          {
            label: "18:00",
            kind: "time",
            payload: { action: "set_time_from_base", time: "18:00", title: parsed.title, base_date_iso: parsed.base_date_iso },
          },
        ]
        return new Response(JSON.stringify(reply(text, { choices, meta: { need_time: parsed } })), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      if (parsed && (parsed.kind === "relative" || parsed.kind === "absolute")) {
        const crt = await createReminder(supabase, userId, {
          title: parsed.title,
          body: null,
          due_at: parsed.due_at_iso,
          audience: "user",
          user_ids: [],
        })
        if (!crt.ok) {
          return new Response(JSON.stringify(reply("Erreur lors de la création du rappel.")), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
        const nice = `Ok ${prenom}, rappel « ${parsed.title} » le ${formatFrDateTime(parsed.due_at_iso)}.`
        return new Response(JSON.stringify(reply(nice, { reminders: crt.reminders })), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      if (intent?.action === "reminder.create" && intent.title && intent.when) {
        const parsed2 = tryParseReminderFR(`rappel ${intent.when} ${intent.title}`)
        if (parsed2 && (parsed2.kind === "absolute" || parsed2.kind === "relative")) {
          const crt = await createReminder(supabase, userId, {
            title: intent.title,
            body: null,
            due_at: parsed2.due_at_iso,
            audience: "user",
            user_ids: [],
          })
          if (!crt.ok) {
            return new Response(JSON.stringify(reply("Erreur lors de la création du rappel.")), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            })
          }
          const nice = `Ok ${prenom}, rappel « ${intent.title} » le ${formatFrDateTime(parsed2.due_at_iso)}.`
          return new Response(JSON.stringify(reply(nice, { reminders: crt.reminders })), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
      }
      // Aide rappel
      const helpR = "Pour un rappel : « Rappelle-moi demain à 11h de … », « dans 2 min : … », « lundi prochain … »"
      return new Response(JSON.stringify(reply(helpR)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // --------- 3) Sinon, intention Groq (planning, interdictions, etc.) ---------
    // Si Groq hésite, on applique un fallback FR
    if (!intent || !intent.action) {
      intent = cheapIntentFR(message)
    }

    if (intent && intent.action) {
      if (intent.action === "disambiguate.candidat" && Array.isArray(intent.options)) {
        const choices = intent.options.map((o: any) => ({ label: o.label, value: o.id ?? o.label, kind: "candidat" as const }))
        return new Response(JSON.stringify(reply(`Tu parles de quel candidat ?`, { choices })), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      if (intent.action === "disambiguate.client" && Array.isArray(intent.options)) {
        const choices = intent.options.map((o: any) => ({ label: o.label, value: o.id ?? o.label, kind: "client" as const }))
        return new Response(JSON.stringify(reply(`Quel client précisément ?`, { choices })), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      if (intent.action === "query.candidat_where_tomorrow" && intent.candidat_name) {
        const candidats = await findCandidatByName(supabase, intent.candidat_name)
        if (candidats.length === 0) {
          return new Response(JSON.stringify(reply(`Je ne trouve aucun candidat avec « ${intent.candidat_name} ».`)), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
        if (candidats.length > 1) {
          const choices = candidats.map((c: any) => ({
            label: `${c.prenom ?? ""} ${c.nom ?? ""}`.trim(),
            value: c.id,
            kind: "candidat" as const,
          }))
          return new Response(JSON.stringify(reply(`Tu parles de quel candidat ?`, { choices })), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
        const id = candidats[0].id
        const d = nowParis()
        d.setDate(d.getDate() + 1)
        const cards = await missionsCandidatByDate(supabase, id, toISO(d))
        if (!cards.length) {
          return new Response(JSON.stringify(reply(`Aucune mission demain pour ce candidat.`)), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
        return new Response(JSON.stringify(reply(`Voilà demain :`, { cards })), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      if (intent.action === "query.is_candidat_forbidden_on_client" && intent.candidat_name && intent.client_name) {
        const candidats = await findCandidatByName(supabase, intent.candidat_name)
        if (candidats.length !== 1) {
          const choices = candidats.map((c: any) => ({
            label: `${c.prenom ?? ""} ${c.nom ?? ""}`.trim(),
            value: c.id,
            kind: "candidat" as const,
          }))
          return new Response(JSON.stringify(reply(`Précise le candidat :`, { choices })), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
        const clients = await findClientByName(supabase, intent.client_name)
        if (clients.length !== 1) {
          const choices = clients.map((cl: any) => ({ label: cl.nom, value: cl.id, kind: "client" as const }))
          return new Response(JSON.stringify(reply(`Précise le client :`, { choices })), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
        const { interdit } = await checkInterdiction(supabase, candidats[0].id, clients[0].id)
        const txt = interdit ? "Oui, ce candidat est interdit sur ce client." : "Non, aucune interdiction trouvée."
        return new Response(JSON.stringify(reply(txt)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    }

    // --------- 4) Aide par défaut ---------
    const help =
      "Précise ta demande :\n" +
      "• Rappel : « Rappelle-moi demain à 11h de … », « dans 2 min : … », « lundi prochain … »\n" +
      "• Planning : « Où travaille Dupont demain ? », « Est-ce que Durand est interdit au Novotel Bron ? »"
    return new Response(JSON.stringify(reply(help)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (_err) {
    return new Response(JSON.stringify({ ok: false, reply: "Erreur interne." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
