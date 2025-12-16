// src/components/PlanningClientExportDialog.tsx
import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addDays, format, startOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { Check, Loader2 } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { secteursList as secteursListRaw } from "@/lib/secteurs"
import { useAuth } from "@/contexts/auth-context"

import { generateClientPlanningPdf } from "@/lib/generateClientSynthesePdf"
import type { DayHeader, ClientPlanningRow as PDFClientPlanningRow } from "@/lib/generateClientSynthesePdf"

/* ------------------------------- Types Locaux ------------------------------- */
type CommandeRow = {
  id: string
  date: string
  secteur: string | null
  service: string | null
  statut: string
  poste: string | null
  heure_debut_matin: string | null
  heure_fin_matin: string | null
  heure_debut_soir: string | null
  heure_fin_soir: string | null
  candidat: { id: string; nom: string; prenom: string; telephone: string | null } | null
}

type ClientRow = { id: string; nom: string; services: string[] }
type SemaineOption = { value: string; label: string }

/* ---------------------------- Utils ---------------------------- */
const labelToCode: Record<string, string> = {
  Cuisine: "cuisine",
  Salle: "salle",
  Plonge: "plonge",
  Réception: "reception",
  Étages: "etages",
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
  const a = parseHM(d),
    b = parseHM(f)
  if (a == null || b == null) return 0
  return Math.max(0, b - a)
}

const buildDaysHeaders = (mondayISO: string): DayHeader[] => {
  const monday = new Date(mondayISO)
  return Array.from({ length: 7 }, (_, i) => {
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

/* ------------------------------- Composant ------------------------------- */
export default function PlanningClientExportDialog() {
  const [open, setOpen] = useState(false)

  const [secteurLabel, setSecteurLabel] = useState("Cuisine")
  const [semaineISO, setSemaineISO] = useState(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    return format(monday, "yyyy-MM-dd")
  })

  const [clients, setClients] = useState<ClientRow[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
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
    return Array.from({ length: 18 }, (_, i) => {
      const monday = addDays(base, i * 7)
      const iso = format(monday, "yyyy-MM-dd")
      return {
        value: iso,
        label: `Semaine ${format(monday, "I")} — ${format(monday, "dd/MM")} → ${format(
          addDays(monday, 6),
          "dd/MM"
        )}`,
      }
    })
  }, [])

  // Clients filtrés par secteur (Cuisine ⇄ Plonge regroupés)
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoadingClients(true)

      const selCode = labelToCode[secteurLabel] || ""
      const pair = selCode === "cuisine" || selCode === "plonge"

      const { data, error } = await supabase
        .from("clients")
        .select("id, nom, services, secteurs, actif")
        .eq("actif", true)
        .order("nom")

      if (cancelled) return

      if (error) {
        console.error(error)
        setClients([])
        setSelectedClientId("")
        setAvailableServices([])
        setSelectedServices([])
        setLoadingClients(false)
        return
      }

      const filtered = (data || []).filter((c: any) => {
        const secteurs: string[] = Array.isArray(c.secteurs)
          ? c.secteurs
          : typeof c.secteurs === "string"
          ? c.secteurs.split(",").map((s: string) => s.trim())
          : []

        // Cuisine/Plonge regroupés
        if (pair) return secteurs.some((s) => /^(cuisine|plonge)$/i.test(s))

        // sinon : match code OU label
        const label = codeToLabel(selCode)
        return selCode
          ? secteurs.some((s) => s === selCode || s === label || String(s).toLowerCase() === selCode)
          : true
      })

      const normalized: ClientRow[] = filtered.map((c: any) => {
        const raw = c.services
        const services: string[] = Array.isArray(raw)
          ? raw
          : typeof raw === "string"
          ? raw
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean)
          : []
        return { id: String(c.id), nom: String(c.nom || ""), services }
      })

      // 🔥 Anti-clignotement : on ne vide plus la liste au début.
      // On remplace seulement quand c’est chargé.
      setClients(normalized)

      // Si le client sélectionné n’existe plus dans la nouvelle liste, on reset.
      if (selectedClientId && !normalized.some((c) => c.id === selectedClientId)) {
        setSelectedClientId("")
        setAvailableServices([])
        setSelectedServices([])
      }

      setLoadingClients(false)
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* ------------------- Chargement commandes robuste ------------------- */
  const fetchClientPlanning = async (): Promise<CommandeRow[]> => {
    if (!selectedClientId) return []

    const { monday, nextMonday } = getWeekMeta(semaineISO)
    const mondayISO = format(monday, "yyyy-MM-dd")
    const nextMondayISO = format(nextMonday, "yyyy-MM-dd")

    const selCode = labelToCode[secteurLabel] || ""
    const pair = selCode === "cuisine" || selCode === "plonge"

    let q = supabase
      .from("commandes")
      .select(
        `
        id, date, secteur, service, statut, poste,
        heure_debut_matin, heure_fin_matin,
        heure_debut_soir,  heure_fin_soir,
        candidat:candidat_id ( id, nom, prenom, telephone )
      `
      )
      .eq("client_id", selectedClientId)
      .gte("date", mondayISO)
      .lt("date", nextMondayISO)
      .neq("statut", "Annule ADA")
      .order("date", { ascending: true })

    if (selCode) {
      if (pair) {
        // Cuisine/Plonge : accepte code et label
        q = q.or(
          "secteur.eq.cuisine,secteur.eq.Cuisine,secteur.eq.plonge,secteur.eq.Plonge"
        )
      } else {
        const label = codeToLabel(selCode)
        q = q.or(`secteur.eq.${selCode},secteur.eq.${label}`)
      }
    }

    const { data, error } = await q
    if (error) {
      console.error("ERR commandes:", error)
      return []
    }

    let rows: CommandeRow[] = (data || []).map((r: any) => ({
      id: String(r.id),
      date: r.date,
      secteur: r.secteur ?? null,
      service: r.service ?? null,
      statut: r.statut ?? "",
      poste: r.poste ?? null,
      heure_debut_matin: r.heure_debut_matin ?? null,
      heure_fin_matin: r.heure_fin_matin ?? null,
      heure_debut_soir: r.heure_debut_soir ?? null,
      heure_fin_soir: r.heure_fin_soir ?? null,
      candidat: r.candidat
        ? {
            id: String(r.candidat.id),
            nom: r.candidat.nom || "",
            prenom: r.candidat.prenom || "",
            telephone: r.candidat.telephone || null,
          }
        : null,
    }))

    if (selectedServices.length > 0) {
      rows = rows.filter((r) => r.service && selectedServices.includes(r.service))
    }

    return rows
  }

  /* --------------- Construction lignes : 1 ligne = "slot" (candidat/statu + poste) --------------- */
  function buildRows(cmds: CommandeRow[], daysISO: string[]): PDFClientPlanningRow[] {
    type PdfCell = {
      statut: string
      candidat?: { nom: string; prenom: string } | null
      heure_debut_matin: string | null
      heure_fin_matin: string | null
      heure_debut_soir: string | null
      heure_fin_soir: string | null
    }

    const byKey = new Map<string, PDFClientPlanningRow>()

    const ensureRow = (
      secteurVal: string,
      service: string | null,
      poste: string,
      label: string,
      candidatTel: string | null,
      key: string
    ) => {
      let row = byKey.get(key)
      if (!row) {
        row = {
          secteur: secteurVal,
          service,
          poste,
          candidatTel,
          label,
          totalMinutes: 0,
          days: Array.from({ length: 7 }, () => [] as PdfCell[]),
        } as PDFClientPlanningRow
        byKey.set(key, row)
      }
      return row
    }

    for (const c of cmds) {
      const dstr = typeof c.date === "string" ? c.date.slice(0, 10) : c.date
      const dayIndex = daysISO.indexOf(dstr)
      if (dayIndex < 0) continue

      const secVal = (c.secteur || secteurLabel).toString()
      const poste = c.poste || "Non défini"

      const cell: PdfCell = {
        statut: c.statut,
        candidat: c.candidat ? { nom: c.candidat.nom, prenom: c.candidat.prenom } : null,
        heure_debut_matin: c.heure_debut_matin,
        heure_fin_matin: c.heure_fin_matin,
        heure_debut_soir: c.heure_debut_soir,
        heure_fin_soir: c.heure_fin_soir,
      }

      const minutes =
        diffMin(c.heure_debut_matin, c.heure_fin_matin) + diffMin(c.heure_debut_soir, c.heure_fin_soir)

      if (c.statut === "Validé" && c.candidat) {
        const key = `cand|${secVal}|${c.service ?? ""}|${poste}|${c.candidat.id}`
        const label = `${c.candidat.nom} ${c.candidat.prenom}`.trim()
        const tel = c.candidat.telephone
        const row = ensureRow(secVal, c.service ?? null, poste, label, tel, key)
        row.days[dayIndex].push(cell)
        row.totalMinutes += minutes
      } else {
        const key = `stat|${secVal}|${c.service ?? ""}|${poste}|${c.statut}`
        const label = c.statut || "—"
        const row = ensureRow(secVal, c.service ?? null, poste, label, null, key)
        row.days[dayIndex].push(cell)
        row.totalMinutes += minutes
      }
    }

    const rows = Array.from(byKey.values())

    // Tri : Validés d’abord, puis En recherche, puis le reste
    const bucket = (r: PDFClientPlanningRow) => {
      if (r.label && !["En recherche", "Non pourvue", "Absence"].includes(r.label)) return 0
      if (r.label === "En recherche") return 1
      return 2
    }
    rows.sort((a, b) => {
      const ba = bucket(a)
      const bb = bucket(b)
      if (ba !== bb) return ba - bb
      return a.label.localeCompare(b.label)
    })

    // ✅ 8 lignes fixes
    const MAX_LINES = 8
    const finalRows = rows.slice(0, MAX_LINES)

    while (finalRows.length < MAX_LINES) {
      finalRows.push({
        secteur: secteurLabel,
        service: null,
        poste: "",
        candidatTel: null,
        label: "",
        totalMinutes: 0,
        days: Array.from({ length: 7 }, () => [] as PdfCell[]),
      } as PDFClientPlanningRow)
    }

    // Dans chaque jour : on garde une seule cellule (comme ton UI : 1 case = 1 commande)
    for (const r of finalRows) {
      for (let i = 0; i < 7; i++) {
        r.days[i] = (r.days[i] || []).slice(0, 1)
      }
    }

    return finalRows
  }

  const onGenerate = async () => {
    if (!selectedClientId) {
      alert("Sélectionnez un client.")
      return
    }

    const client = clients.find((c) => c.id === selectedClientId)
    if (!client) {
      alert("Client introuvable (rafraîchis la liste).")
      return
    }

    const { weekNum, days } = getWeekMeta(semaineISO)
    const daysISO = days.map((d) => format(d, "yyyy-MM-dd"))
    const daysHeaders = buildDaysHeaders(semaineISO)

    const commandes = await fetchClientPlanning()
    const rows = buildRows(commandes, daysISO)

    try {
      await generateClientPlanningPdf({
        client,
        secteurSelection: secteurLabel,
        semaine: weekNum,
        daysHeaders,
        userName: userDisplayName,
        rows,
        services: selectedServices,
      })
      setOpen(false)
    } catch (e) {
      console.error(e)
      alert("Erreur génération PDF (voir console).")
    }
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
                Cuisine et Plonge sont regroupés (Cuisine d’abord, puis Plonge).
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
                  {loadingClients && (
                    <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Chargement…
                    </div>
                  )}

                  {!loadingClients &&
                    filteredClients.map((c) => (
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

                  {!loadingClients && filteredClients.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Aucun client pour ce secteur.
                    </div>
                  )}
                </div>

                {selectedClientId && (
                  <div className="text-xs text-muted-foreground">
                    Sélection :{" "}
                    <span className="font-medium">{clients.find((c) => c.id === selectedClientId)?.nom}</span>
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
                          setSelectedServices(active ? selectedServices.filter((x) => x !== s) : [...selectedServices, s])
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
