import { useEffect, useState } from "react"
import { format, startOfWeek, addDays, getWeek, subWeeks, addWeeks } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import { CellulePlanningCandidate } from "@/components/Planning/CellulePlanningCandidate"
import type {
  JourPlanningCandidat,
  StatutCommande,
  CommandeFull,
  CandidatDispoWithNom,
} from "@/types/types-front"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, AlertCircle, Clock } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

export default function PlanningMiniCandidat({ candidatId }: { candidatId: string }) {
  const [planning, setPlanning] = useState<JourPlanningCandidat[]>([])
  const [candidatNomPrenom, setCandidatNomPrenom] = useState("")
  const [currentStartDate, setCurrentStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))

  const dates = Array.from({ length: 7 }).map((_, i) =>
    format(addDays(currentStartDate, i), "yyyy-MM-dd")
  )
  const numeroSemaine = getWeek(currentStartDate, { weekStartsOn: 1 })

  const ts = (x?: { updated_at?: string | null; created_at?: string | null } | null) =>
    (x?.updated_at ? Date.parse(x.updated_at) : 0) || (x?.created_at ? Date.parse(x.created_at!) : 0) || 0

  const toCommandeFull = (cmd: any): CommandeFull => ({
    id: cmd.id,
    date: cmd.date,
    secteur: cmd.secteur,
    service: cmd.service ?? null,
    statut: cmd.statut as StatutCommande,
    client_id: cmd.client_id,
    candidat_id: cmd.candidat_id,
    heure_debut_matin: cmd.heure_debut_matin,
    heure_fin_matin: cmd.heure_fin_matin,
    heure_debut_soir: cmd.heure_debut_soir,
    heure_fin_soir: cmd.heure_fin_soir,
    heure_debut_nuit: cmd.heure_debut_nuit,
    heure_fin_nuit: cmd.heure_fin_nuit,
    commentaire: cmd.commentaire ?? null,
    created_at: cmd.created_at,
    updated_at: cmd.updated_at ?? undefined,
    mission_slot: cmd.mission_slot ?? 0,
    candidat: cmd.candidat ?? null,
    client: cmd.client ? { nom: cmd.client.nom } : undefined,
    motif_contrat: null,
  })

  const toDispoFull = (d: any): CandidatDispoWithNom => ({
    id: d.id,
    date: d.date,
    secteur: d.secteur,
    service: d.service ?? null,
    statut: (d.statut || "Non Renseigné") as "Dispo" | "Non Dispo" | "Non Renseigné",
    matin: !!d.dispo_matin,
    soir: !!d.dispo_soir,
    nuit: !!d.dispo_nuit,
    commentaire: d.commentaire || "",
    candidat_id: d.candidat_id,
    created_at: d.created_at,
    updated_at: d.updated_at ?? null,
    candidat: d.candidat ? { nom: d.candidat.nom, prenom: d.candidat.prenom } : undefined,
  })

  const fetchPlanning = async () => {
    const { data: disponibilites } = await supabase
      .from("disponibilites")
      .select("*, candidat:candidat_id(nom, prenom)")
      .eq("candidat_id", candidatId)
      .in("date", dates)

    const { data: commandes } = await supabase
      .from("commandes")
      .select("*, client:client_id(nom), candidat:candidat_id(nom, prenom)")
      .eq("candidat_id", candidatId)
      .in("date", dates)

    const { data: candidatData } = await supabase
      .from("candidats")
      .select("nom, prenom")
      .eq("id", candidatId)
      .single()

    if (candidatData) setCandidatNomPrenom(`${candidatData.prenom} ${candidatData.nom}`)

    const result: JourPlanningCandidat[] = dates.map((date) => {
      const dispoRow = (disponibilites ?? []).find((d) => d.date === date)
      const dispoFull = dispoRow ? toDispoFull(dispoRow) : undefined

      const cs = (commandes ?? []).filter((c) => c.date === date)
      const valides = cs.filter((c) => c.statut === "Validé")
      const annexes = cs.filter((c) =>
        ["Annule Int", "Annule Client", "Annule ADA", "Absence"].includes(c.statut || "")
      )

      let principale: CommandeFull | undefined
      let autres: CommandeFull[] = []
      let secteur = dispoFull?.secteur || cs[0]?.secteur || "Étages"
      let service = (dispoFull?.service ?? cs[0]?.service) ?? null

      if (valides.length > 0) {
        const missionMatin = valides.find((c) => !!c.heure_debut_matin && !!c.heure_fin_matin)
        const missionSoir  = valides.find((c) => !!c.heure_debut_soir  && !!c.heure_fin_soir)

        if (missionMatin) {
          const m = toCommandeFull(missionMatin)
          principale = m
          secteur = m.secteur
          service = (m.service ?? service) ?? null
          if (missionSoir) {
            const s = toCommandeFull(missionSoir)
            if (m.client?.nom && s.client?.nom && m.client.nom !== s.client.nom) {
              autres.push(s) // affiché via alert circle ci-dessous
            }
          }
        } else if (missionSoir) {
          const s = toCommandeFull(missionSoir)
          principale = s
          secteur = s.secteur
          service = (s.service ?? service) ?? null
        } else {
          const lastValide = [...valides].sort((a, b) => ts(b) - ts(a))[0]
          const v = toCommandeFull(lastValide)
          principale = v
          secteur = v.secteur
          service = (v.service ?? service) ?? null
        }
      } else {
        const lastAnnexe = annexes.length > 0 ? [...annexes].sort((a, b) => ts(b) - ts(a))[0] : null
        if (lastAnnexe && (!dispoFull || ts(lastAnnexe) >= ts(dispoFull))) {
          const a = toCommandeFull(lastAnnexe)
          principale = a
          secteur = a.secteur
          service = (a.service ?? service) ?? null
        }
      }

      return {
        date,
        secteur,
        service,
        commande: principale,
        autresCommandes: autres,
        disponibilite: dispoFull,
      }
    })

    setPlanning(result)
  }

  useEffect(() => {
    if (candidatId) fetchPlanning()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatId, currentStartDate])

  const byDate: Record<string, JourPlanningCandidat> = {}
  planning.forEach((entry) => {
    byDate[entry.date] = entry
  })

  return (
    <div className="border rounded-lg overflow-hidden shadow-sm mt-8">
      {/* Navigation haut */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <Button variant="ghost" size="icon" onClick={() => setCurrentStartDate(prev => subWeeks(prev, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-sm font-medium text-gray-800">Semaine {numeroSemaine}</div>
        <Button variant="ghost" size="icon" onClick={() => setCurrentStartDate(prev => addWeeks(prev, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Entête jours */}
      <div className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white">
        <div className="p-3 border-r flex items-center justify-center">
          Semaine {numeroSemaine}
        </div>
        {dates.map((_, i) => {
          const jour = addDays(currentStartDate, i)
          return (
            <div key={i} className="p-3 border-r text-center leading-tight">
              <div>{format(jour, "eeee", { locale: fr })}</div>
              <div className="text-xs">{format(jour, "dd MMMM", { locale: fr })}</div>
            </div>
          )
        })}
      </div>

      {/* Ligne du candidat */}
      <div className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] border-t text-sm">
        <div className="p-3 border-r bg-white text-gray-800 text-sm leading-tight">
          <div className="font-semibold">{candidatNomPrenom}</div>
          <div className="text-xs text-gray-500">Semaine {numeroSemaine}</div>
        </div>

        {dates.map((dateStr, i) => {
          const jourCell = byDate[dateStr]

          // commande secondaire (pour l’alert circle)
          const secondaire = jourCell?.autresCommandes && jourCell.autresCommandes.length > 0
            ? jourCell.autresCommandes[0]
            : undefined

          return (
            <div key={i} className="border-r p-2 h-28 relative">
              <CellulePlanningCandidate
                disponibilite={jourCell?.disponibilite}
                commande={jourCell?.commande}
                autresCommandes={jourCell?.autresCommandes || []}
                secteur={jourCell?.secteur || "Étages"}
                date={dateStr}
                candidatId={candidatId}
                service={jourCell?.service || ""}
                onSuccess={() => fetchPlanning()}
                nomPrenom={candidatNomPrenom}
              />

              {secondaire && (
                <Popover>
                  <PopoverTrigger asChild>
                    <div
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow z-20 translate-x-1/4 -translate-y-1/4 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <AlertCircle className="w-5 h-5 text-[#840404]" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="text-sm max-w-xs space-y-1" onClick={(e) => e.stopPropagation()}>
                    <div className="font-semibold">
                      {secondaire.client?.nom || "?"}
                    </div>
                    {secondaire.service && <div>{secondaire.service}</div>}
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>
                        {secondaire.heure_debut_matin
                          ? `${secondaire.heure_debut_matin.slice(0,5)} - ${secondaire.heure_fin_matin?.slice(0,5)}`
                          : secondaire.heure_debut_soir
                          ? `${secondaire.heure_debut_soir.slice(0,5)} - ${secondaire.heure_fin_soir?.slice(0,5)}`
                          : "Non renseigné"}
                      </span>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
