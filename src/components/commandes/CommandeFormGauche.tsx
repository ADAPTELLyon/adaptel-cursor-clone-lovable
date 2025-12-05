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
import { PieChart, User, Calendar, ClipboardList, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  startOfWeek,
  endOfWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  addWeeks,
} from "date-fns"
import { fr } from "date-fns/locale"

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
  complementMotif: string
  setComplementMotif: (s: string) => void
  clients: { id: string; nom: string; services?: string[] }[]
  services: string[]
  // ⚠️ Toujours dans la signature pour ne rien casser ailleurs,
  // mais on ne s'en sert plus pour construire la liste.
  semainesDisponibles: { value: string; label: string }[]
  posteTypeId: string
  setPosteTypeId: (s: string) => void
  postesTypes: PosteType[]
  setHeuresParJour: (val: any) => void
  setJoursState: (val: any) => void
}

function formatHeure(heure?: string | null) {
  return heure && heure.length >= 5 ? heure.slice(0, 5) : "--:--"
}

function formatLabelPoste(pt: PosteType) {
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

function capitalize(str: string) {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * On part du principe que `value` est une date (lundi de la semaine) au format "yyyy-MM-dd"
 * comme partout ailleurs dans l’app.
 */
function parseWeekFromValue(value: string): { date: Date; year: number; week: number } | null {
  if (!value) return null
  try {
    const d = new Date(value + "T00:00:00")
    if (Number.isNaN(d.getTime())) return null
    const monday = startOfWeek(d, { weekStartsOn: 1 })
    const year = getISOWeekYear(monday)
    const week = getISOWeek(monday)
    return { date: monday, year, week }
  } catch {
    return null
  }
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
  complementMotif,
  setComplementMotif,
  clients,
  services,
  semainesDisponibles, // non utilisé pour la liste, mais conservé pour compatibilité
  posteTypeId,
  setPosteTypeId,
  postesTypes,
  setHeuresParJour,
  setJoursState,
}: CommandeFormGaucheProps) {
  // —————————————————————————————————————
  // Génération locale des semaines : N-2, N-1, N, N+1..N+20
  // —————————————————————————————————————
  const today = new Date()
  const mondayCurrent = startOfWeek(today, { weekStartsOn: 1 })

  type WeekOption = {
    value: string // la vraie valeur (date du lundi, "yyyy-MM-dd")
    date: Date
    year: number
    week: number // numéro ISO (peut être 53), on clamp juste pour l’affichage
  }

  const generatedWeeks: WeekOption[] = []

  for (let offset = -2; offset <= 20; offset++) {
    const monday = addWeeks(mondayCurrent, offset)
    const year = getISOWeekYear(monday)
    const week = getISOWeek(monday)
    const value = format(monday, "yyyy-MM-dd")
    generatedWeeks.push({ value, date: monday, year, week })
  }

  // Si la semaine sélectionnée est en dehors de cette plage, on l’ajoute pour ne rien casser.
  let selectedWeekOpt: WeekOption | null = null
  if (semaine) {
    const parsed = parseWeekFromValue(semaine)
    if (parsed) {
      const exists = generatedWeeks.some((w) => w.value === semaine)
      if (!exists) {
        selectedWeekOpt = {
          value: semaine,
          date: parsed.date,
          year: parsed.year,
          week: parsed.week,
        }
        generatedWeeks.push(selectedWeekOpt)
      }
    }
  }

  // Tri chronologique : année puis semaine
  generatedWeeks.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.week - b.week
  })

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
              {(() => {
                let currentYearHeader: number | null = null
                const nodes: React.ReactNode[] = []

                for (const w of generatedWeeks) {
                  if (currentYearHeader === null || currentYearHeader !== w.year) {
                    currentYearHeader = w.year
                    nodes.push(
                      <div
                        key={`year-${w.year}`}
                        className="px-2 py-1 text-xs font-semibold text-muted-foreground opacity-80"
                      >
                        {w.year}
                      </div>
                    )
                  }

                  const monday = w.date
                  const sunday = endOfWeek(monday, { weekStartsOn: 1 })

                  const lundiStrRaw = format(monday, "EEEE d MMM", { locale: fr })
                  const dimancheStrRaw = format(sunday, "EEEE d MMM", { locale: fr })

                  const lundiStr = capitalize(lundiStrRaw.replace(/\.$/, ""))
                  const dimancheStr = capitalize(dimancheStrRaw.replace(/\.$/, ""))

                  // 🔒 Pour toi : pas de "Semaine 53" dans le label
                  const displayWeek = w.week > 52 ? 52 : w.week

                  const label = `Semaine ${displayWeek} - ${lundiStr} - ${dimancheStr}`

                  nodes.push(
                    <SelectItem key={w.value} value={w.value}>
                      {label}
                    </SelectItem>
                  )
                }

                return nodes
              })()}
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
          <Select
            value={motif}
            onValueChange={(val) => {
              setMotif(val)
              if (val === "Extra Usage constant") {
                setComplementMotif("")
              }
            }}
          >
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
              value={complementMotif}
              onChange={(e) => setComplementMotif(e.target.value)}
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
