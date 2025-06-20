import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { secteursList } from "@/lib/secteurs"
import type { PosteType } from "@/types/types-front"
import { Card } from "@/components/ui/card"
import { PieChart } from "lucide-react" // nouvel import si pas encore présent
import {
  User,
  Calendar,
  ClipboardList,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CommandeFormGaucheProps {
  secteur: string
  setSecteur: (s: string) => void
  clientId: string
  setClientId: (s: string) => void
  service: string
  setService: (s: string) => void
  semaine: string
  setSemaine: (s: string) => void
  motif: string
  setMotif: (s: string) => void
  commentaire: string
  setCommentaire: (s: string) => void
  clients: { id: string; nom: string; services?: string[] }[]
  services: string[]
  semainesDisponibles: { value: string; label: string }[]
  posteTypeId: string
  setPosteTypeId: (s: string) => void
  postesTypes: PosteType[]
  setHeuresParJour: (val: any) => void
  setJoursState: (val: any) => void
}

export default function CommandeFormGauche({
  secteur,
  setSecteur,
  clientId,
  setClientId,
  service,
  setService,
  semaine,
  setSemaine,
  motif,
  setMotif,
  commentaire,
  setCommentaire,
  clients,
  services,
  semainesDisponibles,
  posteTypeId,
  setPosteTypeId,
  postesTypes,
  setHeuresParJour,
  setJoursState,
}: CommandeFormGaucheProps) {
  const formatHeure = (heure?: string | null) =>
    heure && heure.length >= 5 ? heure.slice(0, 5) : "--:--"

  const formatLabelPoste = (pt: PosteType) => {
    const matin =
      pt.heure_debut_matin && pt.heure_fin_matin
        ? `${formatHeure(pt.heure_debut_matin)}–${formatHeure(pt.heure_fin_matin)}`
        : null
    const soir =
      pt.heure_debut_soir && pt.heure_fin_soir
        ? `${formatHeure(pt.heure_debut_soir)}–${formatHeure(pt.heure_fin_soir)}`
        : null
    const heures = [matin, soir].filter(Boolean).join(" / ")
    return heures ? `${pt.nom} – ${heures}` : pt.nom
  }

  return (
    <Card className="p-6 h-full flex flex-col bg-white space-y-6 overflow-y-auto">

{/* Secteur */}
<div className="space-y-4 border rounded-lg p-4 bg-gray-50 shadow-sm">
  <div className="flex items-center gap-2 mb-2">
    <PieChart className="w-4 h-4 text-muted-foreground" />
    <h3 className="font-medium text-sm">Secteur</h3>
  </div>


        <div className="grid grid-cols-5 gap-2">
          {secteursList.map(({ label, icon: Icon }) => (
            <Button
              key={label}
              variant={secteur === label ? "default" : "outline"}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-xs py-2 h-16",
                secteur !== "" && secteur !== label && "opacity-40"
              )}
              onClick={() => {
                setSecteur(label)
                setClientId("")
                setService("")
                setPosteTypeId("")
                setHeuresParJour({})
                setJoursState({})
              }}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Client + Service */}
      <div className="space-y-4 border rounded-lg p-4 bg-gray-50 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Client et Service</h3>
        </div>

        <div className="space-y-2">
          <Label>Client</Label>
          <Select
            value={clientId}
            onValueChange={(val) => {
              setClientId(val)
              setService("")
              setPosteTypeId("")
              setHeuresParJour({})
              setJoursState({})
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Service</Label>
          <Select
            value={service}
            onValueChange={setService}
            disabled={services.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  services.length === 0
                    ? "Aucun service"
                    : "Sélectionner un service"
                }
              />
            </SelectTrigger>
            {services.length > 0 && (
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            )}
          </Select>
        </div>
      </div>

      {/* Semaine + Poste type */}
      <div className="space-y-4 border rounded-lg p-4 bg-gray-50 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Planification</h3>
        </div>

        <div className="space-y-2">
          <Label>Semaine</Label>
          <Select value={semaine} onValueChange={setSemaine}>
            <SelectTrigger>
              <SelectValue placeholder="Semaine" />
            </SelectTrigger>
            <SelectContent>
              {semainesDisponibles.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Poste type</Label>
          <Select
            value={posteTypeId || "none"}
            onValueChange={(val) => setPosteTypeId(val === "none" ? "" : val)}
            disabled={!postesTypes.length}
          >
            <SelectTrigger>
              <SelectValue placeholder="Aucun poste type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun poste type</SelectItem>
              {postesTypes.map((pt) => (
                <SelectItem key={pt.id} value={pt.id}>
                  {formatLabelPoste(pt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Motif */}
      <div className="space-y-4 border rounded-lg p-4 bg-gray-50 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Motif de contrat</h3>
        </div>

        <div className="space-y-2">
          <Select value={motif} onValueChange={setMotif}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un motif" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Extra Usage constant">
                Extra Usage constant
              </SelectItem>
              <SelectItem value="Accroissement d’activité">
                Accroissement d’activité
              </SelectItem>
              <SelectItem value="Remplacement de personnel">
                Remplacement de personnel
              </SelectItem>
            </SelectContent>
          </Select>

          {(motif === "Accroissement d’activité" ||
            motif === "Remplacement de personnel") && (
            <Input
              placeholder="Précisez le motif"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              className="w-full"
            />
          )}
        </div>
      </div>

      {/* Information complémentaire */}
      <div className="space-y-4 border rounded-lg p-4 bg-gray-50 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Information complémentaire</h3>
        </div>
        <Textarea
          placeholder="Ajoutez une note..."
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
        />
      </div>
    </Card>
  )
}
