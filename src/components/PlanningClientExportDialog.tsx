import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { addDays, format, getISOWeek, getISOWeekYear, startOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import {
  generateClientPlanningPdf,
  type ClientPlanningRow,
  type CommandeCell,
  type DayHeader,
} from "@/lib/generateClientSynthesePdf"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { FileDown, BedDouble, ChefHat, Utensils, Droplets, ConciergeBell } from "lucide-react"

/* ==================== TYPES ==================== */
type ClientRow = {
  id: string
  nom: string
  services: string[]
  secteurs: string[]
}

type CommandeRow = {
  id: string
  date: string
  secteur: string
  service: string | null
  statut: string
  heure_debut_matin: string | null
  heure_fin_matin: string | null
  heure_debut_soir: string | null
  heure_fin_soir: string | null
  candidat: { id: string; nom: string; prenom: string } | null
}

/* ==================== UTILS ==================== */
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function buildSecteurValues(secteurLabel: string): string[] {
  const base = secteurLabel.trim()
  const map: Record<string, string[]> = {
    "Étages": ["Étages", "Etages", "etages", "ETAGES"],
    "Cuisine": ["Cuisine", "cuisine", "CUISINE"],
    "Salle": ["Salle", "salle", "SALLE"],
    "Plonge": ["Plonge", "plonge", "PLONGE"],
    "Réception": ["Réception", "Reception", "reception", "RECEPTION"],
  }
  return map[base] || [base]
}

function toIsoWeekKeyFromDateStr(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  const y = getISOWeekYear(d)
  const w = getISOWeek(d)
  return `${y}-W${String(w).padStart(2, "0")}`
}

function getWeekMeta(isoWeekStr: string) {
  const [yearStr, wStr] = isoWeekStr.split("-W")
  const year = parseInt(yearStr, 10)
  const week = parseInt(wStr, 10)

  const jan4 = new Date(year, 0, 4)
  const monday = startOfWeek(jan4, { weekStartsOn: 1 })
  const offsetDays = (week - 1) * 7
  const weekMonday = addDays(monday, offsetDays)
  const nextMonday = addDays(weekMonday, 7)

  return { monday: weekMonday, nextMonday }
}

const parseDuration = (debut: string | null, fin: string | null): number => {
  if (!debut || !fin) return 0
  const [hd, md] = debut.split(":").map(Number)
  const [hf, mf] = fin.split(":").map(Number)
  const dMin = (hd || 0) * 60 + (md || 0)
  const fMin = (hf || 0) * 60 + (mf || 0)
  return fMin > dMin ? fMin - dMin : 0
}

/* ==================== COMPONENT ==================== */
export default function PlanningClientExportDialog() {
  const { user } = useAuth()

  const [open, setOpen] = useState(false)

  const [clients, setClients] = useState<ClientRow[]>([])
  const [secteurLabel, setSecteurLabel] = useState<string>("Étages")

  // Client: champ recherche + liste dessous (seul scroll)
  const [clientSearch, setClientSearch] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<string>("")

  // Semaine: SELECT simple
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([])
  const [selectedWeek, setSelectedWeek] = useState<string>("")

  // Service: sélection unique
  const [availableServices, setAvailableServices] = useState<string[]>([])
  const [selectedService, setSelectedService] = useState<string>("") // "" = Tous

  /* ------------------- load clients ------------------- */
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("clients")
        .select("id, nom, services, secteurs")
        .order("nom")

      if (error) {
        console.error("❌ load clients error:", error)
        setClients([])
        return
      }

      const safe: ClientRow[] = (data || []).map((c: any) => ({
        id: String(c.id),
        nom: c.nom || "",
        services: Array.isArray(c.services) ? c.services : [],
        secteurs: Array.isArray(c.secteurs) ? c.secteurs : [],
      }))
      setClients(safe)
    }
    load()
  }, [])

  /* ------------------- clients filtered by secteur ------------------- */
  const clientsBySecteur = useMemo(() => {
    const wanted = norm(secteurLabel)
    return clients.filter((c) => c.secteurs.some((s) => norm(s) === wanted))
  }, [clients, secteurLabel])

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clientsBySecteur
    return clientsBySecteur.filter((c) => (c.nom || "").toLowerCase().includes(q))
  }, [clientSearch, clientsBySecteur])

  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || null
  }, [clients, selectedClientId])

  /* ------------------- reset when secteur changes ------------------- */
  useEffect(() => {
    setSelectedClientId("")
    setClientSearch("")
    setAvailableWeeks([])
    setSelectedWeek("")
    setAvailableServices([])
    setSelectedService("")
  }, [secteurLabel])

  /* ------------------- services according to client ------------------- */
  useEffect(() => {
    const list = selectedClient?.services || []
    setAvailableServices(list)
    if (selectedService && !list.includes(selectedService)) {
      setSelectedService("")
    }
  }, [selectedClient, selectedService])

  /* ------------------- load weeks with data (client + secteur) ------------------- */
  useEffect(() => {
    async function loadWeeks() {
      if (!selectedClientId) {
        setAvailableWeeks([])
        setSelectedWeek("")
        return
      }

      const secteursValues = buildSecteurValues(secteurLabel)

      const { data, error } = await supabase
        .from("commandes")
        .select("date")
        .eq("client_id", selectedClientId)
        .in("secteur", secteursValues)
        .neq("statut", "Annule ADA")
        .order("date", { ascending: true })
        .limit(5000)

      if (error) {
        console.error("❌ load weeks error:", error)
        setAvailableWeeks([])
        setSelectedWeek("")
        return
      }

      const dates: string[] = (data || []).map((r: any) => r?.date).filter(Boolean)
      const uniq = Array.from(new Set(dates.map(toIsoWeekKeyFromDateStr)))

      uniq.sort((a, b) => {
        const [ay, aw] = a.split("-W")
        const [by, bw] = b.split("-W")
        const na = parseInt(ay, 10) * 100 + parseInt(aw, 10)
        const nb = parseInt(by, 10) * 100 + parseInt(bw, 10)
        return na - nb
      })

      setAvailableWeeks(uniq)

      // défaut : semaine courante si dispo sinon dernière
      const now = new Date()
      const cur = `${getISOWeekYear(now)}-W${String(getISOWeek(now)).padStart(2, "0")}`
      const next = uniq.includes(cur) ? cur : (uniq[uniq.length - 1] || "")
      setSelectedWeek((prev) => (prev && uniq.includes(prev) ? prev : next))
    }

    loadWeeks()
  }, [selectedClientId, secteurLabel])

  /* ------------------- Fetch commandes ------------------- */
  const fetchClientPlanning = async (): Promise<CommandeRow[]> => {
    if (!selectedClientId || !selectedWeek) return []

    const { monday, nextMonday } = getWeekMeta(selectedWeek)
    const mondayISO = format(monday, "yyyy-MM-dd")
    const nextMondayISO = format(nextMonday, "yyyy-MM-dd")
    const secteursValues = buildSecteurValues(secteurLabel)

    let query = supabase
      .from("commandes")
      .select(
        `
        id, date, secteur, service, statut,
        heure_debut_matin, heure_fin_matin,
        heure_debut_soir, heure_fin_soir,
        candidats:candidat_id (id, nom, prenom)
      `
      )
      .eq("client_id", selectedClientId)
      .gte("date", mondayISO)
      .lt("date", nextMondayISO)
      .in("secteur", secteursValues)
      .neq("statut", "Annule ADA")
      .order("date", { ascending: true })

    if (selectedService) {
      query = query.eq("service", selectedService)
    }

    const { data, error } = await query

    if (error) {
      console.error("❌ ERR commandes:", error)
      return []
    }

    const rows: CommandeRow[] = (data || []).map((r: any) => ({
      id: String(r.id),
      date: r.date,
      secteur: r.secteur || "",
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

    return rows
  }

  /* ------------------- Transform vers PDF ------------------- */
  function transformToPdfFormat(cmds: CommandeRow[], daysISO: string[]): ClientPlanningRow[] {
    const byKey = new Map<string, ClientPlanningRow>()

    for (const cmd of cmds) {
      const label = cmd.candidat ? `${cmd.candidat.nom} ${cmd.candidat.prenom}` : cmd.statut
      const key = `${cmd.secteur || ""}|${cmd.service || ""}|${label}`

      if (!byKey.has(key)) {
        byKey.set(key, {
          secteur: cmd.secteur || "",
          service: cmd.service,
          poste: cmd.service ? cmd.service : (cmd.secteur || ""),
          candidatTel: null, // (tu l’ajouteras plus tard si tu veux via join candidats.telephone)
          label,
          totalMinutes: 0,
          days: daysISO.map(() => []),
        })
      }

      const row = byKey.get(key)!
      const dayIndex = daysISO.indexOf(cmd.date)
      if (dayIndex === -1) continue

      row.totalMinutes +=
        parseDuration(cmd.heure_debut_matin, cmd.heure_fin_matin) +
        parseDuration(cmd.heure_debut_soir, cmd.heure_fin_soir)

      const cell: CommandeCell = {
        statut: cmd.statut,
        candidat: cmd.candidat,
        heure_debut_matin: cmd.heure_debut_matin,
        heure_fin_matin: cmd.heure_fin_matin,
        heure_debut_soir: cmd.heure_debut_soir,
        heure_fin_soir: cmd.heure_fin_soir,
      }

      row.days[dayIndex].push(cell)
    }

    return Array.from(byKey.values())
  }

  /* ------------------- Generate PDF ------------------- */
  const handleGeneratePDF = async () => {
    if (!secteurLabel || !selectedClientId || !selectedWeek) {
      alert("Merci de sélectionner un secteur, un client et une semaine.")
      return
    }

    const client = selectedClient
    if (!client) return

    const { monday } = getWeekMeta(selectedWeek)
    const days: Date[] = []
    for (let i = 0; i < 7; i++) days.push(addDays(monday, i))

    const weekNum = getISOWeek(monday)
    const daysISO = days.map((d) => format(d, "yyyy-MM-dd"))

    const daysHeaders: DayHeader[] = days.map((d) => ({
      date: format(d, "yyyy-MM-dd"),
      label: format(d, "EEE dd", { locale: fr }),
      dayName: format(d, "EEEE", { locale: fr }),
      dayNum: format(d, "d", { locale: fr }),
      monthShort: format(d, "LLLL", { locale: fr }), // "Décembre" complet (PDF va gérer)
    }))

    const commandes = await fetchClientPlanning()
    const rows = transformToPdfFormat(commandes, daysISO)

    if (rows.length === 0) {
      alert("Aucune commande trouvée pour cette sélection.")
      return
    }

    await generateClientPlanningPdf({
      client: { id: selectedClientId, nom: client.nom },
      secteurSelection: secteurLabel,
      semaine: weekNum,
      daysHeaders,
      userName: user?.prenom && user?.nom ? `${user.prenom} ${user.nom}` : user?.email || "Utilisateur",
      rows,
      services: selectedService ? [selectedService] : [],
    })

    setOpen(false)
  }

  const secteurs = [
    { label: "Étages", Icon: BedDouble },
    { label: "Cuisine", Icon: ChefHat },
    { label: "Salle", Icon: Utensils },
    { label: "Plonge", Icon: Droplets },
    { label: "Réception", Icon: ConciergeBell },
  ] as const

  const weekLabel = (w: string) => w.replace("-W", " / Semaine ")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#840404] hover:bg-[#6f0303] text-white" size="sm">
          <FileDown className="h-4 w-4 mr-2" />
          Générer planning client (PDF)
        </Button>
      </DialogTrigger>

      {/* POP-UP FIXE : pas de scroll global, seul scroll = liste clients */}
      <DialogContent className="w-[920px] max-w-[920px] h-[640px] max-h-[640px] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Générer planning client</DialogTitle>
        </DialogHeader>

        <div className="h-[560px] flex flex-col gap-5">
          {/* SECTEUR */}
          <div className="space-y-2">
            <Label>Secteur *</Label>
            <div className="grid grid-cols-5 gap-2">
              {secteurs.map(({ label, Icon }) => {
                const active = secteurLabel === label
                return (
                  <Button
                    key={label}
                    type="button"
                    variant={active ? "default" : "outline"}
                    className={cx(
                      "justify-center gap-2",
                      active && "bg-[#840404] hover:bg-[#6f0303] text-white"
                    )}
                    onClick={() => setSecteurLabel(label)}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* CLIENT (seul scroll) */}
          <div className="space-y-2 flex-1 flex flex-col min-h-0">
            <Label>Client *</Label>
            <Input
              placeholder="Recherche rapide client..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />

            <div className="rounded-md border bg-white flex-1 min-h-0">
              <div className="h-full overflow-y-auto">
                {filteredClients.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Aucun client trouvé.</div>
                ) : (
                  filteredClients.map((c) => {
                    const selected = c.id === selectedClientId
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={cx(
                          "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0",
                          selected && "bg-[#840404]/10"
                        )}
                        onClick={() => {
                          setSelectedClientId(c.id)
                          setSelectedService("")
                        }}
                      >
                        <div className="font-medium">{c.nom}</div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {selectedClient ? `Sélectionné : ${selectedClient.nom}` : "Aucun client sélectionné"}
            </div>
          </div>

          {/* SEMAINE (Select simple) + SERVICE (Select simple) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Semaine *</Label>
              <Select
                value={selectedWeek}
                onValueChange={(v) => setSelectedWeek(v)}
                disabled={!selectedClientId || availableWeeks.length === 0}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={!selectedClientId ? "Choisir un client d’abord" : "Choisir une semaine"} />
                </SelectTrigger>
                <SelectContent>
                  {availableWeeks.map((w) => (
                    <SelectItem key={w} value={w}>
                      {weekLabel(w)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service (optionnel)</Label>
              <Select
                value={selectedService}
                onValueChange={(v) => setSelectedService(v)}
                disabled={!selectedClientId || availableServices.length === 0}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={availableServices.length ? "Tous" : "Aucun service"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">Tous</SelectItem>
                  {availableServices.map((svc) => (
                    <SelectItem key={svc} value={svc}>
                      {svc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ACTIONS (toujours visibles, pas de scroll) */}
          <div className="flex justify-end pt-1">
            <Button
              className="bg-[#840404] hover:bg-[#6f0303] text-white"
              onClick={() => {
                // hack simple : "__ALL__" => "" pour la requête
                if (selectedService === "__ALL__") setSelectedService("")
                handleGeneratePDF()
              }}
              disabled={!selectedClientId || !selectedWeek}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Générer le PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
