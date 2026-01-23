import { addDays, format } from "date-fns"
import { fr } from "date-fns/locale"

export type PlanningCandidatItem = {
  dateISO: string

  clientNom?: string | null
  secteur?: string | null
  service?: string | null

  heure_debut_matin?: string | null
  heure_fin_matin?: string | null
  heure_debut_soir?: string | null
  heure_fin_soir?: string | null
  heure_debut_nuit?: string | null
  heure_fin_nuit?: string | null

  // Pause au format "HH:MM" (ex: "00:30", "02:00")
  pause?: string | null

  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  telephone?: string | null
}

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function fmtDayTitle(date: Date) {
  const base = cap(format(date, "EEEE d MMMM", { locale: fr }))
  return base.toUpperCase()
}

// "08:00:00" => "8:00" | "08:00" => "8:00" | "8:00" => "8:00"
function fmtTime(t?: string | null) {
  if (!t) return ""
  const parts = String(t).split(":")
  if (parts.length < 2) return String(t)

  const hh = String(Number(parts[0])) // enlève le zéro devant
  const mm = parts[1].padStart(2, "0")
  return `${hh}:${mm}`
}

function fmtTimeRange(a?: string | null, b?: string | null) {
  const A = fmtTime(a)
  const B = fmtTime(b)
  if (!A || !B) return ""
  return `${A} - ${B}`
}

// "00:30" => "30 minutes" | "02:00" => "2 heures" | "01:15" => "1 heure 15 minutes"
function fmtPause(pause?: string | null) {
  if (!pause) return ""
  const parts = String(pause).split(":")
  if (parts.length < 2) return ""

  const h = Number(parts[0])
  const m = Number(parts[1])

  if (!Number.isFinite(h) || !Number.isFinite(m)) return ""

  const chunks: string[] = []

  if (h > 0) {
    chunks.push(h === 1 ? "1 heure" : `${h} heures`)
  }
  if (m > 0) {
    chunks.push(`${m} minutes`)
  }

  // ex: 00:00 => ""
  return chunks.join(" ")
}

function buildMissionHeader(it: PlanningCandidatItem) {
  const client = (it.clientNom ?? "").trim()
  const secteur = (it.secteur ?? "").trim()
  const service = (it.service ?? "").trim()

  const headerParts = [client.toUpperCase(), secteur, service].filter(Boolean)
  return headerParts.join(" | ")
}

function buildAdresseLines(it: PlanningCandidatItem) {
  const adr = (it.adresse ?? "").trim()
  const cp = (it.code_postal ?? "").trim()
  const ville = (it.ville ?? "").trim()

  const l1 = adr ? `📍 Adresse : ${adr}` : ""
  const l2 = [cp, ville].filter(Boolean).join(" ")

  // Si pas d'adresse mais CP/Ville, on affiche quand même
  if (!l1 && l2) return [`📍 Adresse :`, `   ${l2}`]
  if (l1 && l2) return [l1, `   ${l2}`]
  if (l1) return [l1]
  return []
}

function buildMissionBlock(it: PlanningCandidatItem) {
  const lines: string[] = []

  const header = buildMissionHeader(it)
  if (header) lines.push(header)

  // Horaires (sur une seule ligne) puis pause en dessous
  const matin = fmtTimeRange(it.heure_debut_matin, it.heure_fin_matin)
  const soir = fmtTimeRange(it.heure_debut_soir, it.heure_fin_soir)
  const nuit = fmtTimeRange(it.heure_debut_nuit, it.heure_fin_nuit)

  const ranges = [matin, soir, nuit].filter(Boolean)
  if (ranges.length > 0) {
    lines.push(`⏰ Horaires : ${ranges.join(" / ")}`)
  }

  const pauseTxt = fmtPause(it.pause)
  if (pauseTxt) {
    lines.push(`⏸ Pause : ${pauseTxt}`)
  }

  // Adresse sur 2 lignes
  const adrLines = buildAdresseLines(it)
  if (adrLines.length > 0) {
    lines.push(...adrLines)
  }

  const tel = (it.telephone ?? "").trim()
  if (tel) lines.push(`☎️ Tél : ${tel}`)

  return lines.join("\r\n")
}

function buildDaySection(items: PlanningCandidatItem[], dateISO: string, dateObj: Date) {
  const dayItems = items.filter((x) => x.dateISO === dateISO)

  const lines: string[] = []

  lines.push(`📅 ${fmtDayTitle(dateObj)}`)

  if (dayItems.length === 0) {
    lines.push(`— Pas de mission`)
    return lines.join("\r\n")
  }

  for (const it of dayItems) {
    lines.push(buildMissionBlock(it))
    lines.push("") // espace entre blocs d'une même journée
  }

  return lines.join("\r\n").trimEnd()
}

export function buildPlanningCandidatEmail(params: {
  prenom: string
  weekNumber: number
  mondayISO: string // "YYYY-MM-DD"
  items: PlanningCandidatItem[]
}) {
  const { prenom, weekNumber, mondayISO, items } = params

  const subject = `Votre Planning ADAPTEL Lyon - Semaine ${weekNumber}`

  const monday = new Date(`${mondayISO}T00:00:00`)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  const lines: string[] = []
  lines.push(`Bonjour ${prenom},`)
  lines.push(``)
  lines.push(`Veuillez trouver ci-dessous le récapitulatif de votre planning pour la semaine ${weekNumber}.`)
  lines.push(``)

  for (const d of days) {
    const iso = format(d, "yyyy-MM-dd")
    lines.push(buildDaySection(items, iso, d))

    // ✅ 2 sauts de ligne entre journées (plus aéré)
    lines.push(``)
    lines.push(``)
  }

  lines.push(`Bonne semaine,`)
  lines.push(`ADAPTEL Lyon`)

  const body = lines.join("\r\n")
  return { subject, body }
}
