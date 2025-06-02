import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  Plus,
  CalendarCheck,
  AlertCircle,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react"
import { secteursList } from "@/lib/secteurs"
import { startOfWeek, getWeek } from "date-fns"
import NouvelleCommandeDialog from "../../components/commandes/NouvelleCommandeDialog"
import AjoutDispoCandidat from "../../components/Planning/AjoutDispoCandidat"
import SaisirIncidentDialog from "../../components/commandes/SaisirIncidentDialog"

export function SectionFixeCommandes({
  selectedSecteurs,
  setSelectedSecteurs,
  stats,
  totauxSemaine,
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
}: any) {
  const [openNouvelleCommande, setOpenNouvelleCommande] = useState(false)
  const [openDispo, setOpenDispo] = useState(false)
  const [openIncident, setOpenIncident] = useState(false)

  return (
    <div className="sticky top-[64px] z-10 bg-white shadow-sm px-6 py-4 space-y-4">
      <div className="grid grid-cols-5 gap-2">
        {secteursList.map(({ label, icon: Icon }) => {
          const selected = selectedSecteurs.includes(label)
          return (
            <button
              key={label}
              className={cn(
                "w-full h-10 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all border shadow-sm",
                selected
                  ? "bg-[#840404] text-white border-[#840404]"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              )}
              onClick={() => {
                if (toutAfficher) setToutAfficher(false)
                setSelectedSecteurs([label])
              }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          )
        })}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
          <SlidersHorizontal className="w-4 h-4" />
          Filtres planning
        </div>

        <div className="flex flex-wrap items-center gap-4">
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
                }}
                className="data-[state=checked]:bg-[#840404]"
              />
              <span className="text-sm">Tous les secteurs</span>
            </div>
          </div>

          <div className="w-px h-6 bg-gray-300" />

          <select
            className="border rounded px-2 py-2 text-sm w-[160px]"
            value={selectedSemaine}
            onChange={(e) => {
              const val = e.target.value
              if (val === "Toutes") {
                setSelectedSemaine("Toutes")
                setSemaineEnCours(false)
              } else {
                setSelectedSemaine(val)
                setSemaineEnCours(false)
              }
            }}
          >
            <option value="Toutes">Toutes les semaines</option>
            {semainesDisponibles.map((s: string) => (
              <option key={s} value={s}>
                Semaine {s}
              </option>
            ))}
          </select>

          <select
            className="border rounded px-2 py-2 text-sm w-[160px]"
            value={client}
            onChange={(e) => setClient(e.target.value)}
          >
            <option value="">Tous les clients</option>
            {clientsDisponibles.map((nom: string) => (
              <option key={nom} value={nom}>
                {nom}
              </option>
            ))}
          </select>

          <Input
            placeholder="Rechercher..."
            className="w-[200px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            className="bg-[#840404] hover:bg-[#750303] text-white flex items-center gap-2"
            onClick={() => setOpenNouvelleCommande(true)}
          >
            <Plus size={16} /> Nouvelle commande
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setOpenDispo(true)}
          >
            <CalendarCheck size={16} /> Saisir disponibilités
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setOpenIncident(true)}
          >
            <AlertCircle size={16} /> Saisir incident
          </Button>

          <div className="w-px h-6 bg-gray-300" />

          <Button
            variant="ghost"
            size="icon"
            onClick={resetFiltres}
            className="border border-gray-300 rounded-full text-muted-foreground"
          >
            <RotateCcw size={18} />
          </Button>
        </div>
      </div>

      <NouvelleCommandeDialog
        open={openNouvelleCommande}
        onOpenChange={setOpenNouvelleCommande}
      />

      <AjoutDispoCandidat
        open={openDispo}
        onOpenChange={setOpenDispo}
        onSuccess={() => {}}
      />

      <SaisirIncidentDialog
        open={openIncident}
        onOpenChange={setOpenIncident}
      />
    </div>
  )
}

function getWeekNumber(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1)
  const diff =
    (+date - +start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000) /
    86400000
  return Math.floor((diff + start.getDay() + 6) / 7)
}
