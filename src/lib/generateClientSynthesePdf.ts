// src/lib/generateClientPlanningPdf.ts

import jsPDF from "jspdf"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import html2canvas from "html2canvas"

/* ------------------------------- Types PDF ------------------------------- */
export type DayHeader = {
  date: string
  label: string
  dayName: string
  dayNum: string
  monthShort: string
}

export type CommandeCell = {
  statut: string
  candidat?: { nom: string; prenom: string } | null
  heure_debut_matin: string | null
  heure_fin_matin: string | null
  heure_debut_soir: string | null
  heure_fin_soir: string | null
}

export type ClientPlanningRow = {
  secteur: string
  service: string | null
  poste: string
  candidatTel?: string | null
  label: string
  totalMinutes: number
  days: CommandeCell[][]
}

export type ClientPlanningInput = {
  client: { id: string; nom: string; logoUrl?: string | null }
  secteurSelection: string
  semaine: number
  daysHeaders: DayHeader[]
  userName: string
  rows: ClientPlanningRow[]
  services?: string[]
  layout?: "short" | "long"
}

/* ---------------------------- Helpers ---------------------------- */
const BRAND_COLOR = "#000000"
const DEFAULT_LOGO = "/logo-adaptel2.png"

const escapeHtml = (v: any) => {
  const s = String(v ?? "")
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/* ---------------------------- Generate HTML (HEADER ONLY) ---------------------------- */
function generateHeaderOnlyHTML(input: ClientPlanningInput): string {
  const layout = input.layout ?? "short"
  const isShort = layout === "short"

  // Format date "Jeudi 18 décembre - 15:30"
  const now = new Date()
  const v = format(now, "EEEE d MMMM - HH:mm", { locale: fr })
  const versionDu = escapeHtml(v.charAt(0).toUpperCase() + v.slice(1))

  // Prénom seulement
  const rawUser = String(input.userName || "Utilisateur").trim()
  const prenom = escapeHtml(rawUser.split(/\s+/)[0] || "Utilisateur")

  const clientNom = escapeHtml(input.client.nom || "Client")
  const secteur = escapeHtml(input.secteurSelection || "")
  const semaine = escapeHtml(input.semaine)
  const logoSrc = escapeHtml(input.client.logoUrl || DEFAULT_LOGO)

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Planning de Confirmation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: Arial, sans-serif;
      width: 297mm;
      height: 210mm;
      padding: 20mm 25mm;
      background: white;
    }

    .header-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #333;
    }

    /* Logo - GRAND et bien placé */
    .logo-container {
      width: 120px;
      height: 120px;
      flex-shrink: 0;
    }

    .logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    /* Titres centrés */
    .title-container {
      flex: 1;
      text-align: center;
      padding: 0 30px;
    }

    .main-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
      color: #000;
    }

    .client-name {
      font-size: 22px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #000;
    }

    .secteur-week {
      font-size: 18px;
      color: #333;
    }

    /* Informations droite */
    .info-container {
      width: 200px;
      flex-shrink: 0;
      text-align: right;
    }

    .info-line {
      font-size: 14px;
      margin-bottom: 8px;
      color: #333;
    }

    .info-label {
      font-weight: bold;
      display: block;
      margin-bottom: 2px;
    }

    /* Zone preview */
    .preview-area {
      height: 100mm;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px dashed #ccc;
      margin-top: 20px;
    }

    .preview-text {
      font-size: 16px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header-container">
    <!-- Logo (120px - grand et visible) -->
    <div class="logo-container">
      <img class="logo" src="${logoSrc}" alt="Logo" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'font-size:24px; font-weight:bold; display:flex; align-items:center; justify-content:center; width:100%; height:100%;\\'>ADAPTEL</div>';" />
    </div>

    <!-- Titres centrés -->
    <div class="title-container">
      <div class="main-title">PLANNING DE CONFIRMATION</div>
      <div class="client-name">${clientNom.toUpperCase()}</div>
      <div class="secteur-week">${secteur.toUpperCase()} - SEMAINE ${semaine}</div>
    </div>

    <!-- Informations droite -->
    <div class="info-container">
      <div class="info-line">
        <div class="info-label">Version du :</div>
        <div>${versionDu}</div>
      </div>
      <div class="info-line">
        <div class="info-label">Envoyé par :</div>
        <div>${prenom}</div>
      </div>
    </div>
  </div>

  <!-- Zone preview -->
  <div class="preview-area">
    <div class="preview-text">Planning - 8 lignes</div>
  </div>
</body>
</html>`
}

/* ---------------------------- Generate PDF ---------------------------- */
export async function generateClientPlanningPdf(input: ClientPlanningInput): Promise<void> {
  const layout = input.layout ?? "short"
  const isShort = layout === "short"

  const html = generateHeaderOnlyHTML(input)

  const container = document.createElement("div")
  container.innerHTML = html
  container.style.position = "fixed"
  container.style.left = "-99999px"
  container.style.top = "0"
  container.style.background = "white"

  if (isShort) {
    container.style.width = "297mm"
    container.style.height = "210mm"
  } else {
    container.style.width = "210mm"
    container.style.height = "297mm"
  }

  document.body.appendChild(container)

  await new Promise((r) => setTimeout(r, 500))

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "white",
      logging: false,
      windowWidth: isShort ? 1122 : 794,
      windowHeight: isShort ? 794 : 1122,
    })

    const doc = new jsPDF({
      orientation: isShort ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
    })

    const imgData = canvas.toDataURL("image/png", 1.0)
    const pageWidth = isShort ? 297 : 210
    const pageHeight = isShort ? 210 : 297

    doc.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight)

    const safeClient = (input.client.nom || "Client")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")

    const fileName = `Planning_${safeClient}_Sem${input.semaine}.pdf`
    doc.save(fileName)
  } catch (error) {
    console.error("Erreur génération PDF:", error)
    throw error
  } finally {
    if (container.parentNode) document.body.removeChild(container)
  }
}