// src/components/PlanningClientExportDialog.tsx
import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addDays, format, startOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { Check } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { secteursList as secteursListRaw } from "@/lib/secteurs"
import { useAuth } from "@/contexts/auth-context"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

/* ------------------------------- Types ------------------------------- */
type DayHeader = {
  date: string
  label: string
  dayName: string
  dayNum: string
  monthShort: string
}

type CommandeRow = {
  id: string
  date: string
  secteur: string | null
  service: string | null
  statut: string
  heure_debut_matin: string | null
  heure_fin_matin: string | null
  heure_debut_soir: string | null
  heure_fin_soir: string | null
  candidat: { id: string; nom: string; prenom: string } | null
}

type ClientRow = { id: string; nom: string; services: string[] }
type SemaineOption = { value: string; label: string }

type PdfCell = {
  statut: string
  candidat?: { nom: string; prenom: string } | null
  hMatin?: string
  hSoir?: string
}

type PdfRow = {
  secteurCode: string
  secteurLabel: string
  service: string | null
  label: string
  totalMinutes: number
  days: PdfCell[][]
}

/* ---------------------------- Couleurs de l'app ---------------------------- */
const STATUT_BG: Record<string, string> = {
  "Validé": "#a9d08e",
  "En recherche": "#fdba74",
  "Non pourvue": "#ef5350",
  "Absence": "#f87171",
  "Annule Int": "#fef3c7",
  "Annule Client": "#fef3c7",
  "Annule ADA": "#d4d4d8",
  "": "#e5e7eb",
}

const STATUT_TEXT: Record<string, string> = {
  "Validé": "#000000",
  "En recherche": "#ffffff",
  "Non pourvue": "#ffffff",
  "Absence": "#ffffff",
  "Annule Int": "#1f2937",
  "Annule Client": "#1f2937",
  "Annule ADA": "#1f2937",
  "": "#6b7280",
}

const SECTEUR_COLORS: Record<string, string> = {
  "Étages": "#d8b4fe",
  "Cuisine": "#bfdbfe",
  "Salle": "#fcd5b5",
  "Plonge": "#e5e7eb",
  "Réception": "#fef9c3",
}

/* ---------------------------- Utils ---------------------------- */
const labelToCode: Record<string, string> = {
  "Cuisine": "cuisine",
  "Salle": "salle",
  "Plonge": "plonge",
  "Réception": "reception",
  "Étages": "etages",
}

function codeToLabel(code: string) {
  const e = Object.entries(labelToCode).find(([, v]) => v === code)
  return e ? e[0] : code
}

function getWeekMeta(mondayISO: string) {
  const monday = new Date(mondayISO)
  const nextMonday = addDays(monday, 7)
  return {
    weekNum: Number(format(monday, "I", { locale: fr })),
    monday,
    nextMonday,
    days: Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
  }
}

const cutHM = (s: string | null) => (s && s.length >= 5 ? s.slice(0, 5) : null)

function parseHM(s: string | null): number | null {
  const v = cutHM(s)
  if (!v) return null
  const m = /^(\d{2}):(\d{2})$/.exec(v)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function diffMin(d: string | null, f: string | null) {
  const a = parseHM(d), b = parseHM(f)
  if (a == null || b == null) return 0
  return Math.max(0, b - a)
}

function minToHHMM(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function sectorInitials(labelOrCode: string) {
  const s = (labelOrCode || "").toLowerCase()
  if (s.startsWith("cuisine")) return "CU"
  if (s.startsWith("salle")) return "SA"
  if (s.startsWith("plonge")) return "PL"
  if (s.startsWith("réception") || s.startsWith("reception")) return "RE"
  if (s.startsWith("étages") || s.startsWith("etages")) return "ET"
  return "SE"
}

function hexToRGB(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

/* ---------------------------- PDF (vignettes) ---------------------------- */
function buildPlanningPDF(args: {
  fileName: string
  clientNom: string
  secteurLabel: string
  services: string[]
  semaine: number
  userName: string
  daysHeaders: DayHeader[]
  rows: PdfRow[]
}) {
  const { fileName, clientNom, secteurLabel, services, semaine, userName, daysHeaders, rows } = args

  const doc = new jsPDF({ orientation: "l", unit: "pt", format: "a4" })
  const page = doc.internal.pageSize
  const W = page.getWidth()
  const H = page.getHeight()
  const Mx = 32
  const MyTop = 36
  const MyBottom = 40

  /* ==================== EN-TÊTE ==================== */
  // Fond header
  doc.setFillColor("#f9fafb")
  doc.rect(0, 0, W, MyTop + 60, "F")

  // Logo ADAPTEL (rectangle rouge pour l'instant, on ajoutera l'image plus tard)
  doc.setFillColor("#840404")
  doc.roundedRect(Mx, MyTop - 4, 140, 32, 4, 4, "F")
  doc.setTextColor("#ffffff")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text("ADAPTEL LYON", Mx + 70, MyTop + 16, { align: "center" })

  // Titre principal
  doc.setTextColor("#111827")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.text("CONFIRMATION DE PLANNING", W / 2, MyTop + 8, { align: "center" })

  // Sous-titre : Client - Secteur - Service - Semaine
  doc.setFont("helvetica", "normal")
  doc.setFontSize(12)
  doc.setTextColor("#4b5563")
  const svc = services.length > 0 ? ` — ${services.join(" / ")}` : ""
  doc.text(`${clientNom} — ${secteurLabel}${svc} — Semaine ${semaine}`, W / 2, MyTop + 28, { align: "center" })

  // Ligne de séparation
  doc.setDrawColor("#e5e7eb")
  doc.setLineWidth(1)
  doc.line(Mx, MyTop + 46, W - Mx, MyTop + 46)

  /* ==================== TABLEAU ==================== */
  const startY = MyTop + 56
  const firstColW = 200
  const usableW = W - Mx * 2 - firstColW
  const dayColW = usableW / 7

  let FONT = 9
  let CARD_H = 44
  let CARD_RADIUS = 5
  let PAD = 5

  // Estimation hauteur pour ajustement si nécessaire
  const estimateTotalHeight = () => {
    const rowsH = rows.map(r => {
      const maxPerDay = Math.max(1, ...r.days.map(list => list.length || 0))
      return PAD * 2 + (CARD_H * maxPerDay) + (3 * (maxPerDay - 1))
    }).reduce((a, b) => a + b, 0)
    return startY + rowsH + MyBottom
  }

  const available = H - MyBottom
  let total = estimateTotalHeight()
  if (total > H) {
    const ratio = Math.max(0.65, available / total)
    FONT = FONT * ratio
    CARD_H = Math.max(36, CARD_H * ratio)
    CARD_RADIUS = Math.max(3, CARD_RADIUS * ratio)
    PAD = Math.max(3, PAD * ratio)
  }

  // En-têtes colonnes
  const head = [[
    { content: "Candidat", styles: { halign: "left" as const, fontStyle: "bold" } },
    ...daysHeaders.map(d => ({
      content: `${d.dayName.substring(0, 3)}. ${d.dayNum}`,
      styles: { halign: "center" as const, fontStyle: "bold" }
    })),
  ]]

  // Body vide (on dessine dans didDrawCell)
  const body = rows.map(() => new Array(8).fill(""))

  autoTable(doc, {
    startY,
    head,
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: FONT,
      cellPadding: PAD,
      valign: "top",
      lineColor: [229, 231, 235],
      lineWidth: 0.8,
    } as any,
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      minCellHeight: 28,
    },
    columnStyles: {
      0: { cellWidth: firstColW },
      1: { cellWidth: dayColW }, 2: { cellWidth: dayColW }, 3: { cellWidth: dayColW },
      4: { cellWidth: dayColW }, 5: { cellWidth: dayColW }, 6: { cellWidth: dayColW }, 7: { cellWidth: dayColW },
    } as any,
    margin: { left: Mx, right: Mx, top: 0, bottom: MyBottom },
    didParseCell: (data: any) => {
      if (data.section === "body") {
        const r = rows[data.row.index]
        const maxPerDay = Math.max(1, ...r.days.map(list => list.length || 0))
        const h = PAD * 2 + (CARD_H * maxPerDay) + (3 * (maxPerDay - 1))
        data.cell.styles.minCellHeight = h
      }
    },
    didDrawCell: (data: any) => {
      const { cell, column, row, section } = data
      if (section !== "body") return

      const r: PdfRow = rows[row.index]

      if (column.index === 0) {
        // Colonne 1 : Pastille secteur + Nom candidat + Total heures
        const x = cell.x + 8
        let y = cell.y + 10

        // Pastille secteur avec couleur de l'app
        const secteurColor = SECTEUR_COLORS[r.secteurLabel] || "#e5e7eb"
        const [sr, sg, sb] = hexToRGB(secteurColor)
        doc.setFillColor(sr, sg, sb)
        doc.circle(x + 8, y + 6, 8, "F")
        doc.setTextColor("#374151")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(Math.max(7, FONT - 1))
        doc.text(sectorInitials(r.secteurCode), x + 8, y + 9, { align: "center" })

        // Service (si existe)
        const sx = x + 22
        if (r.service) {
          doc.setTextColor("#111827")
          doc.setFont("helvetica", "bold")
          doc.setFontSize(Math.max(9, FONT))
          doc.text(r.service, sx, y + 4)
          y += 14
        }

        // Nom - Prénom candidat
        doc.setTextColor("#111827")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(Math.max(10, FONT + 1))
        doc.text(r.label, sx, y + 4)
        y += 16

        // Total heures
        doc.setFont("helvetica", "bold")
        doc.setFontSize(Math.max(9, FONT))
        doc.setTextColor("#840404")
        doc.text(`Total: ${minToHHMM(r.totalMinutes)}`, sx, y + 4)
        return
      }

      // Colonnes jours : vignettes statut/candidat
      const dayIdx = column.index - 1
      const list = r.days[dayIdx] || []
      if (!list.length) return

      const x0 = cell.x + PAD
      let y0 = cell.y + PAD
      const w = cell.width - PAD * 2

      for (let i = 0; i < list.length; i++) {
        const c = list[i]
        const bg = STATUT_BG[c.statut] || STATUT_BG[""]
        const fg = STATUT_TEXT[c.statut] || STATUT_TEXT[""]

        // Fond vignette avec couleurs de l'app
        const [bgR, bgG, bgB] = hexToRGB(bg)
        doc.setFillColor(bgR, bgG, bgB)
        doc.roundedRect(x0, y0, w, CARD_H, CARD_RADIUS, CARD_RADIUS, "F")

        // Texte vignette
        const [fgR, fgG, fgB] = hexToRGB(fg)
        doc.setTextColor(fgR, fgG, fgB)

        if (c.statut === "Validé" && c.candidat) {
          doc.setFont("helvetica", "bold")
          doc.setFontSize(FONT + 1.5)
          doc.text(c.candidat.nom, x0 + 4, y0 + 12)
          doc.setFont("helvetica", "normal")
          doc.setFontSize(FONT + 0.5)
          doc.text(c.candidat.prenom, x0 + 4, y0 + 24)
        } else {
          doc.setFont("helvetica", "bold")
          doc.setFontSize(FONT + 1)
          doc.text(c.statut || "—", x0 + 4, y0 + 16)
        }

        // Heures
        doc.setFont("helvetica", "bold")
        doc.setFontSize(FONT)
        let yy = y0 + 36
        if (c.hMatin) {
          doc.text(c.hMatin, x0 + 4, yy)
          yy += 10
        }
        if (c.hSoir) {
          doc.text(c.hSoir, x0 + 4, yy)
        }

        y0 += CARD_H + 3
        if (y0 > cell.y + cell.height - CARD_H) break
      }
    },
    didDrawPage: () => {
      // Pied de page
      const y = H - MyBottom + 12
      doc.setDrawColor("#e5e7eb")
      doc.line(Mx, y, W - Mx, y)

      doc.setTextColor("#6b7280")
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.text(`Généré par : ${userName}`, Mx, y + 14)
      doc.text(`${format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}`, W / 2, y + 14, { align: "center" })

      // Badge ADAPTEL
      doc.setFillColor("#840404")
      const bw = 160, bh = 20
      doc.roundedRect(W - Mx - bw, y + 6, bw, bh, 4, 4, "F")
      doc.setTextColor("#ffffff")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.text(`ADAPTEL LYON — S${semaine}`, W - Mx - bw / 2, y + 20, { align: "center" })
    },
  })

  doc.save(fileName)
}

/* ------------------------------- Composant ------------------------------- */
export default function PlanningClientExportDialog() {
  const [open, setOpen] = useState(false)

  const [secteurLabel, setSecteurLabel] = useState("Cuisine")
  const [semaineISO, setSemaineISO] = useState(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    return format(monday, "yyyy-MM-dd")
  })

  const [clients, setClients] = useState<ClientRow[]>([])
  const [clientSearch, setClientSearch] = useState("")
  const [selectedClientId, setSelectedClientId] = useState("")
  const [availableServices, setAvailableServices] = useState<string[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])

  const { user } = useAuth() as any
  const userDisplayName = user?.email || "Utilisateur ADAPTEL"

  const semaines: SemaineOption[] = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 10 }, (_, i) => {
      const monday = addDays(base, i * 7)
      const iso = format(monday, "yyyy-MM-dd")
      return {
        value: iso,
        label: `Semaine ${format(monday, "I")} — ${format(monday, "dd/MM")} → ${format(addDays(monday, 6), "dd/MM")}`,
      }
    })
  }, [])

  // Clients filtrés par secteur
  useEffect(() => {
    const load = async () => {
      const selCode = labelToCode[secteurLabel] || ""
      const pair = selCode === "cuisine" || selCode === "plonge"

      const { data, error } = await supabase
        .from("clients")
        .select("id, nom, services, secteurs, actif")
        .eq("actif", true)
        .order("nom")

      if (error) {
        console.error(error)
        setClients([])
        return
      }

      const filtered = (data || []).filter((c: any) => {
        const secteurs: string[] = Array.isArray(c.secteurs)
          ? c.secteurs
          : typeof c.secteurs === "string"
            ? c.secteurs.split(",").map((s: string) => s.trim())
            : []
        if (pair) return secteurs.some(s => /^(cuisine|plonge)$/i.test(s))
        return selCode ? secteurs.some(s => s === selCode || s === codeToLabel(selCode)) : true
      })

      const normalized: ClientRow[] = filtered.map((c: any) => {
        const raw = c.services
        const services: string[] = Array.isArray(raw)
          ? raw
          : typeof raw === "string"
            ? raw.split(",").map((s: string) => s.trim()).filter(Boolean)
            : []
        return { id: String(c.id), nom: String(c.nom || ""), services }
      })

      setClients(normalized)
      setSelectedClientId("")
      setAvailableServices([])
      setSelectedServices([])
    }
    load()
  }, [secteurLabel])

  useEffect(() => {
    const row = clients.find((c) => c.id === selectedClientId)
    const list = row?.services || []
    setAvailableServices(list)
    setSelectedServices((prev) => prev.filter((s) => list.includes(s)))
  }, [selectedClientId, clients])

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.nom.toLowerCase().includes(q))
  }, [clientSearch, clients])

  /* ------------------- Chargement commandes ------------------- */
  const fetchClientPlanning = async (): Promise<CommandeRow[]> => {
    if (!selectedClientId) return []
    const { monday, nextMonday } = getWeekMeta(semaineISO)
    const mondayISO = format(monday, "yyyy-MM-dd")
    const sunday = addDays(nextMonday, -1)
    const sundayISO = format(sunday, "yyyy-MM-dd")

    console.log("📅 Génération PDF pour:", {
      client: selectedClientId,
      secteur: secteurLabel,
      semaine: semaineISO,
      dateRange: `${mondayISO} → ${sundayISO}`
    })

    const selCode = labelToCode[secteurLabel] || ""
    const label = codeToLabel(selCode)

    // ✅ Construction requête EXACTEMENT comme dans Commandes.tsx
    let query = supabase
      .from("commandes")
      .select(`
        id, date, statut, secteur, service, mission_slot, client_id, candidat_id,
        heure_debut_matin, heure_fin_matin,
        heure_debut_soir, heure_fin_soir,
        heure_debut_nuit, heure_fin_nuit,
        commentaire, created_at, updated_at,
        motif_contrat, complement_motif,
        candidats (id, nom, prenom),
        clients (nom)
      `)
      .eq("client_id", selectedClientId)
      .gte("date", mondayISO)
      .lte("date", sundayISO)

    // ✅ Filtre secteur avec .in() comme dans Commandes.tsx
    if (selCode === "cuisine" || selCode === "plonge") {
      query = query.in("secteur", ["cuisine", "Cuisine", "plonge", "Plonge"])
    } else if (selCode) {
      query = query.in("secteur", [selCode, label])
    }

    query = query
      .neq("statut", "Annule ADA")
      .order("date", { ascending: true })

    const { data, error } = await query
    if (error) {
      console.error("❌ Erreur Supabase:", error)
      return []
    }

    console.log("✅ Données récupérées:", data?.length, "commandes")

    let rows: CommandeRow[] = (data || []).map((r: any) => ({
      id: String(r.id),
      date: r.date,
      secteur: r.secteur ?? null,
      service: r.service ?? null,
      statut: r.statut ?? "",
      heure_debut_matin: r.heure_debut_matin ?? null,
      heure_fin_matin: r.heure_fin_matin ?? null,
      heure_debut_soir: r.heure_debut_soir ?? null,
      heure_fin_soir: r.heure_fin_soir ?? null,
      candidat: r.candidats
        ? { id: String(r.candidats.id), nom: r.candidats.nom || "", prenom: r.candidats.prenom || "" }
        : null,
    }))

    if (selectedServices.length > 0) {
      rows = rows.filter(r => r.service && selectedServices.includes(r.service))
      console.log("✅ Lignes après filtre services:", rows.length)
    }

    console.log("✅ Exemple de ligne:", rows[0])
    return rows
  }

  /* --------------- Construction lignes (1 ligne = candidat) --------------- */
  function buildRows(cmds: CommandeRow[], daysISO: string[]): PdfRow[] {
    const byKey = new Map<string, PdfRow>()

    const sectorRank = (code: string) => {
      const c = code.toLowerCase()
      if (c === "cuisine") return 0
      if (c === "plonge") return 1
      if (c === "salle") return 2
      if (c === "reception") return 3
      if (c === "etages") return 4
      return 9
    }

    const ensureRow = (secteurVal: string, service: string | null, label: string, key: string) => {
      let row = byKey.get(key)
      if (!row) {
        const code = secteurVal.toLowerCase()
        row = {
          secteurCode: code,
          secteurLabel: /^(cuisine|plonge|salle|reception|etages)$/i.test(code) ? codeToLabel(code) : secteurVal,
          service,
          label,
          totalMinutes: 0,
          days: Array.from({ length: 7 }, () => [] as PdfCell[]),
        }
        byKey.set(key, row)
      }
      return row
    }

    for (const c of cmds) {
      const dstr = typeof c.date === "string" ? c.date.slice(0, 10) : c.date
      const dayIndex = daysISO.indexOf(dstr)
      if (dayIndex < 0) continue

      const secVal = (c.secteur || "").toString()
      const cell: PdfCell = {
        statut: c.statut,
        candidat: c.candidat ? { nom: c.candidat.nom, prenom: c.candidat.prenom } : null,
        hMatin:
          c.heure_debut_matin && c.heure_fin_matin
            ? `${cutHM(c.heure_debut_matin)} ${cutHM(c.heure_fin_matin)}`
            : undefined,
        hSoir:
          c.heure_debut_soir && c.heure_fin_soir
            ? `${cutHM(c.heure_debut_soir)} ${cutHM(c.heure_fin_soir)}`
            : undefined,
      }

      const minutes =
        diffMin(c.heure_debut_matin, c.heure_fin_matin) + diffMin(c.heure_debut_soir, c.heure_fin_soir)

      if (c.statut === "Validé" && c.candidat) {
        const key = `cand|${secVal}|${c.service ?? ""}|${c.candidat.id}`
        const row = ensureRow(secVal, c.service ?? null, `${c.candidat.nom} - ${c.candidat.prenom}`, key)
        row.days[dayIndex].push(cell)
        row.totalMinutes += minutes
      } else {
        const key = `stat|${secVal}|${c.service ?? ""}|${c.statut}`
        const row = ensureRow(secVal, c.service ?? null, c.statut || "—", key)
        row.days[dayIndex].push(cell)
        row.totalMinutes += minutes
      }
    }

    const rows = Array.from(byKey.values())

    function rowBucket(r: PdfRow): number {
      let hasValide = false,
        hasMatin = false,
        hasSoirOnly = false
      for (const dayCells of r.days)
        for (const m of dayCells) {
          if (m.statut === "Validé") {
            hasValide = true
            if (m.hMatin) hasMatin = true
            else if (m.hSoir) hasSoirOnly = true
          }
        }
      if (hasValide && hasMatin) return 0
      if (hasValide && hasSoirOnly) return 1

      const statuses = new Set<string>()
      for (const dayCells of r.days) for (const m of dayCells) statuses.add(m.statut)
      if (statuses.has("En recherche")) return 2
      if (statuses.has("Non pourvue") || statuses.has("Absence")) return 3
      return 4
    }

    rows.sort((a, b) => {
      const s = sectorRank(a.secteurCode) - sectorRank(b.secteurCode)
      if (s !== 0) return s
      const sa = (a.service || "").toLowerCase()
      const sb = (b.service || "").toLowerCase()
      if (sa !== sb) return sa.localeCompare(sb)
      const ba = rowBucket(a),
        bb = rowBucket(b)
      if (ba !== bb) return ba - bb
      return a.label.localeCompare(b.label)
    })

    for (const r of rows) {
      for (let i = 0; i < 7; i++) {
        r.days[i].sort((x, y) => (x.statut === "Validé" ? 0 : 1) - (y.statut === "Validé" ? 0 : 1))
      }
    }

    return rows
  }

  const onGenerate = async () => {
    if (!selectedClientId) {
      alert("Sélectionnez un client.")
      return
    }

    const client = clients.find(c => c.id === selectedClientId)!
    const { weekNum, days } = getWeekMeta(semaineISO)
    const daysISO = days.map(d => format(d, "yyyy-MM-dd"))
    const daysHeaders: DayHeader[] = days.map(d => ({
      date: format(d, "yyyy-MM-dd"),
      label: format(d, "EEE dd", { locale: fr }),
      dayName: format(d, "EEEE", { locale: fr }),
      dayNum: format(d, "d", { locale: fr }),
      monthShort: format(d, "LLL", { locale: fr }),
    }))

    const commandes = await fetchClientPlanning()
    console.log("✅ Construction des lignes PDF à partir de", commandes.length, "commandes")
    const rows = buildRows(commandes, daysISO)
    console.log("✅ Lignes PDF construites:", rows.length)

    if (rows.length === 0) {
      alert("Aucun créneau trouvé pour cette sélection (semaine/secteur/service).")
      return
    }

    const fileName = `Planning de Confirmation - ${client.nom} - Semaine ${weekNum}.pdf`
    buildPlanningPDF({
      fileName,
      clientNom: client.nom,
      secteurLabel,
      services: selectedServices,
      semaine: weekNum,
      userName: userDisplayName,
      daysHeaders,
      rows,
    })

    setOpen(false)
  }

  const secteursBtn: Array<{ label: string; icon: any }> = secteursListRaw as any

  return (
    <>
      <Button className="bg-[#840404] text-white hover:bg-[#750303]" onClick={() => setOpen(true)}>
        Générer planning client
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Générer le planning (PDF client)</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Secteurs */}
            <div>
              <Label className="mb-2 block">Secteur</Label>
              <div className="grid grid-cols-5 gap-2">
                {secteursBtn.map(({ label, icon: Icon }) => {
                  const selected = secteurLabel === label
                  return (
                    <Button
                      key={label}
                      type="button"
                      className={cn(
                        "py-2 h-10 w-full text-sm font-medium",
                        selected
                          ? "bg-[#840404] text-white hover:bg-[#750303]"
                          : "bg-gray-100 text-black hover:bg-gray-200"
                      )}
                      onClick={() => setSecteurLabel(label)}
                    >
                      <Icon className="h-4 w-4 mr-1" />
                      {label}
                      {selected && <Check className="ml-1 h-4 w-4" />}
                    </Button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Cuisine et Plonge sont regroupés (Cuisine d'abord, puis Plonge).
              </p>
            </div>

            {/* Semaine */}
            <div className="grid grid-cols-3 gap-3 items-center">
              <Label>Semaine</Label>
              <div className="col-span-2">
                <select
                  className="w-full border rounded px-2 py-2"
                  value={semaineISO}
                  onChange={(e) => setSemaineISO(e.target.value)}
                >
                  {semaines.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Client */}
            <div className="grid grid-cols-3 gap-3 items-start">
              <Label className="mt-2">Client</Label>
              <div className="col-span-2 space-y-2">
                <Input
                  placeholder="Rechercher un client…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
                <div className="max-h-44 overflow-auto border rounded">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-muted",
                        selectedClientId === c.id && "bg-muted"
                      )}
                    >
                      {c.nom}
                    </button>
                  ))}
                  {filteredClients.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Aucun client pour ce secteur.</div>
                  )}
                </div>
                {selectedClientId && (
                  <div className="text-xs text-muted-foreground">
                    Sélection : <span className="font-medium">{clients.find(c => c.id === selectedClientId)?.nom}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Services (optionnel) */}
            <div className="grid grid-cols-3 gap-3 items-start">
              <Label className="mt-2">Services</Label>
              <div className="col-span-2 space-y-2">
                <div
                  className={cn(
                    "max-h-40 overflow-auto border rounded",
                    availableServices.length === 0 && "opacity-50 pointer-events-none"
                  )}
                >
                  {(availableServices.length ? availableServices : ["Aucun service"]).map((s) => {
                    const active = selectedServices.includes(s)
                    return (
                      <button
                        key={s}
                        onClick={() =>
                          availableServices.length &&
                          setSelectedServices(active ? selectedServices.filter(x => x !== s) : [...selectedServices, s])
                        }
                        className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted", active && "bg-muted")}
                      >
                        {availableServices.length ? (active ? "✓ " : "") + s : s}
                      </button>
                    )
                  })}
                </div>
                {selectedServices.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedServices.map((s) => (
                      <span key={s} className="px-2 py-1 text-xs bg-muted rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Envoyé par (affichage) */}
            <div className="grid grid-cols-3 gap-3 items-center">
              <Label>Envoyé par</Label>
              <Input className="col-span-2" value={userDisplayName} readOnly />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button className="bg-[#840404] text-white hover:bg-[#750303]" onClick={onGenerate}>
                Générer le PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
