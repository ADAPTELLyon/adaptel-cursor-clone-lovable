import { useEffect, useMemo, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Car, X } from "lucide-react"
import { Icon } from "@iconify/react"
import { supabase } from "@/lib/supabase"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"

type CandidatMini = {
  id: string
  nom: string
  prenom: string
  vehicule?: boolean
  interditClient?: boolean
  prioritaire?: boolean
  dejaPlanifie?: boolean
  dejaTravaille?: boolean
}

function normalizeStatut(s?: string | null) {
  if (!s) return ""
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
}

export function PlanifCandidatsCreationPopover({
  trigger,
  secteur,
  clientId,
  date,            // yyyy-MM-dd
  nbPersonnes,
  heures,          // { debutMatin, finMatin, debutSoir, finSoir }
  value,           // string[] ids length = nbPersonnes
  onChange,
}: {
  trigger: React.ReactNode
  secteur: string
  clientId: string
  date: string
  nbPersonnes: number
  heures: { debutMatin?: string; finMatin?: string; debutSoir?: string; finSoir?: string }
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const { data: candidats = [] } = useCandidatsBySecteur(secteur)

  // une barre de recherche par liste
  const [searchBySlot, setSearchBySlot] = useState<string[]>([])
  useEffect(() => {
    setSearchBySlot((prev) => {
      const copy = prev.slice(0, nbPersonnes)
      while (copy.length < nbPersonnes) copy.push("")
      return copy
    })
  }, [nbPersonnes])

  const [filteredBase, setFilteredBase] = useState<CandidatMini[]>([])

  useEffect(() => {
    if (!open || candidats.length === 0 || !secteur || !date) return

    const run = async () => {
      const jour = date.slice(0, 10)
      const ids = candidats.map((c) => c.id)

      // Interdictions / Priorités
      const { data: ipData } = await supabase
        .from("interdictions_priorites")
        .select("candidat_id, type")
        .eq("client_id", clientId)

      const interditSet = new Set(ipData?.filter((i) => i.type === "interdiction").map((i) => i.candidat_id))
      const prioritaireSet = new Set(ipData?.filter((i) => i.type === "priorite").map((i) => i.candidat_id))

      // A déjà travaillé pour ce client
      const { data: dejaData } = await supabase
        .from("commandes")
        .select("candidat_id")
        .eq("client_id", clientId)
      const dejaTravailleSet = new Set((dejaData || []).map((c) => c.candidat_id).filter(Boolean))

      // Disponibilités jour
      const { data: dispoData } = await supabase
        .from("disponibilites")
        .select("candidat_id, statut, dispo_matin, dispo_soir")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", ids)
      type DispoRow = { candidat_id: string; statut: string | null; dispo_matin: boolean | null; dispo_soir: boolean | null }
      const dispoMap = new Map<string, DispoRow>()
      ;(dispoData || []).forEach((d: any) => dispoMap.set(d.candidat_id, d as DispoRow))

      // Occupations réelles (COMMANDES Validé)
      const { data: occData } = await supabase
        .from("commandes")
        .select("candidat_id, statut, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
        .eq("secteur", secteur)
        .eq("date", jour)
        .in("candidat_id", ids)
        .in("statut", ["Validé"])
      const occMap = new Map<string, { matin: boolean; soir: boolean }>()
      const mark = (id: string, which: "matin" | "soir") => {
        const prev = occMap.get(id) || { matin: false, soir: false }
        prev[which] = true
        occMap.set(id, prev)
      }
      ;(occData || []).forEach((r: any) => {
        if (r.heure_debut_matin && r.heure_fin_matin) mark(r.candidat_id, "matin")
        if (r.heure_debut_soir && r.heure_fin_soir) mark(r.candidat_id, "soir")
      })

      const isCoupure =
        !!heures?.debutMatin && !!heures?.finMatin && !!heures?.debutSoir && !!heures?.finSoir
      const chercheMatin =
        !!heures?.debutMatin && !!heures?.finMatin && !heures?.debutSoir
      const chercheSoir =
        !!heures?.debutSoir && !!heures?.finSoir && !heures?.debutMatin

      const list = (candidats as any[]).filter(Boolean).filter((c) => {
        const occ = occMap.get(c.id) || { matin: false, soir: false }
        const dispoRow = dispoMap.get(c.id)
        const statutNorm = normalizeStatut(dispoRow?.statut)

        if (statutNorm === "non dispo") return false
        if (chercheMatin && dispoRow && dispoRow.dispo_matin === false) return false
        if (chercheSoir && dispoRow && dispoRow.dispo_soir === false) return false
        if (isCoupure && dispoRow) {
          const dm = dispoRow.dispo_matin
          const ds = dispoRow.dispo_soir
          if (dm === false && ds === false) return false
        }

        if (isCoupure) {
          if (occ.matin && occ.soir) return false
        } else if (chercheMatin) {
          if (occ.matin) return false
        } else if (chercheSoir) {
          if (occ.soir) return false
        }
        return true
      }).map((c) => ({
        id: c.id,
        nom: c.nom,
        prenom: c.prenom,
        vehicule: c.vehicule,
        interditClient: interditSet.has(c.id),
        prioritaire: prioritaireSet.has(c.id),
        dejaPlanifie: (occMap.get(c.id)?.matin || occMap.get(c.id)?.soir) ?? false,
        dejaTravaille: dejaTravailleSet.has(c.id),
      } as CandidatMini))

      setFilteredBase(list)
    }

    run()
  }, [open, candidats, secteur, clientId, date, heures?.debutMatin, heures?.finMatin, heures?.debutSoir, heures?.finSoir])

  const current = useMemo(() => {
    const chosenSet = new Set((value || []).filter(Boolean))
    return (slotIndex: number) => {
      const term = (searchBySlot[slotIndex] || "").toLowerCase().trim()
      return filteredBase
        .filter((c) => {
          if (value[slotIndex] === c.id) return true
          return !chosenSet.has(c.id)
        })
        .filter((c) => `${c.nom} ${c.prenom}`.toLowerCase().includes(term))
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }))
    }
  }, [filteredBase, value, searchBySlot])

  const setSlot = (idx: number, candId: string) => {
    const arr = value.slice()
    arr[idx] = candId
    onChange(arr)
  }

  const clearSlot = (idx: number) => {
    const arr = value.slice()
    arr[idx] = ""
    onChange(arr)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div data-stop-prop>{trigger}</div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[440px] p-3 overscroll-contain"
        onWheel={(e) => e.stopPropagation()}
      >
        <div
          className="space-y-2 max-h-[420px] overflow-y-auto pr-1 overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
        >
          {Array.from({ length: nbPersonnes }, (_, i) => (
            <div key={i} className="border rounded-md p-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium uppercase tracking-wide">
                  Candidat {i+1}
                </div>
                {value[i] && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearSlot(i)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              <Input
                placeholder="Recherche candidat"
                value={searchBySlot[i] || ""}
                onChange={(e) => {
                  const copy = searchBySlot.slice()
                  copy[i] = e.target.value
                  setSearchBySlot(copy)
                }}
                className="h-8 mb-2"
              />

              <div
                className="space-y-1 max-h-32 overflow-auto overscroll-contain"
                onWheel={(e) => e.stopPropagation()}
              >
                {current(i).map((c) => {
                  const selected = value[i] === c.id
                  return (
                    <Button
                      key={c.id}
                      variant={selected ? "default" : "ghost"}
                      className="w-full h-8 px-2"
                      onClick={() => setSlot(i, c.id)}
                    >
                      <div className="flex items-center gap-2 w-full min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="truncate">{c.nom} {c.prenom}</span>

                          {/* mêmes pictos que ta modale */}
                          {c.vehicule && (
                            <span className="p-1 rounded-full bg-muted" title="Véhicule">
                              <Car className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {c.interditClient && (
                            <span className="p-1 rounded-full bg-muted" title="Interdit sur ce client">
                              <Icon icon="material-symbols:do-not-disturb-on" className="w-3.5 h-3.5 text-red-500" />
                            </span>
                          )}
                          {c.prioritaire && (
                            <span className="p-1 rounded-full bg-muted" title="Prioritaire">
                              <Icon icon="mdi:star" className="w-3.5 h-3.5 text-yellow-500" />
                            </span>
                          )}
                          {c.dejaPlanifie && (
                            <span className="p-1 rounded-full bg-muted" title="Déjà planifié sur ce jour">
                              <Icon icon="lucide:history" className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                          )}
                          {c.dejaTravaille && (
                            <span className="p-1 rounded-full bg-muted" title="A déjà travaillé pour ce client">
                              <Icon icon="lucide:arrow-down-circle" className="w-3.5 h-3.5 text-violet-600" />
                            </span>
                          )}
                        </div>
                      </div>
                    </Button>
                  )
                })}

                {current(i).length === 0 && (
                  <div className="text-xs text-gray-500 text-center py-1">Aucun candidat</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Fermer</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
