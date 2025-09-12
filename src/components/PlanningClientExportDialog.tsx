// src/components/PlanningClientExportDialog.tsx
import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addDays, format, startOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import {
  generateClientPlanningPdf,
  type CommandeMini,
  type PlanningClientInput,
  type DayHeader,
} from "@/lib/generateClientPlanningPdf"

// ——————————————————————————————————————————
// Données de test (remplacer par Supabase + UI réelles plus tard)
const SECTEURS = ["Étages", "Cuisine", "Salle", "Plonge", "Réception"] as const
const MOCK_CLIENTS = [
  "NOVOTEL LYON BRON",
  "PULLMAN PART-DIEU",
  "MARRIOTT CITE INTERNATIONALE",
  "RADISSON BLU BELLECOUR",
  "MERCURE VILLEURBANNE",
]
const MOCK_SERVICES = ["Restaurant", "Banquet", "Bar", "Petit-déjeuner", "Room Service"]

export default function PlanningClientExportDialog() {
  const [open, setOpen] = useState(false)

  const [secteur, setSecteur] = useState<string>("Cuisine")
  const [client, setClient] = useState<string>(MOCK_CLIENTS[0])
  const [clientSearch, setClientSearch] = useState<string>("")
  const [serviceSearch, setServiceSearch] = useState<string>("")
  const [services, setServices] = useState<string[]>(["Restaurant", "Banquet"])
  const [userName, setUserName] = useState<string>("Amaury Cotton") // pour footer

  const [semaineISO, setSemaineISO] = useState<string>(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    return format(monday, "yyyy-MM-dd")
  })

  // 10 semaines à partir de la semaine en cours
  const semaines = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 10 }).map((_, i) => {
      const monday = addDays(base, i * 7)
      const iso = format(monday, "yyyy-MM-dd")
      const lib = `Semaine ${format(monday, "I")} — ${format(monday, "dd/MM")} → ${format(
        addDays(monday, 6),
        "dd/MM"
      )}`
      return { value: iso, label: lib }
    })
  }, [])

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return MOCK_CLIENTS
    return MOCK_CLIENTS.filter((c) => c.toLowerCase().includes(q))
  }, [clientSearch])

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase()
    return MOCK_SERVICES.filter((s) => s.toLowerCase().includes(q))
  }, [serviceSearch])

  const toggleService = (s: string) => {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const buildDaysHeaders = (mondayISO: string): DayHeader[] => {
    const monday = new Date(mondayISO)
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(monday, i)
      return {
        date: format(d, "yyyy-MM-dd"),
        label: format(d, "EEE dd", { locale: fr }),
        dayName: format(d, "EEEE", { locale: fr }), // Lundi
        dayNum: format(d, "d", { locale: fr }), // 12
        monthShort: format(d, "LLL", { locale: fr }), // sept.
      }
    })
    return days
  }

  const onGenerate = () => {
    const monday = new Date(semaineISO)
    const days = buildDaysHeaders(semaineISO)
    const weekNum = Number(format(monday, "I", { locale: fr }))

    // Mocks cohérents (3 planifiés + 3 à pourvoir)
    const [svc1, svc2] = [services[0] || null, services[1] || services[0] || null]

    const cmds: CommandeMini[] = [
      {
        id: "c1",
        date: days[0].date,
        secteur,
        service: svc1,
        statut: "Validé",
        heure_debut_matin: "08:00",
        heure_fin_matin: "16:00",
        candidat: { id: "A", nom: "CAMARA", prenom: "Georges", telephone: "07 53 20 08 53" },
      },
      {
        id: "c2",
        date: days[2].date,
        secteur: secteur === "Cuisine" ? "Plonge" : secteur,
        service: svc2,
        statut: "Validé",
        heure_debut_soir: "17:00",
        heure_fin_soir: "23:00",
        candidat: { id: "B", nom: "CAMARA", prenom: "Salim", telephone: "07 58 77 68 58" },
      },
      {
        id: "c3",
        date: days[4].date,
        secteur,
        service: svc1,
        statut: "Validé",
        heure_debut_soir: "16:30",
        heure_fin_soir: "23:00",
        candidat: { id: "C", nom: "COTTON", prenom: "Amaury", telephone: "06 18 24 04 77" },
      },
      // À pourvoir (visibles)
      {
        id: "p1",
        date: days[1].date,
        secteur,
        service: svc1,
        statut: "En recherche",
        heure_debut_matin: "08:00",
        heure_fin_matin: "16:00",
        candidat: null,
      },
      {
        id: "p2",
        date: days[3].date,
        secteur: secteur === "Cuisine" ? "Plonge" : secteur,
        service: svc2,
        statut: "Non pourvue",
        heure_debut_soir: "17:00",
        heure_fin_soir: "23:00",
        candidat: null,
      },
      {
        id: "p3",
        date: days[6].date,
        secteur,
        service: svc1,
        statut: "Absence",
        heure_debut_soir: "17:00",
        heure_fin_soir: "23:00",
        candidat: null,
      },
      // Exclusions (ne s’affichent pas)
      {
        id: "x1",
        date: days[5].date,
        secteur,
        service: svc1,
        statut: "Annule ADA",
        heure_debut_matin: "08:00",
        heure_fin_matin: "16:00",
        candidat: null,
      },
      {
        id: "x2",
        date: days[0].date,
        secteur,
        service: svc1,
        statut: "Annule Int",
        heure_debut_soir: "17:00",
        heure_fin_soir: "23:00",
        candidat: null,
      },
    ]

    const payload: PlanningClientInput = {
      client: {
        id: "client-test",
        nom: client || "CLIENT TEST",
        secteurDemande: secteur,
        services,
        semaine: weekNum,
      },
      commandes: cmds,
      daysHeaders: days,
      userName,
    }

    generateClientPlanningPdf(payload)
    setOpen(false)
  }

  return (
    <>
      <Button className="bg-[#840404] text-white hover:bg-[#750303]" onClick={() => setOpen(true)}>
        Générer planning client (test)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Générer un planning client — Test</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Secteur */}
            <div className="grid grid-cols-3 gap-3 items-center">
              <Label>Secteur</Label>
              <div className="col-span-2">
                <Select value={secteur} onValueChange={setSecteur}>
                  <SelectTrigger><SelectValue placeholder="Secteur" /></SelectTrigger>
                  <SelectContent>
                    {SECTEURS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Semaine */}
            <div className="grid grid-cols-3 gap-3 items-center">
              <Label>Semaine</Label>
              <div className="col-span-2">
                <Select value={semaineISO} onValueChange={setSemaineISO}>
                  <SelectTrigger><SelectValue placeholder="Semaine" /></SelectTrigger>
                  <SelectContent>
                    {semaines.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Client — liste filtrable */}
            <div className="grid grid-cols-3 gap-3 items-start">
              <Label className="mt-2">Client</Label>
              <div className="col-span-2 space-y-2">
                <Input
                  placeholder="Rechercher un client…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
                <div className="max-h-40 overflow-auto border rounded">
                  {filteredClients.map((c) => (
                    <button
                      key={c}
                      onClick={() => setClient(c)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
                        client === c ? "bg-muted" : ""
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">Sélection actuelle : <span className="font-medium">{client}</span></div>
              </div>
            </div>

            {/* Services — liste filtrable + multi-sélection */}
            <div className="grid grid-cols-3 gap-3 items-start">
              <Label className="mt-2">Services</Label>
              <div className="col-span-2 space-y-2">
                <Input
                  placeholder="Filtrer les services…"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                />
                <div className="max-h-40 overflow-auto border rounded">
                  {filteredServices.map((s) => {
                    const active = services.includes(s)
                    return (
                      <button
                        key={s}
                        onClick={() => toggleService(s)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
                          active ? "bg-muted" : ""
                        }`}
                      >
                        {active ? "✓ " : ""}{s}
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => (
                    <span key={s} className="px-2 py-1 text-xs bg-muted rounded">{s}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Envoyé par */}
            <div className="grid grid-cols-3 gap-3 items-center">
              <Label>Envoyé par</Label>
              <Input className="col-span-2" value={userName} onChange={(e) => setUserName(e.target.value)} />
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
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
