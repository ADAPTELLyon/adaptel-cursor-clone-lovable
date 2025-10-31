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
  date: string // ISO (yyyy-MM-dd ou timestamp)
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
  hMatin?: string // "HH:MM HH:MM"
  hSoir?: string  // "HH:MM HH:MM"
}
type PdfRow = {
  secteurCode: string
  secteurLabel: string
  service: string | null
  label: string          // "Nom - Prénom" ou libellé statut
  totalMinutes: number
  days: PdfCell[][]      // 7 colonnes
}

/* ---------------------------- Utils ---------------------------- */
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

/* ---------------------------- PDF (vignettes) ---------------------------- */
function buildPlanningPDF(args: {
  fileName: string
  daysHeaders: DayHeader[]
  rows: PdfRow[]
}) {
  const { fileName, daysHeaders, rows } = args
  const doc = new jsPDF({ orientation: "l", unit: "pt", format: "a4" })
  const page = doc.internal.pageSize
  const W = page.getWidth()
  const H = page.getHeight()
  const Mx = 28
  const My = 28

  // largeur colonnes
  const firstColW = 260 // plus étroit
  const usableW = W - Mx * 2 - firstColW
  const dayColW = usableW / 7

  // paramètres typographiques (ajustés dynamique si trop haut)
  let FONT = 9.5
  let CARD_H = 46
  let CARD_RADIUS = 6
  let PAD = 6
  const HEADER_H = 30

  // estimer hauteur totale
  const estimateTotalHeight = () => {
    const header = HEADER_H + 10
    const rowsH = rows.map(r => {
      const maxPerDay = Math.max(1, ...r.days.map(list => list.length || 0))
      return PAD * 2 + (CARD_H * maxPerDay) + (4 * (maxPerDay - 1))
    }).reduce((a, b) => a + b, 0)
    const tableMargins = 0 // on gère nos marges via AutoTable
    return My + header + rowsH + tableMargins + 20
  }

  // si ça dépasse → on réduit proportionnellement
  const available = H - My * 2
  let total = estimateTotalHeight()
  if (total > H) {
    const ratio = Math.max(0.6, available / (total - My)) // clamp à 60%
    FONT = FONT * ratio
    CARD_H = Math.max(34, CARD_H * ratio)
    CARD_RADIUS = Math.max(4, CARD_RADIUS * ratio)
    PAD = Math.max(4, PAD * ratio)
    // recalcul pour info (non bloquant)
    total = estimateTotalHeight()
  }

  // entêtes colonnes (jours)
  const head = [[
    { content: "Secteur / Candidat — Total", styles: { halign: "left" as const } },
    ...daysHeaders.map(d => ({ content: `${d.label}`, styles: { halign: "center" as const } })),
  ]]

  // autoTable body "vide" (on dessine dans didDrawCell)
  const body = rows.map(_ => {
    const row: any[] = new Array(8).fill("")
    return row
  })

  autoTable(doc, {
    startY: My,
    head,
    body,
    theme: "plain",
    styles: { font: "helvetica", fontSize: FONT, cellPadding: 0, valign: "top", lineColor: [229, 231, 235], lineWidth: 0.6 } as any,
    headStyles: { fontStyle: "bold", fillColor: [245, 245, 245], textColor: 0, halign: "center" },
    columnStyles: {
      0: { cellWidth: firstColW },
      1: { cellWidth: dayColW }, 2: { cellWidth: dayColW }, 3: { cellWidth: dayColW },
      4: { cellWidth: dayColW }, 5: { cellWidth: dayColW }, 6: { cellWidth: dayColW }, 7: { cellWidth: dayColW },
    } as any,
    margin: { left: Mx, right: Mx, top: 0, bottom: My },
    didParseCell: (data: any) => {
      if (data.section === "head") {
        data.cell.styles.minCellHeight = HEADER_H
        return
      }
      if (data.section === "body") {
        const r = rows[data.row.index]
        const maxPerDay = Math.max(1, ...r.days.map(list => list.length || 0))
        const h = PAD * 2 + (CARD_H * maxPerDay) + (4 * (maxPerDay - 1))
        data.cell.styles.minCellHeight = h
      }
    },
    didDrawCell: (data: any) => {
      const { cell, column, row, section } = data
      if (section === "head") {
        // dessiner le badge jour : déjà dans le texte → pas de custom
        return
      }
      if (section !== "body") return

      const r: PdfRow = rows[row.index]

      // contour cellule
      doc.setDrawColor(229, 231, 235)
      doc.rect(cell.x, cell.y, cell.width, cell.height)

      if (column.index === 0) {
        // Col 1 : pastille secteur + Nom Prénom + total heures
        const x = cell.x + 8
        let y = cell.y + 8

        // pastille secteur
        doc.setFillColor("#e5e7eb")
        doc.circle(x + 10, y + 10, 9, "F")
        doc.setTextColor("#374151"); doc.setFont("helvetica", "bold"); doc.setFontSize(Math.max(7, FONT - 2))
        doc.text(sectorInitials(r.secteurCode), x + 10, y + 13, { align: "center" })

        // libellés
        const sx = x + 26
        doc.setTextColor("#111827"); doc.setFont("helvetica", "bold"); doc.setFontSize(Math.max(10, FONT + 1))
        // service (optionnel) — demandé: si pas de service, on n'affiche rien
        if (r.service) {
          doc.text(r.service, sx, y + 8)
          y += 16
        }
        // Nom - Prénom
        doc.setFont("helvetica", "normal"); doc.setFontSize(Math.max(10, FONT + 0.5))
        doc.text(r.label, sx, y + 8)
        y += 16

        // Total heures
        doc.setFont("helvetica", "bold"); doc.setFontSize(FONT + 0.5)
        doc.setTextColor("#840404")
        doc.text(`🕒 ${minToHHMM(r.totalMinutes)}`, sx, y + 8)
        return
      }

      // Colonnes jour : dessiner les vignettes statut
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

        // fond vignette
        doc.setFillColor(bg)
        doc.roundedRect(x0, y0, w, CARD_H, CARD_RADIUS, CARD_RADIUS, "F")

        // contenu vignette
        doc.setTextColor(fg)
        if (c.statut === "Validé" && c.candidat) {
          doc.setFont("helvetica", "bold"); doc.setFontSize(FONT + 1.5)
          doc.text(c.candidat.nom, x0 + 6, y0 + 14)
          doc.setFont("helvetica", "normal"); doc.setFontSize(FONT + 0.5)
          doc.text(c.candidat.prenom, x0 + 6, y0 + 28)
        } else {
          doc.setFont("helvetica", "bold"); doc.setFontSize(FONT + 1.5)
          doc.text(c.statut || "—", x0 + 6, y0 + 18)
        }

        doc.setFont("helvetica", "bold"); doc.setFontSize(FONT + 0.5)
        let yy = y0 + 42
        if (c.hMatin) { doc.text(c.hMatin, x0 + 6, yy); yy += 12 }
        if (c.hSoir)  { doc.text(c.hSoir,  x0 + 6, yy) }

        y0 += CARD_H + 4
        if (y0 > cell.y + cell.height - CARD_H) break
      }
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
  const [userDisplayName, setUserDisplayName] = useState("Utilisateur ADAPTEL")

  useEffect(() => {
    const load = async () => {
      try {
        const authId = user?.id || ""
        if (authId) {
          const { data } = await supabase
            .from("utilisateurs")
            .select("prenom, nom")
            .eq("auth_user_id", authId)
            .maybeSingle()
          if (data?.prenom || data?.nom) {
            setUserDisplayName(`${data.prenom ?? ""} ${data.nom ?? ""}`.trim())
            return
          }
        }
        setUserDisplayName(user?.email || "Utilisateur ADAPTEL")
      } catch {
        setUserDisplayName(user?.email || "Utilisateur ADAPTEL")
      }
    }
    load()
  }, [user])

  const semaines: SemaineOption[] = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 10 }, (_, i) => {
      const monday = addDays(base, i * 7)
      const iso = format(monday, "yyyy-MM-dd")
      return { value: iso, label: `Semaine ${format(monday, "I")} — ${format(monday, "dd/MM")} → ${format(addDays(monday, 6), "dd/MM")}` }
    })
  }, [])

  // Clients filtrés par secteur (Cuisine ⇄ Plonge)
  useEffect(() => {
    const load = async () => {
      const selCode = labelToCode[secteurLabel] || ""
      const pair = selCode === "cuisine" || selCode === "plonge"

      const { data, error } = await supabase
        .from("clients")
        .select("id, nom, services, secteurs, actif")
        .eq("actif", true)
        .order("nom")

      if (error) { console.error(error); setClients([]); return }

      const filtered = (data || []).filter((c: any) => {
        const secteurs: string[] = Array.isArray(c.secteurs)
          ? c.secteurs
          : typeof c.secteurs === "string" ? c.secteurs.split(",").map((s: string) => s.trim()) : []
        if (pair) return secteurs.some(s => /^(cuisine|plonge)$/i.test(s))
        return selCode ? secteurs.some(s => s === selCode || s === codeToLabel(selCode)) : true
      })

      const normalized: ClientRow[] = filtered.map((c: any) => {
        const raw = c.services
        const services: string[] = Array.isArray(raw)
          ? raw
          : typeof raw === "string" ? raw.split(",").map((s: string) => s.trim()).filter(Boolean) : []
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

  const buildDaysHeaders = (mondayISO: string): DayHeader[] => {
    const monday = new Date(mondayISO)
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(monday, i)
      return {
        date: format(d, "yyyy-MM-dd"),
        label: format(d, "EEE dd", { locale: fr }),
        dayName: format(d, "EEEE", { locale: fr }),
        dayNum: format(d, "d", { locale: fr }),
        monthShort: format(d, "LLL", { locale: fr }),
      }
    })
  }

  /* ------------------- Chargement commandes robustes ------------------- */
  const fetchClientPlanning = async (): Promise<CommandeRow[]> => {
    if (!selectedClientId) return []
    const { monday, nextMonday } = getWeekMeta(semaineISO)
    const mondayISO = format(monday, "yyyy-MM-dd")
    const nextMondayISO = format(nextMonday, "yyyy-MM-dd")

    const selCode = labelToCode[secteurLabel] || ""
    const pair = selCode === "cuisine" || selCode === "plonge"
    const secteurOr = pair
      ? "secteur.eq.cuisine,secteur.eq.Cuisine,secteur.eq.plonge,secteur.eq.Plonge"
      : `secteur.eq.${selCode},secteur.eq.${codeToLabel(selCode)}`

    let q = supabase
      .from("commandes")
      .select(`
        id, date, secteur, service, statut,
        heure_debut_matin, heure_fin_matin,
        heure_debut_soir,  heure_fin_soir,
        candidat:candidat_id ( id, nom, prenom )
      `)
      .eq("client_id", selectedClientId)
      .gte("date", mondayISO)
      .lt("date", nextMondayISO)
      .neq("statut", "Annule ADA")
      .order("date", { ascending: true })

    if (selCode) q = q.or(secteurOr)

    const { data, error } = await q
    if (error) { console.error("ERR commandes", error); return [] }

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
      candidat: r.candidat ? { id: String(r.candidat.id), nom: r.candidat.nom || "", prenom: r.candidat.prenom || "" } : null,
    }))

    if (selectedServices.length > 0) {
      rows = rows.filter(r => r.service && selectedServices.includes(r.service))
    }

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
        hMatin: (c.heure_debut_matin && c.heure_fin_matin) ? `${cutHM(c.heure_debut_matin)} ${cutHM(c.heure_fin_matin)}` : undefined,
        hSoir:  (c.heure_debut_soir && c.heure_fin_soir)     ? `${cutHM(c.heure_debut_soir)} ${cutHM(c.heure_fin_soir)}`   : undefined,
      }

      const minutes = diffMin(c.heure_debut_matin, c.heure_fin_matin) + diffMin(c.heure_debut_soir, c.heure_fin_soir)

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

    // bucketing pour l’ordre demandé
    function rowBucket(r: PdfRow): number {
      let hasValide = false, hasMatin = false, hasSoirOnly = false
      for (const dayCells of r.days) for (const m of dayCells) {
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

    // tri global
    rows.sort((a, b) => {
      const s = sectorRank(a.secteurCode) - sectorRank(b.secteurCode)
      if (s !== 0) return s
      const sa = (a.service || "").toLowerCase()
      const sb = (b.service || "").toLowerCase()
      if (sa !== sb) return sa.localeCompare(sb)
      const ba = rowBucket(a), bb = rowBucket(b)
      if (ba !== bb) return ba - bb
      return a.label.localeCompare(b.label)
    })

    // Dans chaque jour, Validé en premier
    for (const r of rows) {
      for (let i = 0; i < 7; i++) {
        r.days[i].sort((x, y) => (x.statut === "Validé" ? 0 : 1) - (y.statut === "Validé" ? 0 : 1))
      }
    }

    return rows
  }

  const onGenerate = async () => {
    if (!selectedClientId) { alert("Sélectionnez un client."); return }

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
    const rows = buildRows(commandes, daysISO)

    const fileName = `Planning de Confirmation - ${client.nom} - Semaine ${weekNum}.pdf`
    buildPlanningPDF({ fileName, daysHeaders, rows })

    if (rows.length === 0) {
      alert("Aucun créneau trouvé pour cette sélection (semaine/secteur/service).")
    }

    setOpen(false)
  }

  // ⚠️ Typage simplifié pour éviter TS2589
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
                        selected ? "bg-[#840404] text-white hover:bg-[#750303]" : "bg-gray-100 text-black hover:bg-gray-200"
                      )}
                      onClick={() => setSecteurLabel(label)}
                    >
                      <Icon className="h-4 w-4 mr-1" />
                      {label}{selected && <Check className="ml-1 h-4 w-4" />}
                    </Button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Cuisine et Plonge sont regroupés (Cuisine d’abord, puis Plonge).
              </p>
            </div>

            {/* Semaine */}
            <div className="grid grid-cols-3 gap-3 items-center">
              <Label>Semaine</Label>
              <div className="col-span-2">
                <select className="w-full border rounded px-2 py-2" value={semaineISO} onChange={(e) => setSemaineISO(e.target.value)}>
                  {semaines.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Client */}
            <div className="grid grid-cols-3 gap-3 items-start">
              <Label className="mt-2">Client</Label>
              <div className="col-span-2 space-y-2">
                <Input placeholder="Rechercher un client…" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
                <div className="max-h-44 overflow-auto border rounded">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClientId(c.id)}
                      className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted", selectedClientId === c.id && "bg-muted")}
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
                <div className={cn("max-h-40 overflow-auto border rounded", availableServices.length === 0 && "opacity-50 pointer-events-none")}>
                  {(availableServices.length ? availableServices : ["Aucun service"]).map((s) => {
                    const active = selectedServices.includes(s)
                    return (
                      <button
                        key={s}
                        onClick={() => availableServices.length && setSelectedServices(active ? selectedServices.filter(x => x !== s) : [...selectedServices, s])}
                        className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted", active && "bg-muted")}
                      >
                        {availableServices.length ? (active ? "✓ " : "") + s : s}
                      </button>
                    )
                  })}
                </div>
                {selectedServices.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedServices.map((s) => <span key={s} className="px-2 py-1 text-xs bg-muted rounded">{s}</span>)}
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
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button className="bg-[#840404] text-white hover:bg-[#750303]" onClick={onGenerate}>Générer le PDF</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
