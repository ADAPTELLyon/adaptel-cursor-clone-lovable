import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { Plus, CalendarCheck, AlertCircle, RotateCcw } from "lucide-react"
import { indicateurColors } from "@/lib/colors"
import { secteursList } from "@/lib/secteurs"
import { startOfWeek } from "date-fns"

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
  stats: { demandées: number; validées: number; enRecherche: number; nonPourvue: number }
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
  clientsDisponibles: string[]
}) {
  return (
    <div className="sticky top-[64px] z-10 bg-white shadow-sm p-4 space-y-6">
      {/* Indicateurs */}
      <div className="grid grid-cols-4 gap-2">
        {["Demandées", "Validées", "En recherche", "Non pourvue"].map((label) => {
          const key =
            label === "En recherche"
              ? "enRecherche"
              : label === "Non pourvue"
              ? "nonPourvue"
              : label.toLowerCase().replace(" ", "")
          return (
            <div
              key={label}
              className="rounded-xl p-3"
              style={{ backgroundColor: indicateurColors[label] }}
            >
              <div className="text-xs text-white">{label}</div>
              <div className="text-2xl font-bold text-white">
                {stats[key] || 0}
              </div>
            </div>
          )
        })}
      </div>

      {/* Barre de progression */}
      <div className="relative">
        <div className="h-6 w-full rounded bg-gray-200 overflow-hidden">
          <div
            className="h-full text-xs flex items-center justify-center text-white font-medium transition-all duration-300"
            style={{
              width: `${taux}%`,
              backgroundColor:
                taux === 100
                  ? indicateurColors["Validées"]
                  : indicateurColors["En recherche"],
            }}
          >
            {`${taux}%`}
          </div>
        </div>
      </div>

      {/* Filtres Secteurs */}
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

      {/* Interrupteurs */}
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={semaineEnCours}
            onCheckedChange={(val) => {
              setSemaineEnCours(val)
              if (val) {
                const today = new Date()
                const monday = startOfWeek(today, { weekStartsOn: 1 })
                const iso = monday.toISOString().slice(0, 10)
                setSemaine(iso)
                setSelectedSemaine(getWeekNumber(monday).toString())
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
              } else {
                setSelectedSecteurs(["Étages"])
              }
              // ✅ On n'applique plus aucune logique sur la semaine ici
            }}
            className="data-[state=checked]:bg-[#840404]"
          />
          <span className="text-sm">Tous les secteurs</span>
        </div>
      </div>

      {/* Filtres semaine, client, recherche */}
      <div className="flex flex-wrap gap-4 items-center">
        <select
          className="border rounded px-2 py-2 text-sm w-[160px]"
          value={selectedSemaine}
          onChange={(e) => {
            const val = e.target.value
            setSelectedSemaine(val)
            if (val !== "Toutes") setSemaineEnCours(false)
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
          className="border rounded px-2 py-2 text-sm w-[200px]"
          value={client}
          onChange={(e) => setClient(e.target.value)}
        >
          <option value="">Tous les clients</option>
          {clientsDisponibles.map((nom) => (
            <option key={nom} value={nom}>
              {nom}
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

      {/* Boutons d’action */}
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

function getWeekNumber(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1)
  const diff =
    (+date -
      +start +
      (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000) /
    86400000
  return Math.floor((diff + start.getDay() + 6) / 7)
}
