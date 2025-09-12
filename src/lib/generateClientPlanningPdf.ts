// src/lib/generateClientPlanningPdf.ts
// Génération PDF "Planning client" (A4 paysage, 1 page) — prototype visuel fidèle à la matrice.
// - En-tête : Logo ADAPTEL (placeholder), titre, logo client (placeholder)
// - Sous-titre : <CLIENT> – <SERVICE(S)>
// - Bandeau semaine + colonnes Jours (Jour, pastille couleur avec date, mois)
// - Lignes : 1 par candidat planifié (bandeau vert avec nom), créneaux dessous (matin/soir).
//   Les demandes "à pourvoir" sont listées sous les planifiés (orange/rouge selon statut).
// - Bloc “Contacts intérimaires planifiés”
// - Footer : coordonnées ADAPTEL + “Envoyé par …” + étiquette “ADAPTEL LYON – SEMAINE XX”
//
// Dépendances: jspdf, jspdf-autotable (autoTable n'est pas utilisé ici, layout full custom).
//
// NOTE: Logos réels seront intégrés plus tard (images). Ici placeholders (rectangles).

import jsPDF from "jspdf"

export type StatutCmd =
  | "Validé"
  | "En recherche"
  | "Non pourvue"
  | "Absence"
  | "Annule Client"
  | "Annule ADA"
  | "Annule Int"

export type JourISO = string // "yyyy-MM-dd"

export type CandidateMini = {
  id: string
  nom: string
  prenom?: string | null
  telephone?: string | null
}

export type CommandeMini = {
  id: string
  date: JourISO
  secteur: string
  service?: string | null
  statut: StatutCmd
  heure_debut_matin?: string | null
  heure_fin_matin?: string | null
  heure_debut_soir?: string | null
  heure_fin_soir?: string | null
  candidat?: CandidateMini | null // null = à pourvoir
}

export type ClientInfo = {
  id: string
  nom: string
  secteurDemande: string // "Cuisine" | "Salle" | "Plonge" | "Réception" | "Étages"
  services?: string[]
  semaine: number // ISO week
  libelleSemaine?: string // facultatif
}

export type DayHeader = { date: JourISO; label: string; dayName: string; dayNum: string; monthShort: string }

export type PlanningClientInput = {
  client: ClientInfo
  commandes: CommandeMini[] // déjà filtrées par CLIENT et SEMAINE
  daysHeaders: DayHeader[] // 7 jours contigus
  userName?: string // pour footer "Envoyé par ..."
}

// ————————————————— Visuel (couleurs/tailles)
const BRAND = {
  primary: [132, 4, 4] as [number, number, number], // #840404
  primaryDark: [117, 3, 3] as [number, number, number],
  green: [43, 160, 73] as [number, number, number],
  orange: [245, 158, 11] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  grayText: [70, 70, 70] as [number, number, number],
  lightBorder: [220, 220, 220] as [number, number, number],
}

// ————————————————— Helpers
const isEtages = (s: string) =>
  (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes("etages")

const sectorFilter = (clientSector: string) => {
  const wanted = new Set<string>([clientSector])
  if (clientSector === "Cuisine") wanted.add("Plonge") // règle métier
  return (x: string) => wanted.has(x)
}

const fmt = (a?: string | null, b?: string | null) => (a && b ? `${a.slice(0, 5)} → ${b.slice(0, 5)}` : "")

const fullName = (c?: CandidateMini | null) => (c ? `${c.nom}${c.prenom ? " " + c.prenom : ""}`.trim() : "")

const uc = (s: string) => (s || "").toLocaleUpperCase("fr-FR")

// Dessine texte centré dans un rect arrondi rempli (bandeau)
const filledLabel = (
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fillRGB: [number, number, number],
  text: string,
  fontSize = 9
) => {
  pdf.setFillColor(...fillRGB)
  ;(pdf as any).roundedRect(x, y, w, h, 4, 4, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(fontSize)
  pdf.text(text, x + w / 2, y + h / 2 + 3, { align: "center" })
}

// Dessine une pastille ronde
const circle = (pdf: jsPDF, cx: number, cy: number, r: number, fillRGB: [number, number, number]) => {
  pdf.setFillColor(...fillRGB)
  pdf.setDrawColor(...fillRGB)
  pdf.circle(cx, cy, r, "F")
}

// Statut → couleur/icone
const statusSpec = (statut: StatutCmd | "Planifié") => {
  if (statut === "Validé" || statut === "Planifié") return { color: BRAND.green, icon: "✓" }
  if (statut === "En recherche") return { color: BRAND.orange, icon: "!" }
  if (statut === "Absence" || statut === "Non pourvue" || statut === "Annule Client") return { color: BRAND.red, icon: "✕" }
  return { color: BRAND.grayText, icon: "?" }
}

// ————————————————— Core
export function generateClientPlanningPdf(input: PlanningClientInput) {
  const { client, commandes, daysHeaders, userName } = input
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })

  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const Mx = 28
  let y = 24

  // ——— HEADER ——————————————————————————
  // Logo ADAPTEL (placeholder)
  pdf.setFillColor(...BRAND.primary)
  pdf.rect(Mx, y, 95, 36, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(11)
  pdf.text("ADAPTEL", Mx + 16, y + 23)

  // Titre central
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(14)
  pdf.text(`Planning de confirmation ${client.secteurDemande}`, W / 2, y + 20, { align: "center" })

  // Logo Client (placeholder)
  const logoW = 110
  pdf.setFillColor(60, 60, 60)
  pdf.rect(W - Mx - logoW, y, logoW, 36, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(10)
  pdf.text("LOGO CLIENT", W - Mx - logoW / 2, y + 22, { align: "center" })

  y += 48

  // Ligne Client – Services
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(11)
  const servicesStr = (client.services && client.services.length) ? ` – ${client.services.join(", ")}` : ""
  pdf.text(`${client.nom}${servicesStr}`, Mx, y)
  y += 8

  // Semaine (numéro seul)
  pdf.setTextColor(100)
  pdf.setFontSize(10)
  pdf.text(`Semaine ${client.semaine}`, Mx, y)
  y += 12

  // ——— GRID PARAMS ————————————————————
  const COL_LEFT_W = 230 // Colonne info (icône, secteur, nom, statut)
  const COLS_DAYS = 7
  const gapX = 4
  const gridX = Mx
  const gridY = y
  const gridW = W - Mx * 2
  const dayColW = (gridW - COL_LEFT_W - gapX * COLS_DAYS) / COLS_DAYS
  const ROW_H = 42 // hauteur ligne
  const MAX_ROWS = 12 // trame fixe pour occuper la page (adapter si besoin)

  // ——— EN-TÊTE COLONNES —————————————————
  // Colonne "SEMAINE XX"
  pdf.setFontSize(12)
  pdf.setTextColor(0, 0, 0)
  filledLabel(pdf, gridX, gridY, COL_LEFT_W, 36, BRAND.primary, `SEMAINE ${client.semaine}`, 11)

  // Colonnes Jours
  for (let i = 0; i < COLS_DAYS; i++) {
    const colX = gridX + COL_LEFT_W + gapX * (i + 1) + dayColW * i
    const headY = gridY
    // Jour (ex: Lundi)
    pdf.setFontSize(9)
    pdf.setTextColor(0, 0, 0)
    pdf.text(daysHeaders[i].dayName, colX + dayColW / 2, headY + 12, { align: "center" })
    // Pastille date
    circle(pdf, colX + dayColW / 2, headY + 24, 10, BRAND.primary)
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(10)
    pdf.text(daysHeaders[i].dayNum, colX + dayColW / 2, headY + 27, { align: "center" })
    // Mois
    pdf.setTextColor(80)
    pdf.setFontSize(8)
    pdf.text(daysHeaders[i].monthShort, colX + dayColW / 2, headY + 38, { align: "center" })
  }

  // Séparateur
  pdf.setDrawColor(...BRAND.lightBorder)
  pdf.line(gridX, gridY + 44, gridX + gridW, gridY + 44)

  // ——— PRÉPARATION DONNÉES LIGNES —————————
  const keepSector = sectorFilter(client.secteurDemande)
  const exclude = new Set<StatutCmd>(["Annule ADA", "Annule Int"])
  const isPending = (s: StatutCmd) =>
    s === "En recherche" || s === "Non pourvue" || s === "Absence" || s === "Annule Client"

  const filtered = commandes.filter((c) => keepSector(c.secteur))

  // Groupe par candidat planifié
  const byCandidate = new Map<string, CommandeMini[]>()
  const pendings: CommandeMini[] = []
  for (const c of filtered) {
    if (exclude.has(c.statut)) continue
    if (c.candidat && c.statut === "Validé") {
      const key = c.candidat.id
      if (!byCandidate.has(key)) byCandidate.set(key, [])
      byCandidate.get(key)!.push(c)
    } else if (isPending(c.statut)) {
      pendings.push(c)
    }
  }
  const sortForDisplay = (a: CommandeMini, b: CommandeMini) => {
    const aM = !!(a.heure_debut_matin && a.heure_fin_matin)
    const bM = !!(b.heure_debut_matin && b.heure_fin_matin)
    if (aM !== bM) return aM ? -1 : 1
    return (a.service || "").localeCompare(b.service || "")
  }
  for (const [, arr] of byCandidate) arr.sort(sortForDisplay)
  pendings.sort((a, b) => (a.date < b.date ? -1 : 1))

  // Compose lignes (planifiés d’abord)
  type RowModel = {
    type: "planned" | "pending" | "empty"
    secteur: string
    labelLeft: { top: string; mid: string; bot: string; status: "Planifié" | StatutCmd }
    cells: { date: JourISO; name?: string; slots?: string[]; status?: "Planifié" | "En recherche" | "Absence" | "Non pourvue" | "Annule Client" }[]
  }

  const rows: RowModel[] = []
  const etages = isEtages(client.secteurDemande)

  // Planifiés
  for (const [, arr] of byCandidate) {
    const c = arr[0].candidat!
    const left = {
      top: client.secteurDemande.toUpperCase(),
      mid: uc(c.nom),
      bot: (c.prenom || "").trim(),
      status: "Planifié" as const,
    }
    const cells = daysHeaders.map((d) => {
      const duJour = arr.filter((x) => x.date === d.date)
      if (!duJour.length) return { date: d.date }
      let name = fullName(c)
      let slots: string[] = []
      if (etages) {
        const m = fmt(duJour[0].heure_debut_matin, duJour[0].heure_fin_matin)
        if (m) slots.push(m)
      } else {
        const m = fmt(duJour[0].heure_debut_matin, duJour[0].heure_fin_matin)
        const s = fmt(duJour[0].heure_debut_soir, duJour[0].heure_fin_soir)
        if (m) slots.push(m)
        if (s) slots.push(s)
      }
      return { date: d.date, name, slots, status: "Planifié" as const }
    })
    rows.push({ type: "planned", secteur: client.secteurDemande, labelLeft: left, cells })
  }

  // À pourvoir (agrégées par service|secteur)
  const pMap = new Map<string, CommandeMini[]>()
  const keyOf = (c: CommandeMini) => `${c.service || "-"}|${c.secteur}`
  for (const p of pendings) {
    const k = keyOf(p)
    if (!pMap.has(k)) pMap.set(k, [])
    pMap.get(k)!.push(p)
  }
  for (const [k, arr] of pMap) {
    arr.sort(sortForDisplay)
    const [service, secteur] = k.split("|")
    const left = {
      top: secteur.toUpperCase(),
      mid: service !== "-" ? uc(service) : "SANS SERVICE",
      bot: "À POURVOIR",
      status: (arr[0].statut as "En recherche" | "Non pourvue" | "Absence" | "Annule Client") ?? "En recherche",
    }
    const cells = daysHeaders.map((d) => {
      const duJour = arr.filter((x) => x.date === d.date)
      if (!duJour.length) return { date: d.date }
      // Indicateur “M”/“S” pour besoin
      const haveM = duJour.some((x) => x.heure_debut_matin && x.heure_fin_matin)
      const haveS = duJour.some((x) => x.heure_debut_soir && x.heure_fin_soir)
      const band = `${haveM ? "M" : ""}${haveM && haveS ? " " : ""}${haveS ? "S" : ""}`.trim()
      return { date: d.date, name: band || undefined, slots: [], status: left.status }
    })
    rows.push({ type: "pending", secteur, labelLeft: left, cells })
  }

  // Complète jusqu’à MAX_ROWS pour une trame pleine page
  while (rows.length < MAX_ROWS) {
    rows.push({
      type: "empty",
      secteur: client.secteurDemande,
      labelLeft: { top: "", mid: "", bot: "", status: "En recherche" },
      cells: daysHeaders.map((d) => ({ date: d.date })),
    })
  }
  // Limite à MAX_ROWS (si trop de lignes)
  rows.splice(MAX_ROWS)

  // ——— Rendu des lignes ——————————————————
  let rowY = gridY + 50
  for (const r of rows) {
    // Colonne gauche (icône secteur + textes + icône statut)
    const leftX = gridX
    const leftW = COL_LEFT_W
    // icône secteur (placeholder carré)
    pdf.setFillColor(240, 240, 240)
    pdf.rect(leftX, rowY + 5, 24, 24, "F")
    pdf.setTextColor(120)
    pdf.setFontSize(9)
    pdf.text(r.secteur.slice(0, 1), leftX + 12, rowY + 21, { align: "center" })

    // textes
    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(9)
    pdf.text(r.labelLeft.top, leftX + 32, rowY + 13)
    pdf.setFontSize(10)
    pdf.text(r.labelLeft.mid, leftX + 32, rowY + 26)
    pdf.setTextColor(100)
    pdf.setFontSize(9)
    if (r.labelLeft.bot) pdf.text(r.labelLeft.bot, leftX + 32, rowY + 38)

    // statut icon à droite de la colonne gauche
    const spec = statusSpec(r.labelLeft.status === "Planifié" ? "Validé" : r.labelLeft.status)
    pdf.setFillColor(...spec.color)
    pdf.circle(leftX + leftW - 14, rowY + 20, 9, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(10)
    pdf.text(spec.icon, leftX + leftW - 14, rowY + 23, { align: "center" })

    // Colonnes 7 jours
    for (let i = 0; i < COLS_DAYS; i++) {
      const colX = gridX + COL_LEFT_W + gapX * (i + 1) + dayColW * i
      const cell = r.cells[i]
      // Fond/contour cellule
      pdf.setDrawColor(...BRAND.lightBorder)
      pdf.rect(colX, rowY, dayColW, ROW_H)

      if (cell?.name || (cell?.slots && cell.slots.length)) {
        // Bandeau statut
        const st = r.type === "planned" ? "Planifié" : cell.status || "En recherche"
        const { color } = statusSpec(st as any)
        filledLabel(pdf, colX + 3, rowY + 3, dayColW - 6, 16, color, (cell.name || "").toString(), 8)

        // Créneaux
        pdf.setTextColor(60)
        pdf.setFontSize(8)
        if (cell.slots && cell.slots.length) {
          const lines = cell.slots.slice(0, 2) // matin puis soir
          for (let li = 0; li < lines.length; li++) {
            pdf.text(lines[li], colX + dayColW / 2, rowY + 24 + li * 11, { align: "center" })
          }
        }
      }
    }

    rowY += ROW_H + 4
  }

  // ——— Contacts planifiés ——————————————————
  const plannedCandidates = Array.from(byCandidate.values()).flatMap((arr) =>
    arr[0].candidat ? [arr[0].candidat!] : []
  )
  if (plannedCandidates.length) {
    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    pdf.text("Contacts intérimaires planifiés", Mx, rowY + 6)
    pdf.setFontSize(8)
    pdf.setTextColor(60, 60, 60)
    const items = plannedCandidates.map(
      (c) => `• ${fullName(c)}${c.telephone ? " — " + c.telephone : ""}`
    )
    const text = items.join("   ")
    const maxW = W - Mx * 2
    const lines = pdf.splitTextToSize(text, maxW)
    pdf.text(lines, Mx, rowY + 20)
  }

  // ——— FOOTER ——————————————————————————————
  const footerY = H - 42

  // Bloc gauche (coordonnées)
  // Téléphone (cercle + icône ascii)
  pdf.setFillColor(240, 240, 240)
  pdf.circle(Mx + 10, footerY - 8, 10, "F")
  pdf.setTextColor(90)
  pdf.setFontSize(10)
  pdf.text("☎", Mx + 10, footerY - 5, { align: "center" })
  // Textes
  pdf.setTextColor(60)
  pdf.setFontSize(8)
  pdf.text("Mail : commandes@adaptel-lyon.fr", Mx + 26, footerY - 14)
  pdf.text("Tel : 04 37 65 25 90", Mx + 26, footerY - 2)
  pdf.text("SMS/Whatsapp : 06 09 22 00 80", Mx + 150, footerY - 2)

  // Bloc centre (info)
  pdf.setFillColor(240, 240, 240)
  pdf.circle(W / 2, footerY - 8, 10, "F")
  pdf.setTextColor(90)
  pdf.setFontSize(10)
  pdf.text("ℹ", W / 2, footerY - 5, { align: "center" })
  pdf.setTextColor(60)
  pdf.setFontSize(8)
  const sentBy = userName ? `Envoyé par ${userName}` : "Envoyé par Utilisateur test"
  const sentAt = `Version du : ${new Date().toLocaleString()}`
  pdf.text(sentBy, W / 2 + 18, footerY - 14)
  pdf.text(sentAt, W / 2 + 18, footerY - 2)

  // Bloc droite (étiquette ADAPTEL LYON – SEMAINE XX)
  const tagW = 220
  const tagH = 24
  const tagX = W - Mx - tagW
  const tagY = footerY - tagH - 4
  pdf.setFillColor(...BRAND.primary)
  ;(pdf as any).roundedRect(tagX, tagY, tagW, tagH, 6, 6, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(10)
  pdf.text(`ADAPTEL LYON — SEMAINE ${client.semaine}`, tagX + tagW / 2, tagY + tagH / 2 + 3, {
    align: "center",
  })

  // Export
  const fnSafe = `${client.nom.replace(/[^a-z0-9-_]+/gi, "_")}_S${client.semaine}_${client.secteurDemande}.pdf`
  pdf.save(fnSafe)
}
