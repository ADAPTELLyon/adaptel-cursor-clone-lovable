import { useEffect, useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  UserCircleIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  NoSymbolIcon,
  ClockIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  StarIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import dayjs from "dayjs"
import { useNavigate } from "react-router-dom"
import { Candidat } from "@/types/types-front"

interface FicheMemoCandidatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidatId: string
}

export function FicheMemoCandidat({ open, onOpenChange, candidatId }: FicheMemoCandidatProps) {
  const [candidat, setCandidat] = useState<Candidat | null>(null)
  const [interdictions, setInterdictions] = useState<any[]>([])
  const [priorites, setPriorites] = useState<any[]>([])
  const [incidents, setIncidents] = useState<any[]>([])
  const [planning, setPlanning] = useState<any[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!open || !candidatId) return

    const fetchData = async () => {
      const { data: cand } = await supabase.from("candidats").select("*").eq("id", candidatId).single()
      setCandidat(cand)

      const { data: inter } = await supabase
        .from("interdictions_priorites")
        .select("*, client:client_id(nom)")
        .eq("candidat_id", candidatId)
        .eq("type", "interdiction")
        .eq("actif", true)

      const { data: prior } = await supabase
        .from("interdictions_priorites")
        .select("*, client:client_id(nom)")
        .eq("candidat_id", candidatId)
        .eq("type", "priorite")
        .eq("actif", true)

      const { data: incid } = await supabase
        .from("incidents")
        .select("*, client:client_id(nom)")
        .eq("candidat_id", candidatId)

      const startOfWeek = dayjs().startOf("week").add(1, 'day') // Lundi
      const endOfWeek = startOfWeek.add(6, "day")

      const { data: dispo } = await supabase
        .from("disponibilites_candidats")
        .select("*")
        .eq("candidat_id", candidatId)
        .gte("jour", startOfWeek.format("YYYY-MM-DD"))
        .lte("jour", endOfWeek.format("YYYY-MM-DD"))

      const { data: missions } = await supabase
        .from("commandes")
        .select("jour, secteur, client:client_id(nom), heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
        .eq("candidat_id", candidatId)
        .gte("jour", startOfWeek.format("YYYY-MM-DD"))
        .lte("jour", endOfWeek.format("YYYY-MM-DD"))

      const planningData = Array(7).fill(null).map((_, i) => {
        const date = startOfWeek.add(i, "day").format("YYYY-MM-DD")
        const dispoDuJour = dispo?.find(d => d.jour === date)
        const missionDuJour = missions?.find(m => m.jour === date)
        return { date, dispo: dispoDuJour, mission: missionDuJour }
      })

      setInterdictions(inter || [])
      setPriorites(prior || [])
      setIncidents(incid || [])
      setPlanning(planningData)
    }

    fetchData()
  }, [open, candidatId])

  const goToFiche = () => {
    onOpenChange(false)
    navigate(`/candidats?id=${candidatId}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] p-0 rounded-lg overflow-hidden">
        {/* HEADER */}
        <div className="bg-white px-6 py-3 border-b flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-gray-100 p-2 rounded-full">
              <UserCircleIcon className="h-8 w-8 text-[#840404]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{candidat?.prenom} <span className="uppercase">{candidat?.nom}</span></h1>
              <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                <span className="flex items-center">
                  <PhoneIcon className="h-4 w-4 mr-1" /> {candidat?.telephone || "Non renseigné"}
                </span>
                <span className="flex items-center">
                  <MapPinIcon className="h-4 w-4 mr-1" /> {candidat?.code_postal} {candidat?.ville || "-"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN BODY */}
        <div className="grid grid-cols-12 gap-4 bg-gray-50 p-4 overflow-auto max-h-[calc(95vh-80px-64px)]">
          {/* COLONNE GAUCHE */}
          <div className="col-span-3 space-y-4">
            <Card title="Informations">
              <InfoItem icon={<CalendarIcon className="h-4 w-4" />} label="Âge" value={candidat?.date_naissance ? `${dayjs().diff(candidat.date_naissance, 'year')} ans` : "-"} />
              <InfoItem icon={<ClockIcon className="h-4 w-4" />} label="Créé le" value={candidat?.created_at ? dayjs(candidat.created_at).format("DD/MM/YYYY") : "-"} />
              <InfoItem icon={<DocumentTextIcon className="h-4 w-4" />} label="Email" value={candidat?.email || "-"} />
              <InfoItem icon={<ExclamationTriangleIcon className="h-4 w-4" />} label="Statut" value={candidat?.actif ? "Actif" : "Inactif"} />
              <InfoItem icon={<StarIcon className="h-4 w-4" />} label="Véhicule" value={candidat?.vehicule ? "Oui" : "Non"} />
            </Card>
          </div>

          {/* COLONNE CENTRALE */}
          <div className="col-span-6 space-y-4">
            <Card title="Interdictions" badge={<Badge variant="destructive">{interdictions.length} Interdictions</Badge>}>
              {interdictions.length > 0 ? interdictions.map((item) => (
                <ListItem key={item.id} icon={<NoSymbolIcon className="h-4 w-4 text-red-500" />} title={`${item.client?.nom} - ${item.secteur}`} desc={item.commentaire || "-"} date={dayjs(item.created_at).format("DD/MM/YYYY")} />
              )) : <p className="text-sm text-gray-400 italic">Aucune interdiction</p>}
            </Card>

            <Card title="Incidents" badge={<Badge variant="outline">{incidents.length} enregistrés</Badge>}>
              {incidents.length > 0 ? incidents.map((item) => (
                <ListItem key={item.id} icon={<ExclamationTriangleIcon className="h-4 w-4 text-orange-500" />} title={item.type_incident} desc={item.description || "-"} date={dayjs(item.date_incident).format("DD/MM/YYYY")} />
              )) : <p className="text-sm text-gray-400 italic">Aucun incident</p>}
            </Card>
          </div>

          {/* COLONNE DROITE */}
          <div className="col-span-3 space-y-4">
            <Card title="Priorités" badge={<Badge className="bg-green-100 text-green-800 border-green-200">{priorites.length} Priorités</Badge>}>
              {priorites.length > 0 ? priorites.map((item) => (
                <ListItem key={item.id} icon={<StarIcon className="h-4 w-4 text-yellow-500" />} title={`${item.client?.nom} - ${item.secteur}`} desc={item.commentaire || "-"} date={dayjs(item.created_at).format("DD/MM/YYYY")} />
              )) : <p className="text-sm text-gray-400 italic">Aucune priorité</p>}
            </Card>
          </div>
        </div>

        {/* PLANNING */}
        <div className="bg-white border-t px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Planning de la semaine</h3>
          <div className="flex justify-between">
            {planning.map((day, i) => (
              <div key={i} className="flex-1 text-center text-sm">
                <div className="font-medium mb-1">{dayjs(day.date).format("ddd DD/MM")}</div>
                {day.mission ? (
                  <div className="bg-green-100 text-green-800 text-xs rounded p-1">
                    {day.mission.client?.nom}<br />
                    {day.mission.heure_debut_matin?.slice(0, 5)} - {day.mission.heure_fin_matin?.slice(0, 5)}
                  </div>
                ) : day.dispo ? (
                  <div className="bg-blue-100 text-blue-800 text-xs rounded p-1">Disponible</div>
                ) : (
                  <div className="text-xs text-gray-400 italic">Non renseigné</div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-4">
            <button onClick={goToFiche} className="flex items-center space-x-2 bg-[#840404] hover:bg-[#a50505] text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <PencilSquareIcon className="h-4 w-4" />
              <span>Voir fiche complète</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// COMPOSANTS INTERNES

function Card({ title, children, badge }: { title: string; children: any; badge?: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {badge}
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  )
}

function InfoItem({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-700">
      <div className="flex items-center">
        {icon && <span className="mr-2">{icon}</span>}
        {label}
      </div>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ListItem({ icon, title, desc, date }: { icon?: React.ReactNode; title: string; desc: string; date?: string }) {
  return (
    <div className="p-2 hover:bg-gray-50 rounded">
      <div className="flex items-start space-x-2">
        {icon && <div className="mt-0.5">{icon}</div>}
        <div className="flex-1">
          <div className="flex justify-between text-sm font-medium">
            <span>{title}</span>
            {date && <span className="text-xs text-gray-500">{date}</span>}
          </div>
          <div className="text-xs text-gray-500 mt-1">{desc}</div>
        </div>
      </div>
    </div>
  )
}
