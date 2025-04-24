import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { Plus, CalendarCheck, AlertCircle, RotateCcw } from "lucide-react"
import { indicateurColors } from "@/lib/colors"
import { secteursList } from "@/lib/secteurs"

export default function SectionFixeCommandes({
  selectedSecteurs,
  setSelectedSecteurs,
  stats,
  taux,
  semaine,
  setSemaine,
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
                if (toutAfficher) setToutAfficher(false)
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
              if (val) setSelectedSecteurs(secteursList.map((s) => s.label))
              else setSelectedSecteurs(["Étages"])
            }}
            className="data-[state=checked]:bg-[#840404]"
          />
          <span className="text-sm">Tout afficher</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <select
          className="border rounded px-2 py-2 text-sm w-[220px]"
          value={semaine}
          onChange={(e) => {
            setSemaine(e.target.value)
            setSemaineEnCours(false)
          }}
        >
          <option value="">Semaine</option>
          <option value="2025-04-21">Semaine du 21/04</option>
        </select>
        <select
          className="border rounded px-2 py-2 text-sm w-[220px]"
          value={client}
          onChange={(e) => setClient(e.target.value)}
        >
          <option value="">Client</option>
          <option value="client1">Client 1</option>
        </select>
        <Input
          placeholder="Rechercher..."
          className="w-[240px]"
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
