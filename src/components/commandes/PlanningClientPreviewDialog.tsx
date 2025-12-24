import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { addDays, format, getWeek, startOfWeek } from "date-fns"
import { Calendar } from "lucide-react"

import { PlanningClientTableClientPreview } from "@/components/commandes/PlanningClientTableClientPreview"
import type { JourPlanning, CommandeWithCandidat } from "@/types/types-front"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  clientId: string
  secteur: string
  service?: string | null
  semaineDate: string // yyyy-MM-dd (lundi)
}

export default function PlanningClientPreviewDialog({
  open,
  onOpenChange,
  clientId,
  secteur,
  service,
  semaineDate,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [planning, setPlanning] = useState<Record<string, JourPlanning[]>>({})
  const [clientNom, setClientNom] = useState<string>("")
  const [errorMsg, setErrorMsg] = useState<string>("")

  const { lundiStr, dimancheStr, weekNum } = useMemo(() => {
    const base = new Date(semaineDate)
    const lundi = startOfWeek(base, { weekStartsOn: 1 })
    const dimanche = addDays(lundi, 6)
    return {
      lundiStr: format(lundi, "yyyy-MM-dd"),
      dimancheStr: format(dimanche, "yyyy-MM-dd"),
      weekNum: getWeek(base, { weekStartsOn: 1 }).toString(),
    }
  }, [semaineDate])

  useEffect(() => {
    if (!open) return

    const fetchPlanning = async () => {
      setLoading(true)
      setErrorMsg("")
      setPlanning({})
      setClientNom("")

      try {
        const { data: client } = await supabase
          .from("clients")
          .select("id, nom")
          .eq("id", clientId)
          .maybeSingle()

        const nomClient = client?.nom || "Client"
        setClientNom(nomClient)

        let q = supabase
          .from("commandes")
          .select(`
            id, date, statut, secteur, service, mission_slot, client_id,
            heure_debut_matin, heure_fin_matin,
            heure_debut_soir, heure_fin_soir,
            heure_debut_nuit, heure_fin_nuit,
            created_at,
            candidat_id,
            candidats (id, nom, prenom, telephone),
            clients (nom)
          `)
          .eq("client_id", clientId)
          .eq("secteur", secteur)
          .gte("date", lundiStr)
          .lte("date", dimancheStr)
          // ✅ On ne garde QUE ces statuts
          .in("statut", ["Validé", "En recherche", "Non pourvue", "Absence"])
          .order("date", { ascending: true })

        if (service) q = q.eq("service", service)

        const { data, error } = await q
        if (error) throw error

        const map: Record<string, JourPlanning[]> = {}
        map[nomClient] = []

        for (const item of (data || []) as any[]) {
          const commande: CommandeWithCandidat = {
            id: item.id,
            date: item.date,
            statut: item.statut,
            secteur: item.secteur,
            service: item.service ?? null,
            mission_slot: item.mission_slot ?? 0,
            client_id: item.client_id,
            created_at: item.created_at,
            heure_debut_matin: item.heure_debut_matin,
            heure_fin_matin: item.heure_fin_matin,
            heure_debut_soir: item.heure_debut_soir,
            heure_fin_soir: item.heure_fin_soir,
            heure_debut_nuit: item.heure_debut_nuit,
            heure_fin_nuit: item.heure_fin_nuit,
            // ✅ candidat direct depuis join (Absence/Validé ont un candidat, En recherche/Non pourvue non)
            candidat: item.candidats
              ? ({
                  nom: item.candidats.nom,
                  prenom: item.candidats.prenom,
                  telephone: item.candidats.telephone ?? null,
                } as any)
              : null,
            ...(item.candidat_id ? ({ candidat_id: item.candidat_id } as any) : {}),
            client: item.clients?.nom ? { nom: item.clients.nom } : { nom: nomClient },
          } as any

          map[nomClient].push({
            date: item.date,
            secteur: item.secteur,
            service: item.service ?? null,
            mission_slot: item.mission_slot ?? 0,
            commandes: [commande],
          })
        }

        setPlanning(map)
      } catch (e: any) {
        console.error(e)
        setErrorMsg("Erreur chargement planning")
      } finally {
        setLoading(false)
      }
    }

    fetchPlanning()
  }, [open, clientId, secteur, service, lundiStr, dimancheStr])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-[1600px] max-h-[85vh] overflow-hidden p-0">
        <div className="flex flex-col max-h-[85vh]">
          <DialogHeader className="p-6 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#840404]" />
              {clientNom} — {secteur} — Semaine {weekNum}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 flex-1 min-h-0 overflow-y-auto">
            {errorMsg ? (
              <div className="p-4 text-red-600">{errorMsg}</div>
            ) : loading ? (
              <div className="p-4 text-muted-foreground">Chargement…</div>
            ) : (
              <PlanningClientTableClientPreview
                planning={planning}
                selectedSecteurs={[secteur]}
                selectedSemaine={weekNum}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
