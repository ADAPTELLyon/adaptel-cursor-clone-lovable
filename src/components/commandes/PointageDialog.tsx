import { useEffect, useMemo, useState } from "react"
import { format, startOfWeek, addDays, addWeeks, getISOWeek, getISOWeekYear } from "date-fns"
import { fr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileText, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { generatePointagePdf } from "@/lib/pointage/generatePointagePdf"

type PointageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  semainesDisponibles?: Array<{ year: number; weeks: number[] }>
  defaultSemaine?: string
}

const SECTEURS = ["Étages", "Cuisine", "Salle", "Plonge", "Réception"] as const

function getMondayOfWeek(weekStr: string) {
  const week = Number(weekStr)
  if (!Number.isFinite(week) || week <= 0) return startOfWeek(new Date(), { weekStartsOn: 1 })

  // Toujours année courante (comportement existant). OK car on limite aux semaines proches.
  const now = new Date()
  const y = now.getFullYear()
  const jan4 = new Date(y, 0, 4)
  const jan4Monday = startOfWeek(jan4, { weekStartsOn: 1 })
  // ISO week number du lundi de jan4Monday
  const baseWeek = getISOWeek(jan4Monday)
  const target = addDays(jan4Monday, (week - baseWeek) * 7)
  return startOfWeek(target, { weekStartsOn: 1 })
}

// Normalisation robuste (accents / casse / espaces)
function norm(str: string) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export default function PointageDialog({
  open,
  onOpenChange,
  semainesDisponibles,
  defaultSemaine,
}: PointageDialogProps) {
  // Secteurs multi + aucun sélectionné à l'ouverture
  const [secteurs, setSecteurs] = useState<string[]>([])

  const [client, setClient] = useState("")
  const [searchClient, setSearchClient] = useState("")

  // ✅ MODIF: aucune semaine sélectionnée par défaut
  const [semaine, setSemaine] = useState<string>("")

  // 7 jours lun..dim
  const [selectedDays, setSelectedDays] = useState<boolean[]>([true, true, true, true, true, true, true])

  // Clients depuis Supabase (noms uniquement) filtrés par secteurs
  const [clients, setClients] = useState<string[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)

  // Services depuis clients.services (text[])
  const [servicesClient, setServicesClient] = useState<string[]>([])
  const [servicesSelected, setServicesSelected] = useState<string[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)

  // Génération PDF
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!open) return
    setSecteurs([])
    setClient("")
    setSearchClient("")
    setClients([])
    setClientsLoading(false)
    setServicesClient([])
    setServicesSelected([])
    setServicesLoading(false)
    setGenerating(false)

    // ✅ MODIF: on ne présélectionne PAS la semaine
    setSemaine("")

    setSelectedDays([true, true, true, true, true, true, true])
  }, [open, defaultSemaine])

  // ✅ MODIF: liste semaines limitée à S-2 -> S+3, groupée par année
  const semainesRange = useMemo(() => {
    const baseMonday = startOfWeek(new Date(), { weekStartsOn: 1 })
    const entries = Array.from({ length: 6 }, (_, i) => {
      const d = addWeeks(baseMonday, i - 2) // -2, -1, 0, +1, +2, +3
      return {
        year: getISOWeekYear(d),
        week: getISOWeek(d),
      }
    })

    const map = new Map<number, number[]>()
    for (const e of entries) {
      const arr = map.get(e.year) ?? []
      if (!arr.includes(e.week)) arr.push(e.week)
      map.set(e.year, arr)
    }

    const out = Array.from(map.entries())
      .map(([year, weeks]) => ({ year, weeks: weeks.sort((a, b) => a - b) }))
      .sort((a, b) => a.year - b.year)

    return out
  }, [])

  const monday = useMemo(() => getMondayOfWeek(semaine), [semaine])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday])

  const selectedDatesISO = useMemo(() => {
    return days
      .filter((_, i) => selectedDays[i])
      .map((d) => format(d, "yyyy-MM-dd"))
  }, [days, selectedDays])

  const toggleSecteur = (s: string) => {
    setSecteurs((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const toggleService = (s: string) => {
    setServicesSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const toggleDay = (idx: number) => {
    setSelectedDays((prev) => {
      const next = [...prev]
      next[idx] = !next[idx]
      return next
    })
  }

  const applyPreset = (preset: "all" | "weekend" | "none") => {
    if (preset === "all") setSelectedDays([true, true, true, true, true, true, true])
    if (preset === "weekend") setSelectedDays([false, false, false, false, false, true, true])
    if (preset === "none") setSelectedDays([false, false, false, false, false, false, false])
  }

  // FIX robuste : récupère TOUS les clients et filtre côté front (accents/casse)
  useEffect(() => {
    const run = async () => {
      if (!open) return

      if (secteurs.length === 0) {
        setClients([])
        setClient("")
        return
      }

      setClientsLoading(true)
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("nom, secteurs")
          .order("nom", { ascending: true })
          .limit(2000)

        if (error) throw error

        const wanted = secteurs.map(norm)

        const filtered = (data || [])
          .filter((row: any) => {
            const nom = row?.nom
            if (!nom) return false

            const secArr = Array.isArray(row?.secteurs) ? (row.secteurs as string[]) : []
            const secNorm = secArr.map(norm)
            return wanted.some((w) => secNorm.includes(w))
          })
          .map((row: any) => row.nom as string)

        const unique = Array.from(new Set(filtered)).sort((a, b) => a.localeCompare(b, "fr"))
        setClients(unique)

        setClient((prev) => (prev && unique.includes(prev) ? prev : ""))
      } catch {
        setClients([])
        setClient("")
      } finally {
        setClientsLoading(false)
      }
    }
    run()
  }, [secteurs, open])

  // Charge services du client sélectionné
  useEffect(() => {
    const run = async () => {
      if (!open) return
      if (!client) {
        setServicesClient([])
        setServicesSelected([])
        return
      }
      setServicesLoading(true)
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("services")
          .eq("nom", client)
          .maybeSingle()

        if (error) throw error

        const list = (data?.services ?? []) as string[]
        const clean = Array.isArray(list) ? list.filter(Boolean) : []
        setServicesClient(clean)
        setServicesSelected((prev) => prev.filter((s) => clean.includes(s)))
      } catch {
        setServicesClient([])
        setServicesSelected([])
      } finally {
        setServicesLoading(false)
      }
    }
    run()
  }, [client, open])

  // ✅ MODIF: on exige que l'user sélectionne une semaine
  const canGenerate = client && semaine && selectedDatesISO.length > 0 && !generating

  const titleSuffix = useMemo(() => {
    const parts: string[] = []
    if (client) parts.push(client)
    if (secteurs.length > 0) parts.push(secteurs.join(", "))
    if (client && servicesClient.length > 0) {
      parts.push(servicesSelected.length > 0 ? servicesSelected.join(", ") : "Tous services")
    }
    return parts.length ? " — " + parts.join(" • ") : ""
  }, [client, secteurs, servicesClient.length, servicesSelected])

  const handleGenerate = async () => {
    if (!client) return
    if (!semaine) return
    if (selectedDatesISO.length === 0) return

    const payload = {
      secteurs,
      client,
      services: servicesSelected, // [] => tous
      semaine,
      datesISO: selectedDatesISO,
    }

    try {
      setGenerating(true)
      await generatePointagePdf(payload)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[1180px] max-w-[1180px] h-[860px] max-h-[860px] p-0 overflow-hidden bg-gray-50">
        <div className="p-6 h-full flex flex-col">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#840404]" />
              Feuilles de pointage{titleSuffix}
            </DialogTitle>
          </DialogHeader>

          <Separator className="my-4" />

          <div className="flex-1 grid gap-5" style={{ gridTemplateColumns: "520px 1fr" }}>
            {/* LEFT */}
            <div className="h-full rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="p-4 h-full flex flex-col gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-800">Secteurs</div>
                  <div className="grid grid-cols-5 gap-2">
                    {SECTEURS.map((s) => {
                      const active = secteurs.includes(s)
                      return (
                        <Button
                          key={s}
                          variant={active ? "default" : "outline"}
                          className={cn(
                            "h-9 rounded-lg text-sm font-medium px-2",
                            active ? "bg-[#840404] hover:bg-[#840404]/90" : "hover:bg-gray-50"
                          )}
                          onClick={() => toggleSecteur(s)}
                        >
                          {s}
                        </Button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-800">Client</div>

                  <Input
                    placeholder="Rechercher..."
                    value={searchClient}
                    onChange={(e) => setSearchClient(e.target.value)}
                    disabled={secteurs.length === 0}
                    className="w-full border-gray-300 focus:ring-2 focus:ring-[#840404]/20 focus:border-[#840404]"
                  />

                  <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <div className="h-[250px] overflow-auto">
                      {secteurs.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">
                          Sélectionne un secteur pour afficher les clients.
                        </div>
                      ) : clientsLoading ? (
                        <div className="p-3 text-sm text-gray-500">Chargement...</div>
                      ) : clients.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">Aucun client pour ce secteur.</div>
                      ) : (
                        <div className="divide-y">
                          {clients
                            .filter((nom) =>
                              searchClient.trim()
                                ? nom.toLowerCase().includes(searchClient.trim().toLowerCase())
                                : true
                            )
                            .map((nom) => {
                              const selected = client === nom
                              return (
                                <button
                                  key={nom}
                                  type="button"
                                  onClick={() => setClient(nom)}
                                  className={cn(
                                    "w-full text-left px-3 py-2 text-sm transition",
                                    selected ? "bg-[#840404]/10" : "hover:bg-gray-50"
                                  )}
                                >
                                  <div className="font-medium text-gray-900 truncate">{nom}</div>
                                </button>
                              )
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-800">Service</div>

                  {!client ? (
                    <div className="w-full text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-3">
                      Sélectionne d’abord un client.
                    </div>
                  ) : servicesLoading ? (
                    <div className="w-full text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-3">
                      Chargement des services...
                    </div>
                  ) : servicesClient.length === 0 ? (
                    <div className="w-full text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-3">
                      Aucun service pour ce client.
                    </div>
                  ) : (
                    <div className="w-full border border-gray-200 rounded-lg bg-white p-3">
                      <div className="max-h-[110px] overflow-auto flex flex-wrap gap-2">
                        {servicesClient.map((s) => {
                          const active = servicesSelected.includes(s)
                          return (
                            <Button
                              key={s}
                              type="button"
                              variant={active ? "default" : "outline"}
                              className={cn(
                                "h-8 rounded-lg text-sm font-medium px-3",
                                active ? "bg-[#840404] hover:bg-[#840404]/90" : "hover:bg-gray-50"
                              )}
                              onClick={() => toggleService(s)}
                              title={s}
                            >
                              {s}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-800">Semaine</div>

                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm border-gray-300 bg-white"
                    value={semaine}
                    onChange={(e) => setSemaine(e.target.value)}
                  >
                    {/* ✅ MODIF: placeholder + aucune sélection */}
                    <option value="" disabled>
                      — Sélectionner une semaine —
                    </option>

                    {/* ✅ MODIF: liste limitée (S-2 → S+3) groupée par année */}
                    {semainesRange.map(({ year, weeks }) => (
                      <optgroup key={year} label={`Année ${year}`}>
                        {weeks.map((w) => (
                          <option key={`${year}-${w}`} value={w.toString()}>
                            Semaine {w}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  <div className="text-xs text-gray-500">
                    Du {format(days[0], "EEEE d MMMM yyyy", { locale: fr })} au{" "}
                    {format(days[6], "EEEE d MMMM yyyy", { locale: fr })}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="h-full rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="p-4 h-full flex flex-col gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-800">Sélection rapide</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="h-9 rounded-lg hover:bg-gray-50"
                      onClick={() => applyPreset("all")}
                    >
                      Semaine complète
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 rounded-lg hover:bg-gray-50"
                      onClick={() => applyPreset("weekend")}
                    >
                      Week-end
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-9 rounded-lg border border-gray-200 hover:bg-gray-50"
                      onClick={() => applyPreset("none")}
                    >
                      Réinitialiser
                    </Button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-2">
                  {days.map((d, idx) => {
                    const isOn = selectedDays[idx]
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={cn(
                          "border rounded-xl px-4 py-2 text-left transition flex items-center justify-between shadow-sm flex-1",
                          isOn ? "bg-[#840404]/10 border-[#840404]/30" : "bg-white border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 capitalize">
                            {format(d, "EEEE", { locale: fr })}
                          </div>
                          <div className="text-xs text-gray-600">
                            {format(d, "d MMMM yyyy", { locale: fr })}
                          </div>
                        </div>

                        <div
                          className={cn(
                            "h-6 w-10 rounded-full border flex items-center px-1 transition shrink-0",
                            isOn ? "bg-[#840404] border-[#840404]" : "bg-gray-100 border-gray-200"
                          )}
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded-full bg-white transition",
                              isOn ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-5" />

          <div className="grid gap-5" style={{ gridTemplateColumns: "520px 1fr" }}>
            <div />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-lg"
                onClick={() => onOpenChange(false)}
                disabled={generating}
              >
                Fermer
              </Button>

              <Button
                className={cn(
                  "h-10 rounded-lg bg-[#840404] hover:bg-[#750303] text-white flex items-center gap-2",
                  !canGenerate ? "opacity-60 cursor-not-allowed" : ""
                )}
                disabled={!canGenerate}
                onClick={handleGenerate}
                title={
                  !client
                    ? "Sélectionne un client"
                    : !semaine
                      ? "Sélectionne une semaine"
                      : selectedDatesISO.length === 0
                        ? "Sélectionne au moins une journée"
                        : "Générer le PDF"
                }
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {generating ? "Génération..." : "Générer le PDF"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
