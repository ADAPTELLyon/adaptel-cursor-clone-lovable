import { useEffect, useMemo, useState } from "react"
import { addDays, addWeeks, format, getISOWeek, getISOWeekYear, startOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Send, Check, ChevronDown } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { openMailMessage } from "@/lib/email/openMailMessage"
import { buildPlanningCandidatEmail, type PlanningCandidatItem } from "@/lib/email/buildPlanningCandidatEmail"

type EnvoyerPlanningCandidatDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SECTEURS = ["Étages", "Cuisine", "Salle", "Plonge", "Réception"] as const

type CandidatRow = {
  id: string
  nom: string | null
  prenom: string | null
  email: string | null
  secteurs?: string[] | null
}

function norm(str: string) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function getIsoYearWeekKey(date: Date) {
  const year = getISOWeekYear(date)
  const week = getISOWeek(date)
  return `${year}-${String(week).padStart(2, "0")}`
}

function mondayOfIsoKey(key: string) {
  const [yStr, wStr] = key.split("-")
  const isoYear = Number(yStr)
  const isoWeek = Number(wStr)
  if (!Number.isFinite(isoYear) || !Number.isFinite(isoWeek)) {
    return startOfWeek(new Date(), { weekStartsOn: 1 })
  }
  const fourthJan = new Date(isoYear, 0, 4)
  const firstMonday = startOfWeek(fourthJan, { weekStartsOn: 1 })
  return addDays(firstMonday, (isoWeek - 1) * 7)
}

export default function EnvoyerPlanningCandidatDialog({
  open,
  onOpenChange,
}: EnvoyerPlanningCandidatDialogProps) {
  const [secteur, setSecteur] = useState<string>("")
  const [semaineKey, setSemaineKey] = useState<string>("")
  const [searchCandidat, setSearchCandidat] = useState("")
  const [candidatId, setCandidatId] = useState<string>("")
  const [missingField, setMissingField] = useState<string | null>(null)
  const [semaineSelectOpen, setSemaineSelectOpen] = useState(false)

  const [candidats, setCandidats] = useState<CandidatRow[]>([])
  const [loadingCandidats, setLoadingCandidats] = useState(false)
  const [buildingMail, setBuildingMail] = useState(false)

  const CONTENT_W = "w-[582px]"

  useEffect(() => {
    if (!open) return
    setSecteur("")
    setSemaineKey("")
    setSearchCandidat("")
    setCandidatId("")
    setCandidats([])
    setLoadingCandidats(false)
    setMissingField(null)
    setSemaineSelectOpen(false)
    setBuildingMail(false)
  }, [open])

  const semainesRange = useMemo(() => {
    const baseMonday = startOfWeek(new Date(), { weekStartsOn: 1 })
    const entries = Array.from({ length: 6 }, (_, i) => {
      const d = addWeeks(baseMonday, i - 2)
      return { year: getISOWeekYear(d), week: getISOWeek(d) }
    })

    const map = new Map<number, number[]>()
    for (const e of entries) {
      const arr = map.get(e.year) ?? []
      if (!arr.includes(e.week)) arr.push(e.week)
      map.set(e.year, arr)
    }

    return Array.from(map.entries())
      .map(([year, weeks]) => ({ year, weeks: weeks.sort((a, b) => a - b) }))
      .sort((a, b) => a.year - b.year)
  }, [])

  const weekOptions = useMemo(() => {
    const out: Array<{ key: string; label: string; weekNum: number; weekPart: string; datePart: string }> = []

    const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
    const fmtShort = (d: Date) => cap(format(d, "EEE d MMM", { locale: fr }))

    semainesRange.forEach(({ year, weeks }) => {
      weeks.forEach((w) => {
        const key = `${year}-${String(w).padStart(2, "0")}`
        const mon = mondayOfIsoKey(key)
        const sun = addDays(mon, 6)
        const weekPart = `Semaine ${w}`
        const datePart = `${fmtShort(mon)} au ${fmtShort(sun)}`
        const label = `${weekPart} - ${datePart}`
        out.push({ key, label, weekNum: w, weekPart, datePart })
      })
    })

    return out
  }, [semainesRange])

  useEffect(() => {
    const run = async () => {
      if (!open) return
      setLoadingCandidats(true)

      try {
        const { data: d1, error: e1 } = await supabase
          .from("candidats")
          .select("id, nom, prenom, email, secteurs, actif")
          .eq("actif", true)
          .order("nom", { ascending: true })
          .limit(2000)

        if (!e1 && Array.isArray(d1)) {
          let rows = d1 as unknown as CandidatRow[]

          if (secteur) {
            const wanted = norm(secteur)
            rows = rows.filter((r) => {
              const arr = Array.isArray(r.secteurs) ? r.secteurs : []
              return arr.map(norm).includes(wanted)
            })
          }

          setCandidats(rows)
          setCandidatId((prev) => (prev && rows.some((c) => c.id === prev) ? prev : ""))
          return
        }

        const { data: d2, error: e2 } = await supabase
          .from("candidats")
          .select("id, nom, prenom, email")
          .order("nom", { ascending: true })
          .limit(2000)

        if (e2) throw e2

        const rows2 = (d2 || []) as unknown as CandidatRow[]
        setCandidats(rows2)
        setCandidatId((prev) => (prev && rows2.some((c) => c.id === prev) ? prev : ""))
      } catch {
        setCandidats([])
        setCandidatId("")
      } finally {
        setLoadingCandidats(false)
      }
    }

    run()
  }, [open, secteur])

  const filteredCandidats = useMemo(() => {
    const s = searchCandidat.trim().toLowerCase()
    if (!s) return candidats
    return candidats.filter((c) => {
      const label = `${c.nom ?? ""} ${c.prenom ?? ""}`.trim().toLowerCase()
      return label.includes(s)
    })
  }, [candidats, searchCandidat])

  const candidatLabel = useMemo(() => {
    const c = candidats.find((x) => x.id === candidatId)
    if (!c) return ""
    return `${c.nom ?? ""} ${c.prenom ?? ""}`.trim()
  }, [candidats, candidatId])

  const semaineBadgeLabel = useMemo(() => {
    if (!semaineKey) return ""
    const parts = semaineKey.split("-")
    if (parts.length !== 2) return ""
    const w = Number(parts[1])
    if (!Number.isFinite(w)) return ""
    return `Semaine ${w}`
  }, [semaineKey])

  const selectedSemaineOption = useMemo(() => {
    return weekOptions.find((o) => o.key === semaineKey)
  }, [semaineKey, weekOptions])

  const canAction = Boolean(secteur && semaineKey && candidatId) && !loadingCandidats && !buildingMail

  const validateAndAction = (action: "envoyer" | "message") => {
    setMissingField(null)

    if (!secteur) {
      setMissingField("secteur")
      return
    }
    if (!semaineKey) {
      setMissingField("semaine")
      return
    }
    if (!candidatId) {
      setMissingField("candidat")
      return
    }

    if (action === "message") {
      handleMessage()
    } else {
      handleEnvoyer()
    }
  }

  const handleAnnuler = () => onOpenChange(false)

  const handleEnvoyer = () => {
    // TODO: envoi réel
  }

  // Ferme la dropdown si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (semaineSelectOpen && !(e.target as Element).closest(".semaine-select-container")) {
        setSemaineSelectOpen(false)
      }
    }

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [semaineSelectOpen])

  const renderSelectedSemaine = () => {
    if (!selectedSemaineOption) {
      return <span className="text-gray-500">— Sélectionner une semaine —</span>
    }

    return (
      <div className="truncate">
        <span className="font-semibold">{selectedSemaineOption.weekPart}</span> - {selectedSemaineOption.datePart}
      </div>
    )
  }

  const fetchPlanningItems = async (cId: string, mondayISO: string): Promise<PlanningCandidatItem[]> => {
    const mon = new Date(`${mondayISO}T00:00:00`)
    const sun = addDays(mon, 6)
    const sunISO = format(sun, "yyyy-MM-dd")

    // 1) Tentative via planification + join commandes + clients
    try {
      const { data, error } = await supabase
        .from("planification")
        .select(
          `
          date,
          secteur,
          heure_debut_matin, heure_fin_matin,
          heure_debut_soir, heure_fin_soir,
          heure_debut_nuit, heure_fin_nuit,
          commandes:commande_id (
            service,
            client:client_id ( nom, adresse, code_postal, ville )
          )
        `
        )
        .eq("candidat_id", cId)
        .gte("date", mondayISO)
        .lte("date", sunISO)

      if (!error && Array.isArray(data)) {
        return (data as any[]).map((r) => {
          const client = r?.commandes?.client
          return {
            dateISO: r.date,
            clientNom: client?.nom ?? null,
            secteur: r.secteur ?? null,
            service: r?.commandes?.service ?? null,
            heure_debut_matin: r.heure_debut_matin ?? null,
            heure_fin_matin: r.heure_fin_matin ?? null,
            heure_debut_soir: r.heure_debut_soir ?? null,
            heure_fin_soir: r.heure_fin_soir ?? null,
            heure_debut_nuit: r.heure_debut_nuit ?? null,
            heure_fin_nuit: r.heure_fin_nuit ?? null,
            adresse: client?.adresse ?? null,
            code_postal: client?.code_postal ?? null,
            ville: client?.ville ?? null,
          }
        })
      }
    } catch {
      // on passe au fallback
    }

    // 2) Fallback via commandes (si planification/join foire)
    const { data: data2 } = await supabase
      .from("commandes")
      .select(
        `
        date,
        secteur,
        service,
        heure_debut_matin, heure_fin_matin,
        heure_debut_soir, heure_fin_soir,
        heure_debut_nuit, heure_fin_nuit,
        clients:client_id ( nom, adresse, code_postal, ville )
      `
      )
      .eq("candidat_id", cId)
      .gte("date", mondayISO)
      .lte("date", sunISO)

    if (!Array.isArray(data2)) return []

    return (data2 as any[]).map((r) => {
      const client = r?.clients
      return {
        dateISO: r.date,
        clientNom: client?.nom ?? null,
        secteur: r.secteur ?? null,
        service: r.service ?? null,
        heure_debut_matin: r.heure_debut_matin ?? null,
        heure_fin_matin: r.heure_fin_matin ?? null,
        heure_debut_soir: r.heure_debut_soir ?? null,
        heure_fin_soir: r.heure_fin_soir ?? null,
        heure_debut_nuit: r.heure_debut_nuit ?? null,
        heure_fin_nuit: r.heure_fin_nuit ?? null,
        adresse: client?.adresse ?? null,
        code_postal: client?.code_postal ?? null,
        ville: client?.ville ?? null,
      }
    })
  }

  const handleMessage = async () => {
    if (!secteur || !semaineKey || !candidatId) return

    const cand = candidats.find((c) => c.id === candidatId)
    const to = cand?.email?.trim() || ""
    const prenom = (cand?.prenom || "").trim()

    if (!to) {
      setMissingField("candidat")
      return
    }

    try {
      setBuildingMail(true)

      const monday = mondayOfIsoKey(semaineKey)
      const mondayISO = format(monday, "yyyy-MM-dd")

      const weekNum = Number(semaineKey.split("-")[1])
      const items = await fetchPlanningItems(candidatId, mondayISO)

      // IMPORTANT : on garde uniquement le secteur sélectionné (cohérent avec l’écran)
      const itemsFiltered = items.filter((x) => (x.secteur || "") === secteur)

      const { subject, body } = buildPlanningCandidatEmail({
        prenom: prenom || "Bonjour",
        weekNumber: Number.isFinite(weekNum) ? weekNum : getISOWeek(monday),
        mondayISO,
        items: itemsFiltered,
      })

      openMailMessage({ to, subject, body })
      onOpenChange(false)
    } finally {
      setBuildingMail(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[720px] max-w-[720px] h-[720px] max-h-[720px] p-0 overflow-hidden bg-gray-50">
        <div className="p-6 h-full flex flex-col">
          {/* Header */}
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2 mb-2">
              <Send className="h-5 w-5 text-[#8a0000]" />
              Envoyer planning candidat
            </DialogTitle>

            {/* Zone badges - 3 sur la même ligne */}
            <div className="h-[44px] mb-2 flex items-center gap-2">
              {/* Secteur */}
              <div
                className={cn(
                  "w-[140px] h-8 rounded-lg flex items-center justify-center",
                  secteur ? "bg-[#8a0000]" : "bg-gray-200"
                )}
              >
                {secteur ? (
                  <span className="text-sm font-semibold text-white truncate px-2">{secteur}</span>
                ) : (
                  <span className="text-sm text-gray-500">Secteur</span>
                )}
              </div>

              {/* Semaine */}
              <div
                className={cn(
                  "w-[140px] h-8 rounded-lg flex items-center justify-center",
                  semaineKey ? "bg-[#8a0000]" : "bg-gray-200"
                )}
              >
                {semaineKey ? (
                  <span className="text-sm font-semibold text-white truncate px-2">{semaineBadgeLabel}</span>
                ) : (
                  <span className="text-sm text-gray-500">Semaine</span>
                )}
              </div>

              {/* Candidat */}
              <div
                className={cn(
                  "w-[280px] h-8 rounded-lg flex items-center justify-center",
                  candidatLabel ? "bg-[#8a0000]" : "bg-gray-200"
                )}
              >
                {candidatLabel ? (
                  <span className="text-sm font-semibold text-white truncate px-2">{candidatLabel}</span>
                ) : (
                  <span className="text-sm text-gray-500">Candidat</span>
                )}
              </div>
            </div>
          </DialogHeader>

          <Separator className="mb-6" />

          {/* Body */}
          <div className="flex-1 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 h-full flex flex-col gap-6 items-center">
              {/* Secteur */}
              <div className={cn("space-y-3", CONTENT_W)}>
                <div className="flex items-center gap-2">
                  <div className={cn("text-sm font-semibold text-gray-800", missingField === "secteur" && "text-red-600")}>
                    Secteur
                  </div>
                  {secteur && <Check className="h-4 w-4 text-green-600" />}
                </div>
                <div className={cn("flex gap-2", CONTENT_W)}>
                  {SECTEURS.map((s) => {
                    const active = secteur === s
                    const missing = missingField === "secteur"
                    return (
                      <Button
                        key={s}
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-9 w-[110px] rounded-lg text-sm font-medium px-2 transition-all",
                          active
                            ? "bg-[#8a0000] hover:bg-[#8a0000]/90 text-white"
                            : missing && !secteur
                              ? "border-red-300"
                              : "hover:bg-gray-50"
                        )}
                        onClick={() => {
                          setSecteur((prev) => (prev === s ? "" : s))
                          setMissingField(null)
                        }}
                      >
                        {s}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Semaine - Custom Select */}
              <div className={cn("space-y-3", CONTENT_W)}>
                <div className="flex items-center gap-2">
                  <div className={cn("text-sm font-semibold text-gray-800", missingField === "semaine" && "text-red-600")}>
                    Semaine
                  </div>
                  {semaineKey && <Check className="h-4 w-4 text-green-600" />}
                </div>

                <div className="semaine-select-container relative">
                  <button
                    type="button"
                    className={cn(
                      "w-full h-9 rounded-lg border px-3 py-2 text-sm text-left flex items-center justify-between",
                      "bg-white transition-colors",
                      semaineKey ? "border-[#8a0000]" : "border-gray-300",
                      missingField === "semaine" && !semaineKey && "border-red-300"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSemaineSelectOpen(!semaineSelectOpen)
                    }}
                  >
                    <div className="flex-1 overflow-hidden">{renderSelectedSemaine()}</div>
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform flex-shrink-0", semaineSelectOpen && "transform rotate-180")}
                    />
                  </button>

                  {semaineSelectOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {weekOptions.map((option) => {
                        const selected = option.key === semaineKey
                        return (
                          <button
                            key={option.key}
                            type="button"
                            className={cn("w-full text-left px-3 py-2 hover:bg-gray-50 text-sm", selected && "bg-[#8a0000]/10")}
                            onClick={() => {
                              setSemaineKey(option.key)
                              setMissingField(null)
                              setSemaineSelectOpen(false)
                            }}
                          >
                            <div className="flex">
                              <span className="font-semibold">{option.weekPart}</span>
                              <span className="ml-1">- {option.datePart}</span>
                              {selected && <div className="ml-auto text-[#8a0000]">✓</div>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Candidat */}
              <div className={cn("space-y-3", CONTENT_W)}>
                <div className="flex items-center gap-2">
                  <div className={cn("text-sm font-semibold text-gray-800", missingField === "candidat" && "text-red-600")}>
                    Candidat
                  </div>
                  {candidatId && <Check className="h-4 w-4 text-green-600" />}
                </div>

                <Input
                  placeholder="Rechercher..."
                  value={searchCandidat}
                  onChange={(e) => setSearchCandidat(e.target.value)}
                  className={cn(
                    "border-gray-300 focus:ring-2 focus:ring-[#8a0000]/20 focus:border-[#8a0000]",
                    CONTENT_W,
                    missingField === "candidat" && !candidatId && "border-red-300"
                  )}
                />

                <div className={cn("border border-gray-200 rounded-lg overflow-hidden bg-white", CONTENT_W)}>
                  <div className="h-[200px] overflow-auto">
                    {loadingCandidats ? (
                      <div className="p-3 text-sm text-gray-500 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Chargement...
                      </div>
                    ) : filteredCandidats.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500">Aucun candidat.</div>
                    ) : (
                      <div className="divide-y">
                        {filteredCandidats.map((c) => {
                          const label = `${c.nom ?? ""} ${c.prenom ?? ""}`.trim() || "Candidat"
                          const selected = candidatId === c.id
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setCandidatId(c.id)
                                setMissingField(null)
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm transition-all",
                                selected
                                  ? "bg-[#8a0000]/10 border-l-3 border-l-[#8a0000]"
                                  : missingField === "candidat"
                                    ? "bg-red-50 hover:bg-red-100"
                                    : "hover:bg-gray-50"
                              )}
                            >
                              <div className="flex items-center">
                                <div className={cn("h-2 w-2 rounded-full mr-3", selected ? "bg-[#8a0000]" : "bg-gray-300")} />
                                <div className="font-medium text-gray-900 truncate flex-1">{label}</div>
                                {selected && <div className="text-xs text-[#8a0000] font-medium ml-2">✓</div>}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Footer */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="h-10 rounded-lg border-gray-300 hover:bg-gray-50" onClick={handleAnnuler}>
              Annuler
            </Button>

            <Button
              variant="outline"
              className={cn("h-10 rounded-lg", "border-[#8a0000] text-[#8a0000] hover:bg-[#8a0000]/10 hover:border-[#8a0000]")}
              onClick={() => validateAndAction("envoyer")}
              disabled={buildingMail}
            >
              Envoyer
            </Button>

            <Button
              className={cn("h-10 rounded-lg bg-[#8a0000] hover:bg-[#7a0000] text-white")}
              onClick={() => validateAndAction("message")}
              disabled={!canAction}
            >
              {buildingMail ? "Préparation..." : "Message"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
