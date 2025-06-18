import { useEffect, useState } from "react"
import {
  UserCircleIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  NoSymbolIcon,
  ClockIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  TruckIcon,
  PencilSquareIcon,
  StarIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import dayjs from "dayjs"
import { Candidat } from "@/types/types-front"
import { CandidatEditDialog } from "@/components/candidates/CandidatEditDialog"
import PlanningMiniCandidat from "@/components/Planning/PlanningMiniCandidat"

interface FicheMemoCandidatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidatId: string
}

export default function FicheMemoCandidat({ open, onOpenChange, candidatId }: FicheMemoCandidatProps) {
  const [candidat, setCandidat] = useState<Candidat | null>(null)
  const [interdictions, setInterdictions] = useState<any[]>([])
  const [priorites, setPriorites] = useState<any[]>([])
  const [incidents, setIncidents] = useState<any[]>([])
  const [showEditDialog, setShowEditDialog] = useState(false)

  const [nbValide, setNbValide] = useState(0)
  const [nbAnnuleInt, setNbAnnuleInt] = useState(0)
  const [nbAbsence, setNbAbsence] = useState(0)

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

      const { data: prior } = await supabase
        .from("interdictions_priorites")
        .select("*, client:client_id(nom)")
        .eq("candidat_id", candidatId)
        .eq("type", "priorite")

      const { data: incid } = await supabase
        .from("incidents")
        .select("*, client:client_id(nom)")
        .eq("candidat_id", candidatId)

      setInterdictions(inter || [])
      setPriorites(prior || [])
      setIncidents(incid || [])

      const { count: countValide } = await supabase
        .from("commandes")
        .select("*", { count: "exact", head: true })
        .eq("candidat_id", candidatId)
        .eq("statut", "Validé")

      const { count: countAnnule } = await supabase
        .from("commandes")
        .select("*", { count: "exact", head: true })
        .eq("candidat_id", candidatId)
        .eq("statut", "Annule Int")

      const { count: countAbsence } = await supabase
        .from("commandes")
        .select("*", { count: "exact", head: true })
        .eq("candidat_id", candidatId)
        .eq("statut", "Absence")

      setNbValide(countValide || 0)
      setNbAnnuleInt(countAnnule || 0)
      setNbAbsence(countAbsence || 0)
    }

    fetchData()
  }, [open, candidatId])

  const renderSecteurChip = (secteurVal: string) => (
    <Badge variant="outline" className="text-xs px-2 py-1">
      {secteurVal}
    </Badge>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[95vh] p-0 rounded-lg overflow-hidden">
          <div className="bg-white px-6 py-3 border-b flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gray-100 p-2 rounded-full">
                <UserCircleIcon className="h-8 w-8 text-[#840404]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {candidat?.prenom} <span className="uppercase">{candidat?.nom}</span>
                </h1>
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

          <div className="grid grid-cols-12 gap-4 bg-gray-50 p-4 overflow-auto max-h-[calc(95vh-80px-64px)]">
            <div className="col-span-3 space-y-4">
              <Card title="Informations">
                <InfoItem icon={<CalendarIcon className="h-4 w-4" />} label="Âge" value={candidat?.date_naissance ? `${dayjs().diff(candidat.date_naissance, 'year')} ans` : "-"} />
                <InfoItem icon={<ClockIcon className="h-4 w-4" />} label="Créé le" value={candidat?.created_at ? dayjs(candidat.created_at).format("DD/MM/YYYY") : "-"} />
                <InfoItem icon={<EnvelopeIcon className="h-4 w-4" />} label="Email" value={candidat?.email || "-"} />
                <InfoItem icon={<CheckCircleIcon className="h-4 w-4" />} label="Statut" value={candidat?.actif ? "Actif" : "Inactif"} />
                <InfoItem icon={<TruckIcon className="h-4 w-4" />} label="Véhicule" value={candidat?.vehicule ? "Oui" : "Non"} />
              </Card>

              <Card title="Missions">
                <div className="space-y-2 h-[312px] flex flex-col justify-between">
                  <IndicateurCard label="Validées" value={nbValide} color="#a9d08e" />
                  <IndicateurCard label="Annule Int" value={nbAnnuleInt} color="#606060" />
                  <IndicateurCard label="Absence" value={nbAbsence} color="#ff6961" />
                </div>
              </Card>
            </div>

            <div className="col-span-6 space-y-4">
              <Card title="Interdictions" badge={<Badge className="bg-white text-gray-800 border-gray-800">{interdictions.length} Interdictions</Badge>}>
                <div className="space-y-1 h-[220px] overflow-y-auto">
                  {interdictions.length > 0 ? (
                    interdictions.map((item) => (
                      <ListItem
                        key={item.id}
                        icon={<NoSymbolIcon className="h-4 w-4 text-red-500" />}
                        title={
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-sm font-medium">{item.client?.nom || ""}</span>
                            <div className="shrink-0">{renderSecteurChip(item.secteur)}</div>
                          </div>
                        }
                        desc={item.commentaire || "-"}
                        date={dayjs(item.created_at).format("DD/MM/YYYY")}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 italic">Aucune interdiction</p>
                  )}
                </div>
              </Card>

              <Card title="Incidents" badge={<Badge className="bg-white text-gray-800 border-gray-800">{incidents.length} enregistrés</Badge>}>
                <div className="space-y-1 h-[220px] overflow-y-auto">
                  {incidents.length > 0 ? (
                    incidents.map((item) => (
                      <ListItem
                        key={item.id}
                        icon={<ExclamationTriangleIcon className="h-4 w-4 text-orange-500" />}
                        title={item.client?.nom || ""}
                        subtitle={
                          <span className="text-xs text-gray-700">
                            <span className="font-medium">{item.type_incident || ""}</span>
                            {item.description ? ` - ${item.description}` : ""}
                          </span>
                        }
                        date={dayjs(item.date_incident).format("DD/MM/YYYY")}
                        desc=""
                      />
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 italic">Aucun incident</p>
                  )}
                </div>
              </Card>
            </div>

            <div className="col-span-3 space-y-4">
              <Card title="Priorités" badge={<Badge className="bg-white text-gray-800 border-gray-800">{priorites.length} Priorités</Badge>}>
                <div className="space-y-1 h-[300px] overflow-y-auto">
                  {priorites.length > 0 ? (
                    priorites.map((item) => (
                      <ListItem
                        key={item.id}
                        icon={<StarIcon className="h-4 w-4 text-yellow-500" />}
                        title={item.client?.nom || ""}
                        subtitle={renderSecteurChip(item.secteur)}
                        desc={item.commentaire || "-"}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 italic">Aucune priorité</p>
                  )}
                </div>
              </Card>
            </div>
          </div>

          <div className="bg-white px-6 pt-4 pb-6 border-t">
            <PlanningMiniCandidat candidatId={candidatId} />
          </div>

          <div className="bg-white border-t px-6 py-4 flex justify-end">
            <button
              onClick={() => {
                onOpenChange(false)
                setTimeout(() => setShowEditDialog(true), 250)
              }}
              className="flex items-center space-x-2 bg-[#840404] hover:bg-[#a50505] text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <PencilSquareIcon className="h-4 w-4" />
              <span>Voir fiche complète</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {candidatId && (
        <CandidatEditDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          candidatId={candidatId}
        />
      )}
    </>
  )
}

function Card({ title, children, badge }: { title: string; children: any; badge?: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-800 text-white">
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
      <div className="flex items-center">{icon && <span className="mr-2">{icon}</span>}{label}</div>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ListItem({
  icon,
  title,
  subtitle,
  desc,
  date,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  desc: string
  date?: string
}) {
  return (
    <div className="p-2 hover:bg-gray-50 rounded">
      <div className="flex items-start space-x-2">
        {icon && <div className="mt-0.5">{icon}</div>}
        <div className="flex-1">
          <div className="flex justify-between text-sm font-medium">
            <span>{title}</span>
            {date && <span className="text-xs text-gray-500">{date}</span>}
          </div>
          {subtitle && <div className="mt-0.5">{subtitle}</div>}
          {desc && <div className="text-xs text-gray-500 mt-1">{desc}</div>}
        </div>
      </div>
    </div>
  )
}

function IndicateurCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="relative bg-white shadow-sm border rounded-md px-4 py-3 h-[90px] flex flex-col justify-between">
      <div className="absolute top-0 left-0 h-full w-2 rounded-l-md" style={{ backgroundColor: color }} />
      <div className="text-sm font-semibold mb-1" style={{ color }}>{label}</div>
      <div className="text-3xl font-bold ml-4" style={{ color }}>{value}</div>
    </div>
  )
}
