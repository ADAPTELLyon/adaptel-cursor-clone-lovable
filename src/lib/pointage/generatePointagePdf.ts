import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"

// ===============================
// Types
// ===============================
export type PointageGeneratePayload = {
  secteurs: string[]
  client: string
  services: string[]
  semaine: string
  datesISO: string[]
}

type CommandeRow = {
  id: string
  client_id: string | null
  secteur: string
  service: string | null
  date: string
  statut: string
  candidat_id: string | null
  heure_debut_matin: string | null
  heure_fin_matin: string | null
  heure_debut_soir: string | null
  heure_fin_soir: string | null
  heure_debut_nuit: string | null
  heure_fin_nuit: string | null
}

type CandidateLine = {
  candidatNomPrenom: string
  plannedStart: string
  plannedEnd: string
  pause: string
  total: string
}

type DaySheet = {
  dateISO: string
  clientNom: string
  secteurLabel: string
  serviceLabel: string
  lines: CandidateLine[]
}

// ===============================
// Couleurs & Design System
// ===============================
const COLORS = {
  primary: rgb(0.82, 0.02, 0.02), // #D10505 - Rouge Adaptel
  primaryLight: rgb(0.96, 0.92, 0.92), // Rouge très clair
  secondary: rgb(0.2, 0.2, 0.2), // Gris foncé
  lightGray: rgb(0.97, 0.97, 0.97),
  mediumGray: rgb(0.92, 0.92, 0.92),
  darkGray: rgb(0.5, 0.5, 0.5),
  white: rgb(1, 1, 1),
  black: rgb(0.1, 0.1, 0.1),
  border: rgb(0.85, 0.85, 0.85),
  hover: rgb(0.98, 0.98, 0.98)
}

// ===============================
// Utils time
// ===============================
function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

function normTime(t?: string | null): string | null {
  if (!t) return null
  const m = t.match(/^(\d{2}):(\d{2})/)
  if (!m) return null
  return `${m[1]}:${m[2]}`
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => Number(x))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return h * 60 + m
}

function minutesToHHMM(min: number): string {
  const m = Math.max(0, Math.round(min))
  const hh = Math.floor(m / 60)
  const mm = m % 60
  return `${pad2(hh)}:${pad2(mm)}`
}

function computeTotal(plannedStart: string, plannedEnd: string, pauseHHMM = "00:30") {
  const start = timeToMinutes(plannedStart)
  const end = timeToMinutes(plannedEnd)
  const pause = timeToMinutes(pauseHHMM)
  const total = Math.max(0, end - start - pause)
  return minutesToHHMM(total)
}

// ===============================
// Data fetch
// ===============================
async function fetchClientIdByNom(clientNom: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, nom")
    .eq("nom", clientNom)
    .maybeSingle()

  if (error) return null
  return data?.id ?? null
}

async function fetchCandidatsMap(ids: string[]) {
  const map = new Map<string, { nom?: string; prenom?: string }>()
  if (!ids.length) return map

  const { data } = await supabase.from("candidats").select("id, nom, prenom").in("id", ids)
  ;(data || []).forEach((c: any) => map.set(c.id, { nom: c.nom, prenom: c.prenom }))
  return map
}

async function fetchDaySheets(payload: PointageGeneratePayload): Promise<DaySheet[]> {
  const { secteurs, services, datesISO } = payload
  if (!datesISO || datesISO.length === 0) return []

  const clientId = await fetchClientIdByNom(payload.client)

  const secteurLabel = secteurs.join(" - ").toUpperCase()
  const serviceLabel = services.length ? services.join(" - ").toUpperCase() : ""

  if (!clientId) {
    return datesISO.map((d) => ({
      dateISO: d,
      clientNom: payload.client,
      secteurLabel,
      serviceLabel,
      lines: [],
    }))
  }

  const selectCols =
    "id, client_id, secteur, service, date, statut, candidat_id, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir, heure_debut_nuit, heure_fin_nuit"

  let q = supabase
    .from("commandes")
    .select(selectCols)
    .eq("client_id", clientId)
    .in("date", datesISO)

  if (secteurs?.length) q = q.in("secteur", secteurs)
  if (services?.length) q = q.in("service", services)

  const { data, error } = await q
  if (error || !data) {
    return datesISO.map((d) => ({
      dateISO: d,
      clientNom: payload.client,
      secteurLabel,
      serviceLabel,
      lines: [],
    }))
  }

  const rows = data as unknown as CommandeRow[]
  const planned = rows.filter((r) => r.statut === "Validé" && !!r.candidat_id)

  const candidatIds = Array.from(new Set(planned.map((r) => r.candidat_id!).filter(Boolean)))
  const candMap = await fetchCandidatsMap(candidatIds)

  const byDate = new Map<string, CommandeRow[]>()
  for (const r of planned) {
    const key = r.date
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(r)
  }

  return datesISO.map((d) => {
    const dayRows = byDate.get(d) || []

    const lines: CandidateLine[] = dayRows.map((r) => {
      const cand = r.candidat_id ? candMap.get(r.candidat_id) : undefined
      const nom = (cand?.nom || "CANDIDAT").toUpperCase()
      const prenom = cand?.prenom || ""
      const candidatNomPrenom = `${nom} ${prenom}`.trim()

      const start =
        normTime(r.heure_debut_matin) ||
        normTime(r.heure_debut_soir) ||
        normTime(r.heure_debut_nuit) ||
        ""
      const end =
        normTime(r.heure_fin_matin) ||
        normTime(r.heure_fin_soir) ||
        normTime(r.heure_fin_nuit) ||
        ""

      const pause = "00:30"
      const total = start && end ? computeTotal(start, end, pause) : ""

      return { candidatNomPrenom, plannedStart: start, plannedEnd: end, pause, total }
    })

    return {
      dateISO: d,
      clientNom: payload.client,
      secteurLabel,
      serviceLabel,
      lines,
    }
  })
}

// ===============================
// PDF helpers / layout modernisé
// ===============================
async function fetchLogoBytes(): Promise<Uint8Array | null> {
  try {
    const res = await fetch("/logo-adaptel.png")
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

function safeUpper(s: string) {
  return (s || "").toUpperCase()
}

function ellipsize(text: string, maxChars: number) {
  if (!text) return ""
  if (text.length <= maxChars) return text
  return text.slice(0, Math.max(0, maxChars - 1)) + "…"
}

function drawRoundedRect(page: any, x: number, y: number, w: number, h: number, fill: any, radius: number = 3) {
  // Simulation d'un rectangle arrondi avec PDF-lib (dessin simplifié)
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: fill,
    borderColor: COLORS.border,
    borderWidth: 0.8,
  })
}

function drawHeaderBox(page: any, x: number, y: number, w: number, h: number, label: string, value: string, font: any, fontBold: any) {
  // Fond
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: COLORS.lightGray,
    borderColor: COLORS.border,
    borderWidth: 0.6,
  })
  
  // Label
  page.drawText(label, {
    x: x + 8,
    y: y + h - 18,
    size: 8,
    font: font,
    color: COLORS.darkGray,
  })
  
  // Valeur
  page.drawText(value, {
    x: x + 8,
    y: y + h - 30,
    size: 11,
    font: fontBold,
    color: COLORS.black,
  })
}

// ===============================
// MAIN - PDF MODERNISÉ
// ===============================
export async function generatePointagePdf(payload: PointageGeneratePayload) {
  const sheets = await fetchDaySheets(payload)

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontLight = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const logoBytes = await fetchLogoBytes()
  let logoImg: any = null
  if (logoBytes) {
    try {
      logoImg = await pdfDoc.embedPng(logoBytes)
    } catch {
      logoImg = null
    }
  }

  // A4 paysage
  const PAGE_W = 841.89
  const PAGE_H = 595.28
  const MARGIN = 28
  const MARGIN_TOP = 22

  // Table layout - proportions modernisées
  const tableLeft = MARGIN
  const tableRight = PAGE_W - MARGIN
  const tableW = tableRight - tableLeft

  // Colonnes avec proportions améliorées
  const col = {
    nom: 0.24,           // Un peu plus large pour les noms
    label: 0.06,         // Colonne Prévus/Réelles
    heure: 0.085,        // Colonnes heure
    total: 0.085,        // Total heures
    sign: 0.17,          // Signature
  }

  // Positions X des colonnes
  const xNom = tableLeft
  const xLabel = xNom + tableW * col.nom
  const xArr = xLabel + tableW * col.label
  const xPause = xArr + tableW * col.heure
  const xDep = xPause + tableW * col.heure
  const xTotal = xDep + tableW * col.heure
  const xSignInt = xTotal + tableW * col.total
  const xSignResp = xSignInt + tableW * col.sign

  // Largeurs des colonnes
  const wNom = tableW * col.nom
  const wLabel = tableW * col.label
  const wHeure = tableW * col.heure
  const wTotal = tableW * col.total
  const wSign = tableW * col.sign

  // Hauteurs
  const HEADER_BANNER_H = 40
  const HEADER_BLOCK_H = 95
  const TABLE_HEADER_H = 32
  const ROW_H = 44 // Une seule ligne par candidat maintenant
  const FIXED_ROWS_PER_PAGE = 11 // Une de plus pour la lisibilité

  for (const sheet of sheets) {
    const lines = [...sheet.lines].sort((a, b) => a.candidatNomPrenom.localeCompare(b.candidatNomPrenom, "fr"))
    const totalPagesForDay = Math.max(1, Math.ceil(lines.length / FIXED_ROWS_PER_PAGE))

    for (let pIndex = 0; pIndex < totalPagesForDay; pIndex++) {
      const page = pdfDoc.addPage([PAGE_W, PAGE_H])

      // === HEADER MODERNISÉ ===
      // Bandeau rouge avec dégradé simulé
      page.drawRectangle({
        x: 0,
        y: PAGE_H - HEADER_BANNER_H,
        width: PAGE_W,
        height: HEADER_BANNER_H,
        color: COLORS.primary,
      })

      // Texte bandeau
      page.drawText("FEUILLE DE POINTAGE INTÉRIMAIRE", {
        x: MARGIN,
        y: PAGE_H - HEADER_BANNER_H + 14,
        size: 14,
        font: fontBold,
        color: COLORS.white,
      })

      page.drawText("ADAPTEL", {
        x: PAGE_W - MARGIN - 80,
        y: PAGE_H - HEADER_BANNER_H + 14,
        size: 14,
        font: fontBold,
        color: COLORS.white,
      })

      // Ligne séparatrice fine
      page.drawLine({
        start: { x: 0, y: PAGE_H - HEADER_BANNER_H },
        end: { x: PAGE_W, y: PAGE_H - HEADER_BANNER_H },
        thickness: 1,
        color: COLORS.primaryLight,
      })

      // === EN-TÊTE INFORMATIONS ===
      const headerStartY = PAGE_H - HEADER_BANNER_H - 15
      const headerBoxH = 70
      const headerBoxW = (PAGE_W - 2 * MARGIN - 20) / 3

      // Logo
      if (logoImg) {
        const logoH = 32
        const scale = logoH / logoImg.height
        const logoW = logoImg.width * scale
        page.drawImage(logoImg, {
          x: MARGIN,
          y: headerStartY - 25,
          width: logoW,
          height: logoH,
        })
      }

      // Informations client
      const infoX = MARGIN + (logoImg ? 150 : 0)
      
      // Date - en accent color
      const dateObj = new Date(sheet.dateISO + "T00:00:00")
      const dateLabel = format(dateObj, "EEEE d MMMM yyyy", { locale: fr })
      const dateText = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)
      
      page.drawText(dateText, {
        x: infoX,
        y: headerStartY - 10,
        size: 16,
        font: fontBold,
        color: COLORS.primary,
      })

      // Client
      page.drawText(sheet.clientNom, {
        x: infoX,
        y: headerStartY - 35,
        size: 13,
        font: fontBold,
        color: COLORS.black,
      })

      // Secteur/Service
      const badgeText = [safeUpper(sheet.secteurLabel), safeUpper(sheet.serviceLabel)]
        .filter(Boolean)
        .join(" • ")
      
      page.drawText(badgeText, {
        x: infoX,
        y: headerStartY - 55,
        size: 10,
        font: font,
        color: COLORS.darkGray,
      })

      // Numéro de page
      if (totalPagesForDay > 1) {
        const pageText = `Page ${pIndex + 1}/${totalPagesForDay}`
        const pageTextWidth = fontBold.widthOfTextAtSize(pageText, 10)
        page.drawText(pageText, {
          x: PAGE_W - MARGIN - pageTextWidth,
          y: headerStartY - 55,
          size: 10,
          font: fontBold,
          color: COLORS.darkGray,
        })
      }

      // === TABLEAU PRINCIPAL ===
      const tableStartY = headerStartY - HEADER_BLOCK_H
      const tableHeaderY = tableStartY - TABLE_HEADER_H

      // En-tête du tableau avec effet "card"
      page.drawRectangle({
        x: tableLeft - 1,
        y: tableHeaderY - 1,
        width: tableW + 2,
        height: TABLE_HEADER_H + 2,
        color: COLORS.primary,
        borderColor: COLORS.primary,
        borderWidth: 1,
      })

      // Texte en-tête
      const headerTextY = tableHeaderY + TABLE_HEADER_H / 2 - 5
      
      page.drawText("NOM - PRÉNOM", {
        x: xNom + 10,
        y: headerTextY,
        size: 10,
        font: fontBold,
        color: COLORS.white,
      })

      page.drawText("HEURE D'ARRIVÉE", {
        x: xArr + wHeure / 2 - 45,
        y: headerTextY,
        size: 10,
        font: fontBold,
        color: COLORS.white,
      })

      page.drawText("PAUSE", {
        x: xPause + wHeure / 2 - 18,
        y: headerTextY,
        size: 10,
        font: fontBold,
        color: COLORS.white,
      })

      page.drawText("HEURE DE DÉPART", {
        x: xDep + wHeure / 2 - 45,
        y: headerTextY,
        size: 10,
        font: fontBold,
        color: COLORS.white,
      })

      page.drawText("TOTAL", {
        x: xTotal + wTotal / 2 - 20,
        y: headerTextY,
        size: 10,
        font: fontBold,
        color: COLORS.white,
      })

      page.drawText("SIGNATURE INTÉRIMAIRE", {
        x: xSignInt + 10,
        y: headerTextY,
        size: 10,
        font: fontBold,
        color: COLORS.white,
      })

      page.drawText("SIGNATURE RESPONSABLE", {
        x: xSignResp + 10,
        y: headerTextY,
        size: 10,
        font: fontBold,
        color: COLORS.white,
      })

      // === LIGNES DU TABLEAU ===
      let currentY = tableHeaderY
      const sliceStart = pIndex * FIXED_ROWS_PER_PAGE
      const slice = lines.slice(sliceStart, sliceStart + FIXED_ROWS_PER_PAGE)

      const rowsToRender: Array<CandidateLine | null> = [...slice]
      while (rowsToRender.length < FIXED_ROWS_PER_PAGE) rowsToRender.push(null)

      for (let i = 0; i < rowsToRender.length; i++) {
        const line = rowsToRender[i]
        currentY -= ROW_H

        // Fond alterné pour lisibilité
        const rowBgColor = i % 2 === 0 ? COLORS.white : COLORS.lightGray
        
        // Ligne complète
        page.drawRectangle({
          x: tableLeft,
          y: currentY,
          width: tableW,
          height: ROW_H,
          color: rowBgColor,
          borderColor: COLORS.border,
          borderWidth: 0.5,
        })

        // Lignes verticales
        const vLines = [xLabel, xArr, xPause, xDep, xTotal, xSignInt, xSignResp]
        vLines.forEach(vx => {
          page.drawLine({
            start: { x: vx, y: currentY },
            end: { x: vx, y: currentY + ROW_H },
            thickness: 0.5,
            color: COLORS.border,
          })
        })

        // === CONTENU DES CELLULES ===
        const cellCenterY = currentY + ROW_H / 2 - 4

        // Nom du candidat
        if (line?.candidatNomPrenom) {
          page.drawText(ellipsize(line.candidatNomPrenom, 28), {
            x: xNom + 12,
            y: cellCenterY,
            size: 10,
            font: fontBold,
            color: COLORS.black,
          })
        } else {
          // Ligne vide pour ajout manuel
          page.drawText("_____________________", {
            x: xNom + 12,
            y: cellCenterY,
            size: 9,
            font: fontLight,
            color: COLORS.darkGray,
          })
        }

        // Colonne "Prévus/Réelles" (maintenant sur le côté)
        const labelX = xLabel + 6
        page.drawText("PRÉVU", {
          x: labelX,
          y: currentY + ROW_H - 14,
          size: 7,
          font: font,
          color: COLORS.darkGray,
        })
        
        page.drawText("RÉEL", {
          x: labelX,
          y: currentY + 10,
          size: 8,
          font: fontBold,
          color: COLORS.primary,
        })

        // === HEURES PRÉVUES ===
        if (line) {
          // Heure d'arrivée prévue
          if (line.plannedStart) {
            page.drawText(line.plannedStart, {
              x: xArr + wHeure / 2 - 10,
              y: currentY + ROW_H - 14,
              size: 9,
              font: fontBold,
              color: COLORS.darkGray,
            })
          }

          // Pause prévue
          page.drawText(line.pause || "00:30", {
            x: xPause + wHeure / 2 - 10,
            y: currentY + ROW_H - 14,
            size: 9,
            font: fontBold,
            color: COLORS.darkGray,
          })

          // Heure de départ prévue
          if (line.plannedEnd) {
            page.drawText(line.plannedEnd, {
              x: xDep + wHeure / 2 - 10,
              y: currentY + ROW_H - 14,
              size: 9,
              font: fontBold,
              color: COLORS.darkGray,
            })
          }

          // Total prévu
          if (line.total) {
            page.drawText(line.total, {
              x: xTotal + wTotal / 2 - 10,
              y: currentY + ROW_H - 14,
              size: 9,
              font: fontBold,
              color: COLORS.darkGray,
            })
          }
        } else {
          // Pour les lignes vides, pause par défaut
          page.drawText("00:30", {
            x: xPause + wHeure / 2 - 10,
            y: currentY + ROW_H - 14,
            size: 9,
            font: fontBold,
            color: COLORS.darkGray,
          })
        }

        // === ZONES DE SAISIE RÉELLES ===
        // Heures (avec placeholder ":")
        const realY = currentY + 10
        page.drawText(":", {
          x: xArr + wHeure / 2 - 2,
          y: realY,
          size: 12,
          font: fontBold,
          color: COLORS.mediumGray,
        })

        page.drawText(":", {
          x: xPause + wHeure / 2 - 2,
          y: realY,
          size: 12,
          font: fontBold,
          color: COLORS.mediumGray,
        })

        page.drawText(":", {
          x: xDep + wHeure / 2 - 2,
          y: realY,
          size: 12,
          font: fontBold,
          color: COLORS.mediumGray,
        })

        page.drawText(":", {
          x: xTotal + wTotal / 2 - 2,
          y: realY,
          size: 12,
          font: fontBold,
          color: COLORS.mediumGray,
        })

        // Zones de signature (lignes)
        const signY = currentY + ROW_H / 2 - 2
        
        page.drawLine({
          start: { x: xSignInt + 5, y: signY },
          end: { x: xSignInt + wSign - 10, y: signY },
          thickness: 0.8,
          color: COLORS.mediumGray,
        })

        page.drawLine({
          start: { x: xSignResp + 5, y: signY },
          end: { x: xSignResp + wSign - 10, y: signY },
          thickness: 0.8,
          color: COLORS.mediumGray,
        })
      }

      // === FOOTER ===
      const footerY = MARGIN + 20
      
      // Instructions
      page.drawText("• Temps de pause en minutes - Si pas de pause, noter 0", {
        x: MARGIN,
        y: footerY,
        size: 8,
        font: font,
        color: COLORS.darkGray,
      })

      page.drawText("• Total heures : nombre total d'heures travaillées (pauses déduites)", {
        x: MARGIN,
        y: footerY - 12,
        size: 8,
        font: font,
        color: COLORS.darkGray,
      })

      // Code document
      const docCode = `DOC-${format(new Date(sheet.dateISO), 'yyyyMMdd')}-${sheet.clientNom.substring(0, 4).toUpperCase()}`
      page.drawText(docCode, {
        x: PAGE_W - MARGIN - 100,
        y: footerY - 5,
        size: 9,
        font: fontBold,
        color: COLORS.primary,
      })

      // Ligne de séparation footer
      page.drawLine({
        start: { x: MARGIN, y: MARGIN + 5 },
        end: { x: PAGE_W - MARGIN, y: MARGIN + 5 },
        thickness: 0.5,
        color: COLORS.border,
      })
    }
  }

  // === TÉLÉCHARGEMENT ===
  const bytes = await pdfDoc.save()
  const u8 = new Uint8Array(bytes)
  const blob = new Blob([u8], { type: "application/pdf" })

  // Nom du fichier
  const clientNom = payload.client || "CLIENT"
  const week = payload.semaine || ""
  const isSingleDay = payload.datesISO?.length === 1

  let filename = ""
  if (isSingleDay) {
    const d = new Date(payload.datesISO[0] + "T00:00:00")
    const short = format(d, "EEE d MMM", { locale: fr })
    const nice = short.charAt(0).toUpperCase() + short.slice(1)
    filename = `Pointage ${nice} - ${clientNom}.pdf`
  } else {
    filename = `Pointage - ${clientNom} - Semaine ${week}.pdf`
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}