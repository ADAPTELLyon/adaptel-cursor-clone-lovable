// supabase/functions/agent-chat/index.ts
// @ts-nocheck
// deno-lint-ignore-file

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!

type ChatReply = {
  id: string
  role: "agent"
  text: string
  quickReplies?: Array<{ label: string; payload: any }>
}

type InvokeBody = {
  message?: string
  fill?: Record<string, any>
  context?: Record<string, any>
}

function jsonResponse(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } })
}

async function getCurrentUtilisateurId(supabase: any): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser()
  const email = auth?.user?.email
  if (!email) return null
  const { data } = await supabase.from("utilisateurs").select("id").eq("email", email).maybeSingle()
  return data?.id ?? null
}

async function listUtilisateurs(supabase: any) {
  const { data } = await supabase
    .from("utilisateurs")
    .select("id, prenom, nom, email, actif")
    .eq("actif", true)
    .order("prenom", { ascending: true })
  return data || []
}

async function listClients(supabase: any) {
  const { data } = await supabase
    .from("clients")
    .select("id, nom, actif")
    .eq("actif", true)
    .order("nom", { ascending: true })
    .limit(300)
  return data || []
}

async function listCandidats(supabase: any) {
  const { data } = await supabase
    .from("candidats")
    .select("id, prenom, nom, actif")
    .eq("actif", true)
    .order("prenom", { ascending: true })
    .limit(300)
  return data || []
}

// DB writes
async function saveReminder(supabase: any, created_by: string | null, pr: any) {
  const payload = {
    title: pr.title,
    body: pr.body ?? null,
    due_at: pr.due_at,
    audience: pr.audience,
    user_ids: pr.audience === "all" ? [] : (pr.user_ids ?? []),
    urgent: !!pr.urgent,
    created_by,
    status: "pending",
  }
  const { data, error } = await supabase.from("agent_reminders").insert(payload).select("id").single()
  if (error) throw error
  return data.id as string
}

async function saveEvent(supabase: any, created_by: string | null, pe: any) {
  const payload = {
    type: pe.type ?? "note",
    text: pe.text,
    entities: pe.entities ?? null,
    time_scope: pe.time_scope ?? null,
    payload: pe.payload ?? null,
    visibility: pe.visibility ?? "all",
    visible_user_ids: pe.visible_user_ids ?? [],
    created_by,
  }
  const { data, error } = await supabase.from("agent_events").insert(payload).select("id").single()
  if (error) throw error
  return data.id as string
}

// Simple Q/A: qui est dispo (date, période, secteur[, service])
async function queryDisponibles(supabase: any, args: { date: string; periode?: "matin"|"soir"|"nuit"; secteur?: string; service?: string|null }) {
  let q = supabase.from("disponibilites").select(`
    id, date, secteur, statut, matin, soir, nuit, creneaux, candidat_id,
    candidats!inner(id, prenom, nom, actif)
  `).eq("date", args.date).eq("statut", "Dispo")

  if (args.secteur) q = q.eq("secteur", args.secteur)
  const { data, error } = await q.limit(200)
  if (error) return []

  let rows = (data || []) as any[]
  if (args.periode === "matin") rows = rows.filter(r => r.matin || (Array.isArray(r.creneaux) && r.creneaux.includes("matin")))
  if (args.periode === "soir")  rows = rows.filter(r => r.soir  || (Array.isArray(r.creneaux) && r.creneaux.includes("soir")))
  if (args.periode === "nuit")  rows = rows.filter(r => r.nuit  || (Array.isArray(r.creneaux) && r.creneaux.includes("nuit")))

  const seen = new Set<string>()
  const candidats: any[] = []
  for (const r of rows) {
    const cid = r.candidat_id
    if (!seen.has(cid)) {
      seen.add(cid)
      candidats.push({ id: cid, nom: r.candidats?.nom, prenom: r.candidats?.prenom })
    }
  }
  return candidats.slice(0, 20)
}

// LLM call: renvoie un JSON (intent + slots)
async function llmParse(input: string, context: { utilisateurs: any[]; clients: any[]; candidats: any[] }) {
  const usersCtx = context.utilisateurs || []
  const clientsCtx = (context.clients || []).slice(0, 200)
  const candsCtx = (context.candidats || []).slice(0, 50).map((c: any) => ({ id: c.id, nom: c.nom, prenom: c.prenom }))

  const sys = `
Tu es un agent interne ADAPTEL Lyon. Tu reçois une phrase utilisateur en français et tu renvoies UNIQUEMENT du JSON.
Objectif: classifier et extraire.

Schéma JSON attendu:
{
  "kind": "reminder" | "event" | "question",
  "intent": string,
  "reminder": { "title"?: string, "body"?: string, "due_at"?: string ISO, "audience"?: "all"|"user"|"list", "user_ids"?: string[], "urgent"?: boolean },
  "event": { "type"?: "note"|"incident"|"indispo"|"preference"|"memo"|"autre", "text"?: string,
             "entities"?: { "candidat_id"?: string, "client_id"?: string, "site_id"?: string, "secteur"?: string, "service"?: string },
             "time_scope"?: { "date"?: "YYYY-MM-DD", "start"?: string ISO, "end"?: string ISO } },
  "question": { "type"?: "availability", "date"?: "YYYY-MM-DD", "periode"?: "matin"|"soir"|"nuit", "secteur"?: string, "service"?: string },
  "missing": string[]
}

Utilisateurs actifs:
${JSON.stringify(usersCtx)}

Clients actifs (extrait):
${JSON.stringify(clientsCtx)}

Candidats actifs (extrait):
${JSON.stringify(candsCtx)}

Règles:
- Si le texte contient "rappel" -> "kind":"reminder".
- "demain 10h" -> due_at le prochain jour à 10:00 locale (ISO).
- "à Hélène", "pour Fabien" -> mappe à l'id quand c'est unique.
- Si rien de "rappel", par défaut "event" type "note".
- "Qui est dispo demain matin en salle ?" -> "question" type "availability" + date/periode/secteur.
- Renseigne "missing" si info critique absente (audience, due_at, title…).
- Ne renvoie QUE le JSON.
`
  const body = {
    model: "gpt-4o-mini",
    temperature: 0.1,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: input }
    ],
    response_format: { type: "json_object" }
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })
  if (!resp.ok) throw new Error(`OpenAI error: ${resp.status} ${await resp.text()}`)
  const data = await resp.json()
  const content = data.choices?.[0]?.message?.content ?? "{}"
  return JSON.parse(content)
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return jsonResponse({ error: "POST only" }, 405)
    const { message, fill }: InvokeBody = await req.json()

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    )

    const meId = await getCurrentUtilisateurId(supabase)
    const [utilisateurs, clients, candidats] = await Promise.all([
      listUtilisateurs(supabase), listClients(supabase), listCandidats(supabase)
    ])

    const parsed = await llmParse(message || "", { utilisateurs, clients, candidats })

    // Merge clarifications (quick replies)
    if (fill && parsed.kind === "reminder") {
      parsed.reminder = { ...(parsed.reminder || {}), ...fill }
      if (parsed.reminder.audience === "all") parsed.reminder.user_ids = []
    }

    const replies: ChatReply[] = []

    if (parsed.kind === "reminder") {
      const pr = parsed.reminder || {}
      const missing: string[] = []

      if (!pr.audience) missing.push("audience")
      if (pr.audience !== "all" && (!pr.user_ids || pr.user_ids.length === 0)) missing.push("user_ids")
      if (!pr.due_at) missing.push("due_at")
      if (!pr.title || pr.title.trim().length === 0) missing.push("title")

      if (missing.length > 0) {
        let quickReplies: Array<{ label: string; payload: any }> = []

        if (missing.includes("audience") || missing.includes("user_ids")) {
          quickReplies = [
            { label: "Tous", payload: { audience: "all", user_ids: [] } },
            ...utilisateurs.slice(0, 6).map((u: any) => ({
              label: `${u.prenom} ${u.nom}`, payload: { audience: "user", user_ids: [u.id] }
            })),
          ]
          replies.push({ id: crypto.randomUUID(), role: "agent", text: "À qui dois-je adresser ce rappel ?", quickReplies })
          return jsonResponse({ replies })
        }

        if (missing.includes("due_at")) {
          const now = new Date()
          const d1 = new Date(now); d1.setHours(9,0,0,0); if (d1.getTime() < now.getTime()) d1.setDate(d1.getDate()+1)
          const d2 = new Date(now); d2.setHours(14,0,0,0); if (d2.getTime() < now.getTime()) d2.setDate(d2.getDate()+1)
          quickReplies = [
            { label: `Demain ${d1.toTimeString().slice(0,5)}`, payload: { due_at: d1.toISOString() } },
            { label: `Demain ${d2.toTimeString().slice(0,5)}`, payload: { due_at: d2.toISOString() } },
          ]
          replies.push({ id: crypto.randomUUID(), role: "agent", text: "Quand dois-je te le rappeler ?", quickReplies })
          return jsonResponse({ replies })
        }

        if (missing.includes("title")) {
          replies.push({ id: crypto.randomUUID(), role: "agent", text: "Quel est l’intitulé du rappel ? (écris-le en une phrase claire)" })
          return jsonResponse({ replies })
        }
      }

      const id = await saveReminder(supabase, meId, pr)
      replies.push({ id: crypto.randomUUID(), role: "agent", text: "✅ Rappel créé." })
      return jsonResponse({ replies, created: { reminder_id: id } })
    }

    if (parsed.kind === "event") {
      const pe = parsed.event || {}
      if (!pe.text || pe.text.trim().length === 0) {
        replies.push({ id: crypto.randomUUID(), role: "agent", text: "J’ai besoin d’un texte pour enregistrer la note." })
        return jsonResponse({ replies })
      }
      const id = await saveEvent(supabase, meId, pe)
      replies.push({ id: crypto.randomUUID(), role: "agent", text: "📝 Noté." })
      return jsonResponse({ replies, created: { event_id: id } })
    }

    if (parsed.kind === "question" && parsed.question?.type === "availability") {
      const q = parsed.question
      if (!q.date || !q.secteur) {
        replies.push({ id: crypto.randomUUID(), role: "agent", text: "Pour chercher, il me faut au minimum une date (AAAA-MM-JJ) et un secteur." })
        return jsonResponse({ replies })
      }
      const cands = await queryDisponibles(supabase, { date: q.date, periode: q.periode, secteur: q.secteur, service: q.service ?? null })
      if (cands.length === 0) {
        replies.push({ id: crypto.randomUUID(), role: "agent", text: "Aucun candidat disponible trouvé selon ces critères (V1 simple)." })
      } else {
        const list = cands.map((c: any) => `• ${c.prenom} ${c.nom} (id ${c.id})`).join("\n")
        replies.push({ id: crypto.randomUUID(), role: "agent", text: `Candidats disponibles:\n${list}` })
      }
      return jsonResponse({ replies, answer: "availability" })
    }

    return jsonResponse({ replies: [{ id: crypto.randomUUID(), role: "agent", text: "Je n’ai pas compris. Peux-tu reformuler ?" }] })
  } catch (e) {
    return jsonResponse({ error: String(e?.message || e) }, 500)
  }
})
