import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { Plus, CalendarCheck, AlertCircle, RotateCcw } from "lucide-react"
import { indicateurColors } from "@/lib/colors"
import { secteursList } from "@/lib/secteurs"
import { getWeek } from "date-fns"

const semaineActuelle = getWeek(new Date())

export function SectionFixeCommandes({
  selectedSecteurs,
  setSelectedSecteurs,
  stats,
  taux,
  semaine,
  setSemaine,
  selectedSemaine,
  setSelectedSemaine,
  client,
  setClient,
  search,
  setSearch,
  toutAfficher,
  setToutAfficher,
  enRecherche,
  setEnRecherche,
  semaineEnCours,
  setSemaineEnCours,
  resetFiltres,
  semainesDisponibles,
  clientsDisponibles,
}: {
  selectedSecteurs: string[]
  setSelectedSecteurs: (val: string[]) => void
  stats: {
    demandées: number
    validées: number
    enRecherche: number
    nonPourvue: number
  }
  taux: number
  semaine: string
  setSemaine: (s: string) => void
  selectedSemaine: string
  setSelectedSemaine: (val: string) => void
  client: string
  setClient: (s: string) => void
  search: string
  setSearch: (s: string) => void
  toutAfficher: boolean
  setToutAfficher: (b: boolean) => void
  enRecherche: boolean
  setEnRecherche: (b: boolean) => void
  semaineEnCours: boolean
  setSemaineEnCours: (b: boolean) => void
  resetFiltres: () => void
  semainesDisponibles: string[]
  clientsDisponibles: any[]
}) {
  return (
    <div className="sticky top-0 z-10 bg-white shadow-sm p-4 space-y-6">
      <div className="grid grid-cols-4 gap-2">
        {["Demandées", "Validées", "En recherche", "Non pourvue"].map((label) => (
          <div
            key={label}
            className="rounded-xl p-3"
            style={{ backgroundColor: indicateurColors[label] }}
          >
            <div className="text-xs text-white">{label}</div>
            <div className="text-2xl font-bold text-white">
              {stats[label.toLowerCase().replace(" ", "")] || 0}
            </div>
          </div>
        ))}
      </div>

      <div className="relative">
        <div className="h-6 w-full rounded bg-gray-200 overflow-hidden">
          <div
            className="h-full text-xs flex items-center justify-center text-white font-medium transition-all duration-300"
            style={{
              width: `${taux}%`,
              backgroundColor: taux === 100 ? indicateurColors["Validées"] : indicateurColors["En recherche"],
            }}
          >
            {`${taux}%`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {secteursList.map(({ label, icon: Icon }) => {
          const selected = selectedSecteurs.includes(label)
          return (
            <Button
              key={label}
              className={cn(
                "py-2 h-10 w-full text-sm font-medium",
                selected
                  ? "bg-[#840404] text-white hover:bg-[#750303]"
                  : "bg-gray-100 text-black hover:bg-gray-200"
              )}
              onClick={() => {
                setToutAfficher(false)
                setSelectedSecteurs([label])
              }}
            >
              <Icon className="h-4 w-4 mr-1" />
              {label}
            </Button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={semaineEnCours}
            onCheckedChange={(val) => {
              setSemaineEnCours(val)
              if (val) {
                const today = new Date()
                const monday = new Date(today.setDate(today.getDate() - today.getDay() + 1))
                const iso = monday.toISOString().slice(0, 10)
                setSemaine(iso)
                setSelectedSemaine(semaineActuelle.toString())
              } else {
                setSelectedSemaine("Toutes")
              }
            }}
            className="data-[state=checked]:bg-[#840404]"
          />
          <span className="text-sm">Semaine en cours</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={enRecherche}
            onCheckedChange={setEnRecherche}
            className="data-[state=checked]:bg-[#840404]"
          />
          <span className="text-sm">En recherche</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={toutAfficher}
            onCheckedChange={(val) => {
              setToutAfficher(val)
              if (val) {
                setSelectedSecteurs(secteursList.map((s) => s.label))
                setClient("")
                setSelectedSemaine("Toutes")
                setSemaineEnCours(false)
              } else {
                setSelectedSecteurs(["Étages"])
                setClient("")
                setSelectedSemaine(semaineActuelle.toString())
                setSemaineEnCours(true)
              }
            }}
            className="data-[state=checked]:bg-[#840404]"
          />
          <span className="text-sm">Tout afficher</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <select
          className="border rounded px-2 py-2 text-sm w-[160px]"
          value={selectedSemaine}
          onChange={(e) => {
            setSelectedSemaine(e.target.value)
            if (semaineEnCours && e.target.value !== semaineActuelle.toString()) {
              setSemaineEnCours(false)
            }
          }}
        >
          <option value="Toutes">Toutes les semaines</option>
          {semainesDisponibles.map((s) => (
            <option key={s} value={s}>
              Semaine {s}
            </option>
          ))}
        </select>

        <select
          className="border rounded px-2 py-2 text-sm w-[180px]"
          value={client}
          onChange={(e) => setClient(e.target.value)}
        >
          <option value="">Tous les clients</option>
          {clientsDisponibles.map((c) => (
            <option key={c.id} value={c.nom}>
              {c.nom}
            </option>
          ))}
        </select>

        <Input
          placeholder="Rechercher..."
          className="w-[220px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1 text-muted-foreground"
          onClick={resetFiltres}
        >
          <RotateCcw size={16} /> Réinitialiser
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button className="bg-[#840404] hover:bg-[#750303] text-white flex items-center gap-2">
          <Plus size={16} /> Nouvelle commande
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <CalendarCheck size={16} /> Saisir disponibilités
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <AlertCircle size={16} /> Saisir incident
        </Button>
      </div>
    </div>
  )
}
