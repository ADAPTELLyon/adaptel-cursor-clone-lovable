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
}

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function fmtDayTitle(date: Date) {
  return cap(format(date, "EEEE d MMMM", { locale: fr }))
}

function fmtWeekRange(monday: Date) {
  const sunday = addDays(monday, 6)
  return `${format(monday, "dd MMM")} au ${format(sunday, "dd MMM yyyy")}`
}

function fmtTime(t?: string | null) {
  if (!t) return ""
  const parts = String(t).split(":")
  if (parts.length < 2) return String(t)
  const hh = String(Number(parts[0]))
  const mm = parts[1].padStart(2, "0")
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
  const chunks: string[] = []
  if (h > 0) chunks.push(h === 1 ? "1 heure" : `${h} heures`)
  if (m > 0) chunks.push(`${m} minutes`)
  return chunks.join(" ")
}

function buildMissionHeader(it: PlanningCandidatItem) {
  const client = (it.clientNom ?? "").trim()
  const secteur = (it.secteur ?? "").trim()
  const service = (it.service ?? "").trim()
  const headerParts = [client, secteur, service].filter(Boolean)
  return headerParts.join(" • ")
}

export function buildPlanningCandidatEmail(params: {
  prenom: string
  weekNumber: number
  mondayISO: string
  items: PlanningCandidatItem[]
}) {
  const { prenom, weekNumber, mondayISO, items } = params
  const subject = `Votre Planning - Semaine ${weekNumber} | ADAPTEL Lyon`
  
  const monday = new Date(`${mondayISO}T00:00:00`)
  const weekRange = fmtWeekRange(monday)

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Planning Semaine ${weekNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #ffffff;
      padding: 20px;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    
    .header {
      padding: 24px;
      text-align: center;
      border-bottom: 1px solid #f3f4f6;
    }
    
    .logo-text {
      font-size: 24px;
      font-weight: 800;
      color: #8a0000;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }
    
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 8px;
    }
    
    .subtitle {
      color: #6b7280;
      font-size: 15px;
      margin-bottom: 4px;
    }
    
    .greeting {
      margin-top: 16px;
      font-size: 16px;
      color: #374151;
      font-weight: 500;
    }
    
    .custom-message {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 6px;
      font-size: 15px;
      color: #92400e;
    }
    
    .content {
      padding: 0 24px 24px;
    }
    
    .week-period {
      text-align: center;
      margin: 16px 0 24px;
      padding: 12px;
      background: #fef2f2;
      border-radius: 10px;
      font-weight: 500;
      color: #8a0000;
      font-size: 15px;
    }
    
    .day-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    
    .day-header {
      background: #f8fafc;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .day-title {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .day-title:before {
      content: "📅";
      font-size: 18px;
    }
    
    .no-mission {
      padding: 24px 20px;
      text-align: center;
      color: #9ca3af;
      font-size: 15px;
    }
    
    .mission-block {
      padding: 20px;
      border-bottom: 1px solid #f3f4f6;
    }
    
    .mission-block:last-child {
      border-bottom: none;
    }
    
    .mission-header {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
    }
    
    .info-grid {
      display: grid;
      gap: 14px;
    }
    
    .info-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }
    
    .icon-wrapper {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 14px;
    }
    
    .icon-time { background: #fef3c7; color: #92400e; }
    .icon-pause { background: #dbeafe; color: #1e40af; }
    .icon-location { background: #dcfce7; color: #166534; }
    .icon-phone { background: #f3e8ff; color: #6b21a8; }
    
    .icon-text {
      font-size: 15px;
      line-height: 1.5;
    }
    
    .hours-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }
    
    .hour-badge {
      background: #fee2e2;
      color: #991b1b;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
    }
    
    .footer {
      padding: 24px;
      text-align: center;
      background: #f8fafc;
      border-top: 1px solid #e5e7eb;
    }
    
    .company {
      font-size: 17px;
      font-weight: 700;
      color: #8a0000;
      margin-bottom: 8px;
    }
    
    .note {
      font-size: 13px;
      color: #6b7280;
      margin-top: 12px;
    }
    
    @media (max-width: 600px) {
      body { padding: 12px; }
      .header { padding: 20px 16px; }
      .content { padding: 0 16px 16px; }
      .day-header { padding: 14px 16px; }
      .mission-block { padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="logo-text">ADAPTEL LYON</div>
      <div class="title">Votre Planning</div>
      <div class="subtitle">Semaine ${weekNumber}</div>
      <div class="subtitle">${weekRange}</div>
      <div class="greeting">Bonjour ${prenom},</div>
    </div>
    
    <div class="content">
      <div class="week-period">Période : ${weekRange}</div>
      
      ${Array.from({ length: 7 }, (_, i) => {
        const day = addDays(monday, i)
        const iso = format(day, "yyyy-MM-dd")
        const dayItems = items.filter((x) => x.dateISO === iso)
        
        return `
          <div class="day-card">
            <div class="day-header">
              <div class="day-title">${fmtDayTitle(day)}</div>
            </div>
            
            ${dayItems.length === 0 ? `
              <div class="no-mission">Aucune mission programmée</div>
            ` : dayItems.map(item => {
              const matin = fmtTimeRange(item.heure_debut_matin, item.heure_fin_matin)
              const soir = fmtTimeRange(item.heure_debut_soir, item.heure_fin_soir)
              const nuit = fmtTimeRange(item.heure_debut_nuit, item.heure_fin_nuit)
              const horaires = [matin, soir, nuit].filter(Boolean)
              const pauseTxt = fmtPause(item.pause)
              const adresseComplete = [item.adresse, item.code_postal, item.ville].filter(Boolean).join(', ')
              
              return `
                <div class="mission-block">
                  <div class="mission-header">${buildMissionHeader(item)}</div>
                  
                  <div class="info-grid">
                    ${horaires.length > 0 ? `
                      <div class="info-item">
                        <div class="icon-wrapper icon-time">🕐</div>
                        <div>
                          <div class="icon-text">Horaires</div>
                          <div class="hours-badges">
                            ${horaires.map(h => `<span class="hour-badge">${h}</span>`).join('')}
                          </div>
                        </div>
                      </div>
                    ` : ''}
                    
                    ${pauseTxt ? `
                      <div class="info-item">
                        <div class="icon-wrapper icon-pause">⏸️</div>
                        <div class="icon-text">Pause : ${pauseTxt}</div>
                      </div>
                    ` : ''}
                    
                    ${adresseComplete ? `
                      <div class="info-item">
                        <div class="icon-wrapper icon-location">📍</div>
                        <div class="icon-text">${adresseComplete}</div>
                      </div>
                    ` : ''}
                    
                    ${item.telephone ? `
                      <div class="info-item">
                        <div class="icon-wrapper icon-phone">📱</div>
                        <div class="icon-text">${item.telephone}</div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `
            }).join('')}
          </div>
        `
      }).join('')}
    </div>
    
    <div class="footer">
      <div class="company">ADAPTEL Lyon</div>
      <div>contact@adaptel-lyon.fr</div>
      <div class="note">
        Ce planning est généré automatiquement. Pour toute modification, contactez votre responsable.
      </div>
    </div>
  </div>
</body>
</html>
  `

  return { subject, body: html }
}