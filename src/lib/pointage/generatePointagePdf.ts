import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { format, parse, differenceInMinutes } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"

export type PointageGeneratePayload = {
  secteurs: string[]
  client: string
  services: string[]
  semaine: string
  datesISO: string[]
}

const BRAND_RED = rgb(0.54, 0, 0) // ~ #8a0000
const TEXT_DARK = rgb(0.1, 0.1, 0.1)
const BORDER_COLOR = rgb(0.85, 0.85, 0.85)
const BG_BANDEAU = rgb(0.92, 0.92, 0.92)

/**
 * Badge arrondi (fiable) : 2 rectangles + 4 cercles.
 * Utilisé uniquement pour les étiquettes (footer date).
 */
function drawRoundedBadge(page: any, x: number, y: number, w: number, h: number, r: number, color: any) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2))

  page.drawRectangle({ x: x + rr, y, width: w - rr * 2, height: h, color })
  page.drawRectangle({ x, y: y + rr, width: w, height: h - rr * 2, color })

  page.drawCircle({ x: x + rr, y: y + rr, size: rr, color })
  page.drawCircle({ x: x + w - rr, y: y + rr, size: rr, color })
  page.drawCircle({ x: x + rr, y: y + h - rr, size: rr, color })
  page.drawCircle({ x: x + w - rr, y: y + h - rr, size: rr, color })
}

// Normalisation robuste (accents / casse / espaces)
function norm(str: string) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function normTime(t?: string | null): string | null {
  if (!t || t === "00:00") return null
  const m = t.match(/^(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : null
}

function calculateTotal(start: string | null, end: string | null): string {
  if (!start || !end) return ""
  try {
    const s = parse(start, "HH:mm", new Date())
    const e = parse(end, "HH:mm", new Date())
    let diff = differenceInMinutes(e, s)
    if (diff < 0) diff += 1440
    const finalMin = diff - 30
    const h = Math.floor(finalMin / 60)
    const m = finalMin % 60
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
  } catch {
    return ""
  }
}

export async function generatePointagePdf(payload: PointageGeneratePayload) {
  const { datesISO, client, secteurs, services, semaine } = payload

  // ✅ sécurités simples
  if (!client) throw new Error("Client manquant")
  if (!Array.isArray(datesISO) || datesISO.length === 0) throw new Error("Aucune date sélectionnée")
  if (!Array.isArray(secteurs) || secteurs.length === 0) throw new Error("Aucun secteur sélectionné")

  const { data: clientData, error: clientErr } = await supabase
    .from("clients")
    .select("id")
    .eq("nom", client)
    .maybeSingle()

  if (clientErr) throw clientErr
  if (!clientData?.id) throw new Error("Client introuvable")

  // ✅ FIX URGENT :
  // Avant : on prenait TOUS les validés du client sur la semaine => mélange Cuisine/Salle possible
  // Maintenant : filtre strict par secteurs + (si choisi) services
  let query = supabase
    .from("commandes")
    .select("*, candidats(nom, prenom)")
    .eq("client_id", clientData.id)
    .in("date", datesISO)
    .eq("statut", "Validé")
    // ✅ filtre secteur direct en DB
    .in("secteur", secteurs)

  // ✅ filtre service uniquement si l'user a coché des services
  // (si services = [], on garde "tous services" MAIS TOUJOURS dans le(s) secteur(s) choisi(s))
  if (Array.isArray(services) && services.length > 0) {
    query = query.in("service", services)
  }

  const { data: rawFromDb, error: cmdErr } = await query
  if (cmdErr) throw cmdErr

  // ✅ Filtre de sécurité côté front (accents/casse/espaces) pour éviter les cas tordus en base
  const wantedSecteurs = secteurs.map(norm)
  const wantedServices = (services || []).map(norm)

  const rawCommandes = (rawFromDb || []).filter((r: any) => {
    const secOk = wantedSecteurs.includes(norm(r?.secteur || ""))
    if (!secOk) return false

    // si aucun service sélectionné => on accepte tous les services (y compris null/"")
    if (!services || services.length === 0) return true

    // sinon service doit matcher
    return wantedServices.includes(norm(r?.service || ""))
  })

  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

  let logoImg: any
  try {
    const response = await fetch("/logo-adaptel.png")
    logoImg = await pdfDoc.embedPng(await response.arrayBuffer())
  } catch {
    console.warn("Logo non chargé")
  }

  const PAGE_W = 841.89
  const PAGE_H = 595.28
  const M_SIDE = 40
  const M_TOP = 30

  const secteurLabelUpper = secteurs.join(" - ").toUpperCase()
  const serviceLabelUpper = services.length ? services.join(" - ").toUpperCase() : ""
  const labelInfosUpper = `${secteurs.join(" - ")}${services.length ? " | " + services.join(" - ") : ""}`.toUpperCase()

  for (const dateISO of datesISO) {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H])

    // ==========================================
    // HEADER
    // ==========================================
    const headerH = 65
    const hTopY = PAGE_H - M_TOP
    const hBotY = hTopY - headerH

    const yLine1 = hTopY - 22
    const yLine2 = hBotY + 8
    const sizeL1 = 19
    const sizeL2 = 19

    if (logoImg) {
      const dims = logoImg.scaleToFit(160, headerH)
      page.drawImage(logoImg, {
        x: M_SIDE,
        y: hBotY + (headerH - dims.height) / 2,
        width: dims.width,
        height: dims.height,
      })
    }

    const sepX = M_SIDE + 175
    page.drawRectangle({ x: sepX, y: hBotY, width: 4, height: headerH, color: BRAND_RED })
    const leftX = sepX + 15

    const dateUpper = format(new Date(dateISO + "T00:00:00"), "EEEE dd MMMM yyyy", { locale: fr }).toUpperCase()

    const headerTitle = `FEUILLE DE POINTAGE | ${client}`.toUpperCase()
    page.drawText(headerTitle, {
      x: leftX,
      y: yLine1,
      size: sizeL1,
      font: fontBold,
      color: TEXT_DARK,
    })

    const line2 = `${labelInfosUpper} - ${dateUpper}`
    page.drawText(line2, {
      x: leftX,
      y: yLine2,
      size: sizeL2,
      font: fontBold,
      color: BRAND_RED,
    })

    page.drawLine({
      start: { x: M_SIDE, y: hBotY - 15 },
      end: { x: PAGE_W - M_SIDE, y: hBotY - 15 },
      thickness: 1,
      color: BORDER_COLOR,
    })

    // ==========================================
    // TABLEAU
    // ==========================================
    const tableTop = hBotY - 10
    const tableW = PAGE_W - M_SIDE * 2
    const col = { nom: tableW * 0.18, lbl: tableW * 0.05, hr: tableW * 0.09, sig: tableW * 0.205 }
    const xArr = M_SIDE + col.nom + col.lbl
    const xPau = xArr + col.hr
    const xDep = xPau + col.hr
    const xTot = xDep + col.hr
    const xSigI = xTot + col.hr
    const xSigR = xSigI + col.sig

    page.drawRectangle({ x: M_SIDE, y: tableTop - 32, width: tableW, height: 32, color: BRAND_RED })
    const hItems = [
      { t1: "NOM", t2: "PRÉNOM", x: M_SIDE, w: col.nom },
      { t1: "HEURE", t2: "ARRIVÉE", x: xArr, w: col.hr },
      { t1: "TEMPS", t2: "PAUSE", x: xPau, w: col.hr },
      { t1: "HEURE", t2: "DÉPART", x: xDep, w: col.hr },
      { t1: "TOTAL", t2: "HEURE", x: xTot, w: col.hr },
      { t1: "SIGNATURE", t2: "INTÉRIMAIRE", x: xSigI, w: col.sig },
      { t1: "SIGNATURE", t2: "RESPONSABLE", x: xSigR, w: col.sig },
    ]

    hItems.forEach((h) => {
      const s = 7.5
      page.drawText(h.t1, {
        x: h.x + (h.w - fontBold.widthOfTextAtSize(h.t1, s)) / 2,
        y: tableTop - 13,
        size: s,
        font: fontBold,
        color: rgb(1, 1, 1),
      })
      page.drawText(h.t2, {
        x: h.x + (h.w - fontBold.widthOfTextAtSize(h.t2, s)) / 2,
        y: tableTop - 25,
        size: s,
        font: fontBold,
        color: rgb(1, 1, 1),
      })
      if (h.x > M_SIDE) {
        page.drawLine({
          start: { x: h.x, y: tableTop },
          end: { x: h.x, y: tableTop - 32 },
          thickness: 1,
          color: rgb(1, 1, 1),
        })
      }
    })

    const rowH = 41
    const dayRows = (rawCommandes || []).filter((r: any) => r.date === dateISO).slice(0, 10)

    for (let i = 0; i < 10; i++) {
      const rY = tableTop - 32 - (i + 1) * rowH
      const data: any = dayRows[i]

      page.drawLine({
        start: { x: M_SIDE, y: rY },
        end: { x: PAGE_W - M_SIDE, y: rY },
        thickness: 0.5,
        color: BORDER_COLOR,
      })

      if (data?.candidats) {
        page.drawText(data.candidats.nom.toUpperCase(), { x: M_SIDE + 5, y: rY + 25, size: 11, font: fontBold, color: TEXT_DARK })
        page.drawText(data.candidats.prenom, { x: M_SIDE + 5, y: rY + 11, size: 11, font: fontBold, color: TEXT_DARK })
      }

      page.drawText("Prévue", { x: M_SIDE + col.nom + 4, y: rY + 30, size: 6.5, font: fontBold, color: TEXT_DARK })
      page.drawText("Réelle", { x: M_SIDE + col.nom + 4, y: rY + 16, size: 6.5, font: fontBold, color: TEXT_DARK })

      const tStart = normTime(data?.heure_debut_matin || data?.heure_debut_soir || data?.heure_debut_nuit)
      const tEnd = normTime(data?.heure_fin_matin || data?.heure_fin_soir || data?.heure_fin_nuit)
      const times = [tStart, data ? "00:30" : null, tEnd, tStart && tEnd ? calculateTotal(tStart, tEnd) : null]

      const hX = [xArr, xPau, xDep, xTot]
      hX.forEach((hx, idx) => {
        const vW = col.hr - 6
        const vH = 34
        const vX = hx + 3
        const vY = rY + 4

        page.drawRectangle({ x: vX, y: vY, width: vW, height: vH, borderColor: BORDER_COLOR, borderWidth: 1 })

        if (times[idx]) {
          page.drawRectangle({ x: vX + 0.5, y: vY + vH - 12, width: vW - 1, height: 11.5, color: BG_BANDEAU })
          page.drawLine({ start: { x: vX, y: vY + vH - 12 }, end: { x: vX + vW, y: vY + vH - 12 }, thickness: 1, color: BORDER_COLOR })
          page.drawText(times[idx]!, {
            x: vX + (vW - fontBold.widthOfTextAtSize(times[idx]!, 8)) / 2,
            y: vY + vH - 9,
            size: 8,
            font: fontBold,
            color: TEXT_DARK,
          })
        }
      })

      page.drawRectangle({ x: xSigI + 3, y: rY + 4, width: col.sig - 6, height: 34, borderColor: BORDER_COLOR, borderWidth: 1 })
      page.drawRectangle({ x: xSigR + 3, y: rY + 4, width: col.sig - 6, height: 34, borderColor: BORDER_COLOR, borderWidth: 1 })
    }

    page.drawLine({
      start: { x: M_SIDE, y: tableTop - 32 - 10 * rowH },
      end: { x: PAGE_W - M_SIDE, y: tableTop - 32 - 10 * rowH },
      thickness: 1,
      color: BORDER_COLOR,
    })

    // ==========================================
    // FOOTER
    // ==========================================
    const footerY = 18
    const footerLeft = `${client} ${labelInfosUpper}`.toUpperCase()
    page.drawText(footerLeft, { x: M_SIDE, y: footerY, size: 12, font: fontBold, color: TEXT_DARK })

    const dateBadgeText = dateUpper
    const dateBadgeSize = 11.5
    const dateBadgeTextW = fontBold.widthOfTextAtSize(dateBadgeText, dateBadgeSize)
    const dateBadgePadX = 10
    const dateBadgeH = 18
    const dateBadgeW = dateBadgeTextW + dateBadgePadX * 2
    const dateBadgeX = PAGE_W - M_SIDE - dateBadgeW
    const dateBadgeY = footerY - 2

    drawRoundedBadge(page, dateBadgeX, dateBadgeY, dateBadgeW, dateBadgeH, 4, BRAND_RED)

    page.drawText(dateBadgeText, {
      x: dateBadgeX + (dateBadgeW - dateBadgeTextW) / 2,
      y: dateBadgeY + (dateBadgeH - dateBadgeSize) / 2 + 1,
      size: dateBadgeSize,
      font: fontBold,
      color: rgb(1, 1, 1),
    })
  }

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url

  const fileLabel = `Feuille de pointage - ${client} ${secteurLabelUpper}${serviceLabelUpper ? " " + serviceLabelUpper : ""} - ${semaine}`
  a.download = `${fileLabel}.pdf`

  a.click()
  URL.revokeObjectURL(url)
}
