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

  pause?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  telephone?: string | null

  commentaire?: string | null

  repas_fournis?: boolean | null
  tenue_description?: string | null

  // ✅ TCL
  acces_tc?: string | null
  itinerary_url?: string | null

  // (si encore utilisé côté back)
  itineraire?: string | null
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return ""
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function fmtDayTitle(date: Date) {
  return cap(format(date, "EEEE d MMMM", { locale: fr }))
}

function fmtFullDay(date: Date) {
  return format(date, "EEEE d MMMM yyyy", { locale: fr })
}

function fmtTime(t?: string | null) {
  if (!t) return ""
  const parts = String(t).split(":")
  if (parts.length < 2) return String(t)
  const hh = String(parts[0]).padStart(2, "0")
  const mm = String(parts[1]).padStart(2, "0")
  return `${hh}:${mm}`
}

function fmtTimeRange(a?: string | null, b?: string | null) {
  const A = fmtTime(a)
  const B = fmtTime(b)
  if (!A || !B) return ""
  return `${A} - ${B}`
}

function fmtPause(pause?: string | null) {
  if (!pause) return ""
  const parts = String(pause).split(":")
  if (parts.length < 2) return ""
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ""
  if (h === 0 && m === 0) return ""
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, "0")}`
  if (h > 0) return `${h} heure${h > 1 ? "s" : ""}`
  return `${m} minutes`
}

function getMissionsForDay(items: PlanningCandidatItem[], dateISO: string) {
  const dayItems = items.filter((x) => x.dateISO === dateISO)
  return [...dayItems].sort((a, b) => {
    const timeA = a.heure_debut_matin || a.heure_debut_soir || a.heure_debut_nuit || "99:99"
    const timeB = b.heure_debut_matin || b.heure_debut_soir || b.heure_debut_nuit || "99:99"
    return timeA.localeCompare(timeB)
  })
}

function buildCreneaux(it: PlanningCandidatItem) {
  const matin = fmtTimeRange(it.heure_debut_matin, it.heure_fin_matin)
  const soir = fmtTimeRange(it.heure_debut_soir, it.heure_fin_soir)
  const nuit = fmtTimeRange(it.heure_debut_nuit, it.heure_fin_nuit)
  return { matin, soir, nuit }
}

function buildFullAddressParts(it: PlanningCandidatItem) {
  const adr1 = (it.adresse || "").trim()
  const cp = (it.code_postal || "").trim()
  const ville = (it.ville || "").trim()
  const line2 = `${cp}${cp && ville ? " " : ""}${ville}`.trim()
  return { adr1, line2, has: !!(adr1 || line2) }
}

function parseDateTimeLocalToGoogle(dateISO: string, hhmm: string) {
  const [h, m] = hhmm.split(":")
  const ymd = dateISO.replace(/-/g, "")
  const HH = String(h || "00").padStart(2, "0")
  const MM = String(m || "00").padStart(2, "0")
  return `${ymd}T${HH}${MM}00`
}

function buildGoogleCalendarUrl(opts: {
  title: string
  dateISO: string
  startHHMM: string
  endHHMM: string
  location?: string
  details?: string
}) {
  const dates = `${parseDateTimeLocalToGoogle(opts.dateISO, opts.startHHMM)}/${parseDateTimeLocalToGoogle(
    opts.dateISO,
    opts.endHHMM
  )}`

  const params = new URLSearchParams()
  params.set("action", "TEMPLATE")
  params.set("text", opts.title)
  params.set("dates", dates)
  if (opts.location) params.set("location", opts.location)
  if (opts.details) params.set("details", opts.details)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function buildICSDataUrl(opts: {
  title: string
  dateISO: string
  startHHMM: string
  endHHMM: string
  location?: string
  description?: string
}) {
  const dt = (d: string, t: string) => {
    const ymd = d.replace(/-/g, "")
    const [hh, mm] = t.split(":")
    return `${ymd}T${String(hh || "00").padStart(2, "0")}${String(mm || "00").padStart(2, "0")}00`
  }

  const uid = `${Date.now()}-${Math.random().toString(16).slice(2)}@adaptel-lyon`
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
    now.getUTCHours()
  )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ADAPTEL LYON//Planning Candidat//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dt(opts.dateISO, opts.startHHMM)}`,
    `DTEND:${dt(opts.dateISO, opts.endHHMM)}`,
    `SUMMARY:${(opts.title || "").replace(/\n/g, " ")}`,
    opts.location ? `LOCATION:${(opts.location || "").replace(/\n/g, " ")}` : "",
    opts.description ? `DESCRIPTION:${(opts.description || "").replace(/\n/g, "\\n")}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean)

  const ics = lines.join("\r\n")
  const encoded = encodeURIComponent(ics)
  return `data:text/calendar;charset=utf-8,${encoded}`
}

function buildAgendaButtons(it: PlanningCandidatItem) {
  const etab = (it.clientNom || "").trim() || "Établissement"

  const { adr1, line2 } = buildFullAddressParts(it)
  const address = [adr1, line2].filter(Boolean).join(", ").trim()

  const tel = (it.telephone || "").trim()
  const sec = (it.secteur || "").trim()
  const svc = (it.service || "").trim()

  const detailsLines: string[] = []
  if (sec || svc) detailsLines.push(`${sec}${sec && svc ? " • " : ""}${svc}`.trim())
  if (tel) detailsLines.push(`Contact : ${tel}`)
  if (it.repas_fournis === true) detailsLines.push(`Repas : Oui`)
  if (it.repas_fournis === false) detailsLines.push(`Repas : Non`)
  if ((it.tenue_description || "").trim()) detailsLines.push(`Tenue : ${(it.tenue_description || "").trim()}`)
  if ((it.acces_tc || "").trim()) detailsLines.push(`Accès TCL : ${(it.acces_tc || "").trim()}`)

  const details = detailsLines.join("\n")

  const mkPair = (start: string, end: string, indexLabel?: string) => {
    const title = `Mission ADAPTEL — ${etab}`
    const googleUrl = buildGoogleCalendarUrl({
      title,
      dateISO: it.dateISO,
      startHHMM: start,
      endHHMM: end,
      location: address || undefined,
      details: details || undefined,
    })

    const icsUrl = buildICSDataUrl({
      title,
      dateISO: it.dateISO,
      startHHMM: start,
      endHHMM: end,
      location: address || undefined,
      description: details || undefined,
    })

    const suffix = indexLabel ? ` ${indexLabel}` : ""
    return `
      <div class="agenda-pair">
        <a class="agenda-btn" href="${escapeHtml(googleUrl)}" target="_blank" rel="noopener noreferrer">Google Agenda${escapeHtml(suffix)}</a>
        <a class="agenda-btn agenda-btn-ios" href="${escapeHtml(icsUrl)}" target="_blank" rel="noopener noreferrer">Agenda iPhone${escapeHtml(suffix)}</a>
      </div>
    `
  }

  const btns: string[] = []
  let idx = 1

  if (it.heure_debut_matin && it.heure_fin_matin) {
    btns.push(mkPair(fmtTime(it.heure_debut_matin), fmtTime(it.heure_fin_matin), btns.length ? `(${++idx})` : ""))
  }
  if (it.heure_debut_soir && it.heure_fin_soir) {
    btns.push(mkPair(fmtTime(it.heure_debut_soir), fmtTime(it.heure_fin_soir), btns.length ? `(${++idx})` : ""))
  }
  if (it.heure_debut_nuit && it.heure_fin_nuit) {
    btns.push(mkPair(fmtTime(it.heure_debut_nuit), fmtTime(it.heure_fin_nuit), btns.length ? `(${++idx})` : ""))
  }

  if (!btns.length) return ""
  return `<div class="agenda-wrap">${btns.join("")}</div>`
}

function buildSectorServiceBadges(it: PlanningCandidatItem) {
  const sec = (it.secteur || "").trim()
  const svc = (it.service || "").trim()
  const out: string[] = []
  if (sec) out.push(`<span class="badge badge-white">${escapeHtml(sec.toUpperCase())}</span>`)
  if (svc) out.push(`<span class="badge badge-white">${escapeHtml(svc.toUpperCase())}</span>`)
  return out.join("")
}

function fmtRepas(v: boolean | null | undefined) {
  if (v === true) return "Oui"
  if (v === false) return "Non"
  return ""
}

export function buildPlanningCandidatEmail(params: {
  prenom: string
  weekNumber: number
  mondayISO: string
  items: PlanningCandidatItem[]
  customMessage?: string
  senderPrenom?: string
}) {
  const { prenom, weekNumber, mondayISO, items, customMessage = "", senderPrenom = "" } = params

  const subject = `Votre planning ADAPTEL Lyon - Semaine ${weekNumber}`

  const monday = new Date(`${mondayISO}T00:00:00`)
  const sunday = addDays(monday, 6)

  const safePrenom = escapeHtml(prenom)
  const safeCustomMessage = escapeHtml(customMessage).replace(/\n/g, "<br>")
  const safeSenderPrenom = escapeHtml(senderPrenom)

  const weekSentence = `Veuillez trouver votre planning pour la semaine du ${fmtFullDay(monday)} au ${fmtFullDay(sunday)}.`

  const BRAND = "#8a0000"

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(subject)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }

    body{
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
      background:#f5f6f7;
      color:#121212;
      padding:16px;
      -webkit-text-size-adjust:100%;
      -ms-text-size-adjust:100%;
    }

    .container{
      max-width:640px;
      margin:0 auto;
      background:#ffffff;
      border-radius:18px;
      overflow:hidden;
      border:1px solid #ededed;
      box-shadow:0 10px 30px rgba(0,0,0,0.08);
    }

    .header{
      background:${BRAND};
      padding:32px 22px 22px;
      text-align:center;
    }
    .header-title{
      color:#ffffff;
      font-weight:900;
      letter-spacing:0.6px;
      font-size:18px;
      text-transform:uppercase;
      line-height:1.15;
    }
    .week-pill{
      display:inline-block;
      margin-top:14px;
      padding:8px 12px;
      border-radius:12px;
      background:rgba(255,255,255,0.18);
      border:1px solid rgba(255,255,255,0.28);
      color:#ffffff;
      font-weight:900;
      font-size:14px;
      letter-spacing:0.2px;
    }

    .intro{
      padding:18px 22px 0;
    }
    .intro p{
      font-size:15px;
      line-height:1.5;
      color:#1f1f1f;
      margin-bottom:10px;
    }

    .info-box{
      margin:10px 22px 0;
      background:#ffffff;
      border:1px solid #e6e6e6;
      border-left:4px solid ${BRAND};
      border-radius:12px;
      padding:12px 12px;
    }
    .info-box-title{
      font-size:13px;
      font-weight:900;
      color:${BRAND};
      margin-bottom:6px;
    }
    .info-box-text{
      font-size:14px;
      color:#2a2a2a;
      line-height:1.5;
    }

    .content{
      padding:14px 22px 20px;
    }

    .day-card{
      border:1px solid #e8e8e8;
      border-radius:14px;
      overflow:hidden;
      background:#ffffff;
      margin-top:14px;
    }

    .day-band{
      background:${BRAND};
      color:#ffffff;
      font-weight:900;
      font-size:14px;
      padding:10px 12px;
      letter-spacing:0.2px;
    }

    .day-body{
      padding:12px;
    }

    .no-mission{
      border:1px dashed #d7d7d7;
      border-radius:12px;
      background:#fafafa;
      color:#666;
      font-size:14px;
      font-style:italic;
      padding:14px;
      text-align:center;
    }

    .mission{
      border:1px solid #ededed;
      border-radius:12px;
      background:#fbfbfb;
      padding:12px;
      margin-top:10px;
    }
    .mission:first-child{ margin-top:0; }

    .row{
      display:block;
      margin-top:12px;
    }

    .row-head{
      display:flex;
      align-items:center;
      gap:8px;
      margin-bottom:8px;
    }

    .icon{
      width:18px;
      height:18px;
      flex:0 0 18px;
      background:${BRAND};
      mask-repeat:no-repeat;
      mask-position:center;
      -webkit-mask-repeat:no-repeat;
      -webkit-mask-position:center;
    }

    .icon-time {
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolyline points='12 6 12 12 16 14'/%3E%3C/svg%3E");
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolyline points='12 6 12 12 16 14'/%3E%3C/svg%3E");
    }
    .icon-pause {
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='6' y='4' width='4' height='16'/%3E%3Crect x='14' y='4' width='4' height='16'/%3E%3C/svg%3E");
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='6' y='4' width='4' height='16'/%3E%3Crect x='14' y='4' width='4' height='16'/%3E%3C/svg%3E");
    }
    .icon-location {
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z'/%3E%3Ccircle cx='12' cy='10' r='3'/%3E%3C/svg%3E");
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z'/%3E%3Ccircle cx='12' cy='10' r='3'/%3E%3C/svg%3E");
    }
    .icon-phone {
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'/%3E%3C/svg%3E");
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'/%3E%3C/svg%3E");
    }

    .icon-building {
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 21V7a2 2 0 0 1 2-2h6v16'/%3E%3Cpath d='M13 21V3h6a2 2 0 0 1 2 2v16'/%3E%3Cpath d='M7 9h.01'/%3E%3Cpath d='M7 13h.01'/%3E%3Cpath d='M17 9h.01'/%3E%3Cpath d='M17 13h.01'/%3E%3C/svg%3E");
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 21V7a2 2 0 0 1 2-2h6v16'/%3E%3Cpath d='M13 21V3h6a2 2 0 0 1 2 2v16'/%3E%3Cpath d='M7 9h.01'/%3E%3Cpath d='M7 13h.01'/%3E%3Cpath d='M17 9h.01'/%3E%3Cpath d='M17 13h.01'/%3E%3C/svg%3E");
    }

    .icon-tag {
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20.59 13.41 11 3H4v7l9.59 9.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.82Z'/%3E%3Cpath d='M7 7h.01'/%3E%3C/svg%3E");
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20.59 13.41 11 3H4v7l9.59 9.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.82Z'/%3E%3Cpath d='M7 7h.01'/%3E%3C/svg%3E");
    }

    .icon-meal {
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 2v20'/%3E%3Cpath d='M7 2a4 4 0 0 0 0 8'/%3E%3Cpath d='M11 2v8'/%3E%3Cpath d='M16 2v20'/%3E%3Cpath d='M16 2a4 4 0 0 1 0 8'/%3E%3C/svg%3E");
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 2v20'/%3E%3Cpath d='M7 2a4 4 0 0 0 0 8'/%3E%3Cpath d='M11 2v8'/%3E%3Cpath d='M16 2v20'/%3E%3Cpath d='M16 2a4 4 0 0 1 0 8'/%3E%3C/svg%3E");
    }

    .icon-shirt {
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20.38 3.46 16 2l-4 2-4-2-4.38 1.46a2 2 0 0 0-1.28 2.53l2 6A2 2 0 0 0 6.2 13H7v9h10v-9h.8a2 2 0 0 0 1.86-1.48l2-6a2 2 0 0 0-1.28-2.53Z'/%3E%3C/svg%3E");
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20.38 3.46 16 2l-4 2-4-2-4.38 1.46a2 2 0 0 0-1.28 2.53l2 6A2 2 0 0 0 6.2 13H7v9h10v-9h.8a2 2 0 0 0 1.86-1.48l2-6a2 2 0 0 0-1.28-2.53Z'/%3E%3C/svg%3E");
    }

    /* ✅ TCL */
    .icon-tcl {
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='6' cy='19' r='3'/%3E%3Ccircle cx='18' cy='5' r='3'/%3E%3Cpath d='M8.6 17.3l6.8-6.6'/%3E%3Cpath d='M15.4 7.3L8.6 14'/%3E%3C/svg%3E");
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='6' cy='19' r='3'/%3E%3Ccircle cx='18' cy='5' r='3'/%3E%3Cpath d='M8.6 17.3l6.8-6.6'/%3E%3Cpath d='M15.4 7.3L8.6 14'/%3E%3C/svg%3E");
    }

    .icon-comment {
      mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z'/%3E%3C/svg%3E");
      -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z'/%3E%3C/svg%3E");
    }

    .row-title{
      font-size:13px;
      font-weight:900;
      color:${BRAND};
    }

    .etab-name{
      font-size:16px;
      font-weight:900;
      color:#0f0f0f;
      margin-top:2px;
      margin-bottom:2px;
      line-height:1.2;
    }

    .badge{
      display:inline-block;
      padding:8px 10px;
      border-radius:10px;
      border:1px solid #e6e6e6;
      background:#ffffff;
      color:#111;
      font-weight:900;
      font-size:13px;
      margin-right:8px;
      margin-bottom:8px;
      line-height:1.25;
      white-space:normal;
    }
    .badge-muted{
      background:#f1f2f4;
      color:#666;
      font-weight:800;
      border:1px solid #e1e3e6;
    }
    .badge-white{
      background:#ffffff;
      border:1px solid #e6e6e6;
      color:#111;
    }

    .agenda-wrap{
      margin-top:10px;
    }
    .agenda-pair{
      margin-top:8px;
    }
    .agenda-btn{
      display:inline-block;
      margin-top:6px;
      padding:10px 12px;
      border-radius:12px;
      background:#eef0f2;
      color:#333 !important;
      text-decoration:none;
      font-weight:900;
      font-size:13px;
      border:1px solid #e1e3e6;
      margin-right:8px;
    }
    .agenda-btn-ios{
      background:#ffffff;
    }

    /* bouton “Itinéraire” TCL */
    .link-btn{
      display:inline-block;
      margin-top:6px;
      padding:10px 12px;
      border-radius:12px;
      background:#ffffff;
      color:#333 !important;
      text-decoration:none;
      font-weight:900;
      font-size:13px;
      border:1px solid #e1e3e6;
    }

    .footer{
      background:#f5f6f7;
      border-top:1px solid #e8e8e8;
      padding:18px 22px;
      text-align:center;
    }
    .footer p{
      font-size:13px;
      color:#2a2a2a;
      margin-top:8px;
      line-height:1.45;
    }
    .footer-strong{
      font-weight:900;
      color:#111;
    }

    @media (max-width: 640px){
      body{ padding:12px; }
      .header{ padding:30px 16px 20px; }
      .intro{ padding:16px 16px 0; }
      .info-box{ margin:10px 16px 0; }
      .content{ padding:12px 16px 18px; }
      .footer{ padding:16px 16px; }
      .agenda-btn{ width:100%; text-align:center; margin-right:0; }
      .link-btn{ width:100%; text-align:center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header" style="background:${BRAND};">
      <div class="header-title" style="color:#ffffff;font-weight:900;">
        VOTRE PLANNING
      </div>
      <div class="header-title" style="color:#ffffff;font-weight:900;margin-top:4px;">
        ADAPTEL LYON
      </div>
      <div class="week-pill">Semaine ${escapeHtml(String(weekNumber))}</div>
    </div>

    <div class="intro">
      <p>Bonjour ${safePrenom},</p>
      <p>${escapeHtml(weekSentence)}</p>
    </div>

    ${
      safeCustomMessage
        ? `
      <div class="info-box">
        <div class="info-box-title">Information</div>
        <div class="info-box-text">${safeCustomMessage}</div>
      </div>
    `
        : ""
    }

    <div class="content">
      ${Array.from({ length: 7 }, (_, i) => {
        const day = addDays(monday, i)
        const iso = format(day, "yyyy-MM-dd")
        const dayItems = getMissionsForDay(items, iso)

        return `
          <div class="day-card">
            <div class="day-band" style="background:${BRAND};color:#ffffff;font-weight:900;">
              ${escapeHtml(fmtDayTitle(day))}
            </div>
            <div class="day-body">
              ${
                dayItems.length === 0
                  ? `<div class="no-mission">Aucune mission programmée</div>`
                  : dayItems
                      .map((it) => {
                        const etab = escapeHtml(it.clientNom || "").trim() || "Établissement"
                        const { matin, soir, nuit } = buildCreneaux(it)

                        const pauseTxt = fmtPause(it.pause)
                        const repasTxt = fmtRepas(it.repas_fournis ?? null)

                        const tel = escapeHtml(it.telephone || "").trim()
                        const sectorServiceBadges = buildSectorServiceBadges(it)

                        const { adr1, line2, has } = buildFullAddressParts(it)
                        const addressBadge =
                          has
                            ? `<span class="badge">${escapeHtml(adr1 || "")}${adr1 && line2 ? "<br>" : ""}${escapeHtml(
                                line2 || ""
                              )}</span>`
                            : ""

                        const tenue = escapeHtml((it.tenue_description || "").trim())
                        const comment = escapeHtml((it.commentaire || "").trim())

                        const accesTc = escapeHtml((it.acces_tc || "").trim())
                        const itineraryUrl = escapeHtml((it.itinerary_url || "").trim())

                        const horaireBadges: string[] = []
                        if (matin) horaireBadges.push(`<span class="badge">${escapeHtml(matin)}</span>`)
                        if (soir) horaireBadges.push(`<span class="badge">${escapeHtml(soir)}</span>`)
                        if (nuit) horaireBadges.push(`<span class="badge">${escapeHtml(nuit)}</span>`)

                        const agendaButtons = buildAgendaButtons(it)

                        const sec = (it.secteur || "").trim()
                        const svc = (it.service || "").trim()
                        const ssLabel = sec && svc ? "Secteur / Service" : "Secteur"

                        return `
                  <div class="mission">

                    <div class="row" style="margin-top:0;">
                      <div class="row-head">
                        <div class="icon icon-building"></div>
                        <div class="row-title">Établissement</div>
                      </div>
                      <div class="etab-name">${etab}</div>
                    </div>

                    <div class="row">
                      <div class="row-head">
                        <div class="icon icon-tag"></div>
                        <div class="row-title">${escapeHtml(ssLabel)}</div>
                      </div>
                      <div>
                        ${sectorServiceBadges || `<span class="badge badge-muted">Non communiqué</span>`}
                      </div>
                    </div>

                    <div class="row">
                      <div class="row-head">
                        <div class="icon icon-time"></div>
                        <div class="row-title">Horaires</div>
                      </div>
                      <div>
                        ${
                          horaireBadges.length
                            ? horaireBadges.join("")
                            : `<span class="badge badge-muted">Non communiqués</span>`
                        }
                      </div>
                    </div>

                    <div class="row">
                      <div class="row-head">
                        <div class="icon icon-pause"></div>
                        <div class="row-title">Pause</div>
                      </div>
                      <div>
                        ${
                          pauseTxt
                            ? `<span class="badge">${escapeHtml(pauseTxt)}</span>`
                            : `<span class="badge badge-muted">Non communiquée</span>`
                        }
                      </div>
                    </div>

                    <div class="row">
                      <div class="row-head">
                        <div class="icon icon-meal"></div>
                        <div class="row-title">Repas</div>
                      </div>
                      <div>
                        ${
                          repasTxt
                            ? `<span class="badge">${escapeHtml(repasTxt)}</span>`
                            : `<span class="badge badge-muted">Non précisé</span>`
                        }
                      </div>
                    </div>

                    <div class="row">
                      <div class="row-head">
                        <div class="icon icon-location"></div>
                        <div class="row-title">Adresse</div>
                      </div>
                      <div>
                        ${addressBadge ? addressBadge : `<span class="badge badge-muted">Non communiquée</span>`}
                      </div>
                    </div>

                    <div class="row">
                      <div class="row-head">
                        <div class="icon icon-phone"></div>
                        <div class="row-title">Contact</div>
                      </div>
                      <div>
                        ${
                          tel
                            ? `<span class="badge">${escapeHtml(tel)}</span>`
                            : `<span class="badge badge-muted">Non communiqué</span>`
                        }
                      </div>
                    </div>

                    <div class="row">
                      <div class="row-head">
                        <div class="icon icon-shirt"></div>
                        <div class="row-title">Tenue</div>
                      </div>
                      <div>
                        ${
                          tenue
                            ? `<span class="badge">${tenue.replace(/\n/g, "<br>")}</span>`
                            : `<span class="badge badge-muted">Non précisée</span>`
                        }
                      </div>
                    </div>

                    <!-- ✅ Accès TCL + bouton itinéraire -->
                    <div class="row">
                      <div class="row-head">
                        <div class="icon icon-tcl"></div>
                        <div class="row-title">Accès TCL</div>
                      </div>
                      <div>
                        ${
                          accesTc
                            ? `<span class="badge">${accesTc.replace(/\n/g, "<br>")}</span>`
                            : `<span class="badge badge-muted">Non précisé</span>`
                        }
                      </div>
                      ${
                        itineraryUrl
                          ? `<div style="margin-top:6px;">
                               <a class="link-btn" href="${itineraryUrl}" target="_blank" rel="noopener noreferrer">Itinéraire (transports en commun)</a>
                             </div>`
                          : ""
                      }
                    </div>

                    ${
                      comment
                        ? `
                      <div class="row">
                        <div class="row-head">
                          <div class="icon icon-comment"></div>
                          <div class="row-title">Commentaire</div>
                        </div>
                        <div>
                          <span class="badge">${comment.replace(/\n/g, "<br>")}</span>
                        </div>
                      </div>
                    `
                        : ""
                    }

                    ${agendaButtons ? `<div class="row">${agendaButtons}</div>` : ""}

                  </div>
                `
                      })
                      .join("")
              }
            </div>
          </div>
        `
      }).join("")}
    </div>

    <div class="footer">
      <p>Planning envoyé par <span class="footer-strong">${safeSenderPrenom || "ADAPTEL Lyon"}</span>.</p>
      <p class="footer-strong">Bonne mission avec ADAPTEL Lyon.</p>
      <p>
        N'oubliez pas de faire un relevé d'heures et le transmettre dès la fin de votre mission par WhatsApp ou par SMS.
      </p>
    </div>
  </div>
</body>
</html>
  `

  return { subject, body: html }
}

export function buildPlanningCandidatText(params: {
  prenom: string
  weekNumber: number
  mondayISO: string
  items: PlanningCandidatItem[]
  senderPrenom?: string
  customMessage?: string
}): string {
  const { prenom, weekNumber, mondayISO, items, senderPrenom = "", customMessage = "" } = params

  const monday = new Date(`${mondayISO}T00:00:00`)
  const sunday = addDays(monday, 6)

  const lines: string[] = []
  lines.push(`Votre planning ADAPTEL Lyon - Semaine ${weekNumber}`)
  lines.push(``)
  lines.push(`Bonjour ${prenom},`)
  lines.push(`Veuillez trouver votre planning pour la semaine du ${fmtFullDay(monday)} au ${fmtFullDay(sunday)}.`)
  if (customMessage?.trim()) {
    lines.push(``)
    lines.push(`Information : ${customMessage}`)
  }
  lines.push(``)

  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i)
    const iso = format(day, "yyyy-MM-dd")
    const dayItems = getMissionsForDay(items, iso)

    lines.push(`=== ${fmtDayTitle(day)} ===`)
    if (!dayItems.length) {
      lines.push(`Aucune mission programmée`)
      lines.push(``)
      continue
    }

    for (const it of dayItems) {
      const etab = it.clientNom || "Établissement"
      lines.push(`- ${etab}`)

      const sec = (it.secteur || "").trim()
      const svc = (it.service || "").trim()
      if (sec || svc) lines.push(`  ${sec}${sec && svc ? " • " : ""}${svc}`.trim())

      const { matin, soir, nuit } = buildCreneaux(it)
      const slots = [matin, soir, nuit].filter(Boolean)
      lines.push(`  Horaires : ${slots.length ? slots.join(" / ") : "Non communiqués"}`)

      const pauseTxt = fmtPause(it.pause)
      lines.push(`  Pause : ${pauseTxt || "Non communiquée"}`)

      const repas = it.repas_fournis === true ? "Oui" : it.repas_fournis === false ? "Non" : "Non précisé"
      lines.push(`  Repas : ${repas}`)

      const adr1 = (it.adresse || "").trim()
      const cp = (it.code_postal || "").trim()
      const ville = (it.ville || "").trim()
      const line2 = `${cp}${cp && ville ? " " : ""}${ville}`.trim()
      const adr = [adr1, line2].filter(Boolean).join(" / ")
      if (adr) lines.push(`  Adresse : ${adr}`)

      lines.push(`  Contact : ${it.telephone || "Non communiqué"}`)

      if ((it.tenue_description || "").trim()) lines.push(`  Tenue : ${it.tenue_description}`)

      if ((it.acces_tc || "").trim()) lines.push(`  Accès TCL : ${it.acces_tc}`)
      if ((it.itinerary_url || "").trim()) lines.push(`  Itinéraire : ${it.itinerary_url}`)

      if (it.commentaire) lines.push(`  Commentaire : ${it.commentaire}`)
      lines.push(``)
    }

    lines.push(``)
  }

  lines.push(`Planning envoyé par ${senderPrenom || "ADAPTEL Lyon"}.`)
  lines.push(`Bonne mission avec ADAPTEL Lyon.`)
  lines.push(
    `N'oubliez pas de faire un relevé d'heures et le transmettre dès la fin de votre mission par WhatsApp ou par SMS.`
  )

  return lines.join("\n")
}
