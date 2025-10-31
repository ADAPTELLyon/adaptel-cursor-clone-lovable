// src/lib/generateClientPlanningPdf.ts
import jsPDF from "jspdf"
import autoTable, { RowInput } from "jspdf-autotable"

/* ------------------------------- Types PDF ------------------------------- */
export type DayHeader = {
  date: string
  label: string
  dayName: string
  dayNum: string
  monthShort: string
}

// Une cellule de journée peut contenir plusieurs missions (ex : 2 personnes le même jour)
export type CommandeCell = {
  statut: string
  candidat?: { nom: string; prenom: string } | null
  heure_debut_matin: string | null
  heure_fin_matin: string | null
  heure_debut_soir: string | null
  heure_fin_soir: string | null
}

export type ClientPlanningRow = {
  secteur: string                  // label secteur (ex: "Cuisine")
  service: string | null           // service éventuel
  label: string                    // "Nom - Prénom" ou libellé du statut (ex: "En recherche")
  totalMinutes: number             // total d'heures (en minutes) pour la ligne
  days: CommandeCell[][]           // 7 colonnes, chacune liste de missions
}

export type ClientPlanningInput = {
  client: { id: string; nom: string }
  secteurSelection: string                 // libellé choisi dans le popup (ex: "Cuisine")
  semaine: number
  daysHeaders: DayHeader[]
  userName: string
  rows: ClientPlanningRow[]
  services?: string[]
}

/* ---------------------------- Thème simple & propre ---------------------------- */
const BRAND = "#840404"
const TEXT = "#111827"
const TEXT_MUTED = "#4b5563"
const BORDER = "#e5e7eb"
const BG_SOFT = "#f9fafb"

const STATUT_BG: Record<string, string> = {
  "Validé": "#16a34a",
  "En recherche": "#f59e0b",
  "Non pourvue": "#9ca3af",
  "Absence": "#ef4444",
  "Annule Client": "#ef4444",
  "Annule ADA": "#6b7280",
  "": "#e5e7eb",
}
const STATUT_TEXT: Record<string, string> = {
  "Validé": "#ffffff",
  "En recherche": "#111827",
  "Non pourvue": "#111827",
  "Absence": "#ffffff",
  "Annule Client": "#ffffff",
  "Annule ADA": "#ffffff",
  "": "#111827",
}

const fmt = (h?: string | null) => {
  if (!h) return ""
  // accepte "HH:MM" ou "HH:MM:SS"
  const s = h.length >= 5 ? h.slice(0, 5) : h
  return /^\d{2}:\d{2}$/.test(s) ? s : ""
}

function sectorInitials(label: string) {
  const s = (label || "").toLowerCase()
  if (s.startsWith("cuisine")) return "CU"
  if (s.startsWith("salle")) return "SA"
  if (s.startsWith("plonge")) return "PL"
  if (s.startsWith("réception") || s.startsWith("reception")) return "RE"
  if (s.startsWith("étages") || s.startsWith("etages")) return "ET"
  return "SE"
}

function minutesToHHmm(min: number) {
  const abs = Math.max(0, Math.round(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const hh = String(h).padStart(2, "0")
  const mm = String(m).padStart(2, "0")
  return `${hh}:${mm}`
}

/* --------------------------------- PDF ---------------------------------- */
export async function generateClientPlanningPdf(input: ClientPlanningInput): Promise<void> {
  const { client, secteurSelection, semaine, daysHeaders, userName, rows, services } = input

  // Orientation : paysage si <= 20 lignes, sinon portrait (lisible si gros volume)
  const orientation: "p" | "l" = rows.length > 20 ? "p" : "l"
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" })
  const page = doc.internal.pageSize
  const W = page.getWidth()
  const H = page.getHeight()

  const Mx = 36
  const MyTop = 40
  const MyBottom = 52

  /* En-tête */
  doc.setFillColor(BG_SOFT)
  doc.rect(0, 0, W, MyTop + 52, "F")

  doc.setTextColor(TEXT)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(`Planning client — ${secteurSelection}`, W / 2, MyTop + 2, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.setTextColor(TEXT_MUTED)
  const svc = (services && services.length) ? ` — ${services.join(" / ")}` : ""
  doc.text(`${client.nom}${svc} — Semaine ${semaine}`, W / 2, MyTop + 20, { align: "center" })

  /* Bandeau jours */
  const firstColW = 280  // secteur+service+nom+total heures
  const usableW = W - Mx * 2 - firstColW
  const dayColW = usableW / 7
  const headerY = MyTop + 30

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(TEXT)
  doc.text("Secteur / Service / Candidat", Mx + 6, headerY + 14)

  daysHeaders.forEach((d, i) => {
    const x = Mx + firstColW + i * dayColW
    doc.setDrawColor(BORDER)
    doc.roundedRect(x, headerY, dayColW, 34, 6, 6, "S")

    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(TEXT)
    doc.text(d.dayName.charAt(0).toUpperCase() + d.dayName.slice(1), x + dayColW / 2, headerY + 13, { align: "center" })

    doc.setFillColor(BRAND); doc.circle(x + dayColW / 2, headerY + 22, 7, "F")
    doc.setTextColor("#fff"); doc.setFontSize(9)
    doc.text(d.dayNum, x + dayColW / 2, headerY + 25, { align: "center" })
  })

  doc.setDrawColor(BORDER)
  doc.line(Mx, headerY + 40, W - Mx, headerY + 40)

  // Hauteur de ligne selon le nb de missions max par jour
  const CARD_H = 48
  const CARD_GAP = 4
  const ROW_PAD = 6
  const rowHeights = rows.map(r => {
    const maxPerDay = Math.max(1, ...r.days.map(list => list.length || 0))
    return ROW_PAD * 2 + (CARD_H * maxPerDay) + (CARD_GAP * (maxPerDay - 1))
  })

  const head: RowInput[] = [[]]
  const body: RowInput[] = rows.map(r => {
    const arr: any[] = new Array(8).fill("")
    arr[0] = { content: r.label }
    for (let i = 0; i < 7; i++) arr[i + 1] = { content: "" }
    return arr
  })

  autoTable(doc, {
    startY: headerY + 44,
    theme: "plain",
    head,
    body,
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      textColor: TEXT,
      cellPadding: { top: ROW_PAD, right: 8, bottom: ROW_PAD, left: ROW_PAD },
      lineColor: BORDER,
      lineWidth: 0.5,
      minCellHeight: 44,
      halign: "left",
      valign: "top",
    },
    columnStyles: {
      0: { cellWidth: firstColW },
      1: { cellWidth: dayColW }, 2: { cellWidth: dayColW }, 3: { cellWidth: dayColW },
      4: { cellWidth: dayColW }, 5: { cellWidth: dayColW }, 6: { cellWidth: dayColW }, 7: { cellWidth: dayColW },
    },
    margin: { left: Mx, right: Mx, top: 0, bottom: MyBottom },
    didParseCell: (data) => {
      if (data.section === "body") {
        const h = rowHeights[data.row.index] || 44
        ;(data.cell.styles as any).minCellHeight = h
      }
    },
    willDrawCell: (data) => { (data.cell.styles as any).fillColor = undefined },
    didDrawCell: (data) => {
      if (data.section !== "body") return
      const { column, row, cell } = data
      const r = rows[row.index]

      // contour
      const docAny = doc as any
      doc.setDrawColor(BORDER)
      doc.rect(cell.x, cell.y, cell.width, cell.height)

      if (column.index === 0) {
        // Colonne info : pastille secteur + service + nom + total heures
        const top = cell.y + 10
        // Pastille secteur
        doc.setFillColor("#e5e7eb"); doc.circle(cell.x + 10, top + 6, 7, "F")
        doc.setTextColor("#374151"); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5)
        doc.text(sectorInitials(r.secteur), cell.x + 10, top + 8.5, { align: "center" })

        // Service
        doc.setTextColor(TEXT); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5)
        doc.text(r.service || "(Sans service)", cell.x + 26, top + 4)

        // Label ligne (Nom - Prénom) ou libellé statut
        doc.setFont("helvetica", "normal"); doc.setFontSize(10)
        doc.text(r.label, cell.x + 26, top + 20)

        // Total heures
        doc.setFont("helvetica", "bold"); doc.setTextColor(BRAND); doc.setFontSize(10.5)
        const hhmm = minutesToHHmm(r.totalMinutes)
        doc.text(hhmm, cell.x + cell.width - 28, top + 20, { align: "right" })
        return
      }

      const dayIdx = column.index - 1
      const list = r.days[dayIdx] || []
      if (!list.length) return

      const x = cell.x + ROW_PAD
      let y = cell.y + ROW_PAD
      const w = cell.width - ROW_PAD * 2

      for (let i = 0; i < list.length; i++) {
        const c = list[i]
        const bg = STATUT_BG[c.statut] || STATUT_BG[""]
        const fg = STATUT_TEXT[c.statut] || STATUT_TEXT[""]

        doc.setFillColor(bg)
        doc.roundedRect(x, y, w, CARD_H, 5, 5, "F")

        doc.setTextColor(fg)
        if (c.statut === "Validé" && c.candidat) {
          doc.setFont("helvetica", "bold"); doc.setFontSize(11)
          doc.text(`${c.candidat.nom}`, x + 6, y + 14)
          doc.setFont("helvetica", "normal"); doc.setFontSize(10)
          doc.text(`${c.candidat.prenom}`, x + 6, y + 28)
        } else {
          doc.setFont("helvetica", "bold"); doc.setFontSize(11)
          doc.text(c.statut || "—", x + 6, y + 18)
        }

        // Heures : Matin/Midi + Soir (Étages n'a que Matin/Midi côté données, on affiche ce qui existe)
        doc.setFont("helvetica", "bold"); doc.setFontSize(10.5)
        const m1 = (c.heure_debut_matin && c.heure_fin_matin) ? `${fmt(c.heure_debut_matin)} ${fmt(c.heure_fin_matin)}` : ""
        const s1 = (c.heure_debut_soir && c.heure_fin_soir) ? `${fmt(c.heure_debut_soir)} ${fmt(c.heure_fin_soir)}` : ""
        let hy = y + 42
        if (m1) { doc.text(m1, x + 6, hy); hy += 12 }
        if (s1) { doc.text(s1, x + 6, hy) }

        y += CARD_H + CARD_GAP
        if (y > cell.y + cell.height - CARD_H) break
      }
    },
    didDrawPage: () => {
      // Pied
      const y = H - MyBottom + 6
      doc.setDrawColor(BORDER)
      doc.line(Mx, y, W - Mx, y)

      doc.setTextColor(TEXT_MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(10)
      doc.text(`Envoyé par : ${userName}`, Mx, y + 18)
      doc.text(`Semaine ${semaine}`, W / 2, y + 18, { align: "center" })

      doc.setFillColor(BRAND)
      const bw = 210, bh = 22
      doc.roundedRect(W - Mx - bw, y + 8, bw, bh, 6, 6, "F")
      doc.setTextColor("#fff"); doc.setFont("helvetica", "bold"); doc.setFontSize(11)
      doc.text(`ADAPTEL LYON — S${semaine}`, W - Mx - bw / 2, y + 23, { align: "center" })
    },
  })

  const fileName = `Planning client - ${client.nom}${services?.length ? " - " + services.join(", ") : ""} - Semaine ${semaine}.pdf`
  doc.save(fileName)
}
