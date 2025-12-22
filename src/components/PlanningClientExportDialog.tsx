import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { addDays, format, getISOWeek, getISOWeekYear, startOfWeek } from "date-fns"

import PlanningClientPreviewDialog from "@/components/commandes/PlanningClientPreviewDialog"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

export default function PlanningClientExportDialog() {
  const [open, setOpen] = useState(false)

  const [clients, setClients] = useState<ClientRow[]>([])
  const [secteurLabel, setSecteurLabel] = useState<string>("Étages")

  const [clientSearch, setClientSearch] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<string>("")

  const [availableWeeks, setAvailableWeeks] = useState<string[]>([])
  const [selectedWeek, setSelectedWeek] = useState<string>("")

  const [availableServices, setAvailableServices] = useState<string[]>([])
  const [selectedService, setSelectedService] = useState<string>("")

  // PREVIEW
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewPayload, setPreviewPayload] = useState<{
    clientId: string
    secteur: string
    service?: string | null
    semaineDate: string
  } | null>(null)

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

      const now = new Date()
      const cur = `${getISOWeekYear(now)}-W${String(getISOWeek(now)).padStart(2, "0")}`
      const next = uniq.includes(cur) ? cur : uniq[uniq.length - 1] || ""
      setSelectedWeek((prev) => (prev && uniq.includes(prev) ? prev : next))
    }

    loadWeeks()
  }, [selectedClientId, secteurLabel])

  const secteurs = [
    { label: "Étages", Icon: BedDouble },
    { label: "Cuisine", Icon: ChefHat },
    { label: "Salle", Icon: Utensils },
    { label: "Plonge", Icon: Droplets },
    { label: "Réception", Icon: ConciergeBell },
  ] as const

  const weekLabel = (w: string) => w.replace("-W", " / Semaine ")

  const canOpenPreview = Boolean(secteurLabel && selectedClientId && selectedWeek)

  const handleOpenPreview = () => {
    if (!canOpenPreview) return
    const { monday } = getWeekMeta(selectedWeek)
    const lundiISO = format(monday, "yyyy-MM-dd")

    setPreviewPayload({
      clientId: selectedClientId,
      secteur: secteurLabel,
      service: selectedService ? selectedService : null,
      semaineDate: lundiISO,
    })
    setPreviewOpen(true)
    setOpen(false)
  }

  return (
    <>
      {/* ====== BOUTON ====== */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-[#840404] hover:bg-[#6f0303] text-white" size="sm">
            <FileDown className="h-4 w-4 mr-2" />
            Générer planning client
          </Button>
        </DialogTrigger>

        {/* POP-UP */}
        <DialogContent className="w-[920px] max-w-[920px] h-[640px] max-h-[640px] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Générer planning client (aperçu)</DialogTitle>
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

            {/* SEMAINE + SERVICE */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Semaine *</Label>
                <Select
                  value={selectedWeek}
                  onValueChange={(v) => setSelectedWeek(v)}
                  disabled={!selectedClientId || availableWeeks.length === 0}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue
                      placeholder={
                        !selectedClientId ? "Choisir un client d'abord" : "Choisir une semaine"
                      }
                    />
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
                  value={selectedService || "__ALL__"}
                  onValueChange={(v) => setSelectedService(v === "__ALL__" ? "" : v)}
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

            {/* ACTIONS */}
            <div className="flex justify-end pt-1 gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>

              <Button
                className="bg-[#840404] hover:bg-[#6f0303] text-white"
                onClick={handleOpenPreview}
                disabled={!canOpenPreview}
              >
                Générer PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== FENETRE PREVIEW ====== */}
      {previewPayload && (
        <PlanningClientPreviewDialog
          open={previewOpen}
          onOpenChange={(v) => setPreviewOpen(v)}
          clientId={previewPayload.clientId}
          secteur={previewPayload.secteur}
          service={previewPayload.service}
          semaineDate={previewPayload.semaineDate}
        />
      )}
    </>
  )
}
