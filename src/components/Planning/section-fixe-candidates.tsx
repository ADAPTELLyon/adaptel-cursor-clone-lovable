import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { Plus, CalendarCheck, AlertCircle, RotateCcw } from "lucide-react"
import { secteursList } from "@/lib/secteurs"
import { startOfWeek } from "date-fns"
import AjoutDispoCandidat from "@/components/Planning/AjoutDispoCandidat"
import NouvelleCommandeDialog from "@/components/commandes/NouvelleCommandeDialog"
import SaisirIncidentDialog from "@/components/commandes/SaisirIncidentDialog"
import SectionStatutPlanning from "@/components/Planning/SectionStatutPlanning"

export function SectionFixeCandidates({
  selectedSecteurs,
  setSelectedSecteurs,
  stats,
  semaine,
  setSemaine,
  selectedSemaine,
  setSelectedSemaine,
  candidat,
  setCandidat,
  search,
  setSearch,
  toutAfficher,
  setToutAfficher,
  dispo,
  setDispo,
  semaineEnCours,
  setSemaineEnCours,
  resetFiltres,
  semainesDisponibles,
  candidatsDisponibles,
  setRefreshTrigger,
}: {
  selectedSecteurs: string[]
  setSelectedSecteurs: (val: string[]) => void
  stats: { Dispo: number; "Non Dispo": number; Planifié: number }
  semaine: string
  setSemaine: (s: string) => void
  selectedSemaine: string
  setSelectedSemaine: (val: string) => void
  candidat: string
  setCandidat: (s: string) => void
  search: string
  setSearch: (s: string) => void
  toutAfficher: boolean
  setToutAfficher: (b: boolean) => void
  dispo: boolean
  setDispo: (b: boolean) => void
  semaineEnCours: boolean
  setSemaineEnCours: (b: boolean) => void
  resetFiltres: () => void
  semainesDisponibles: string[]
  candidatsDisponibles: string[]
  setRefreshTrigger: React.Dispatch<React.SetStateAction<number>>
}) {
  const [openDispo, setOpenDispo] = useState(false)
  const [openCommande, setOpenCommande] = useState(false)
  const [openIncident, setOpenIncident] = useState(false)

  return (
    <div className="sticky top-[64px] z-10 bg-white shadow-sm p-4 space-y-6">
      <SectionStatutPlanning stats={stats} />

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
                const monday = startOfWeek(today, { weekStartsOn: 1 })
                const iso = monday.toISOString().slice(0, 10)
                setSemaine(iso)
                setSelectedSemaine(getWeekNumber(monday).toString())
              } else {
                setSemaineEnCours(false)
                setSelectedSemaine("Toutes")
              }
            }}
            className="data-[state=checked]:bg-[#840404]"
          />
          <span className="text-sm">Semaine en cours</span>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={dispo}
            onCheckedChange={setDispo}
            className="data-[state=checked]:bg-[#840404]"
          />
          <span className="text-sm">Dispo</span>
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
          value={candidat}
          onChange={(e) => setCandidat(e.target.value)}
        >
          <option value="">Tous les candidats</option>
          {candidatsDisponibles.map((nom) => (
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

      <div className="flex flex-wrap items-center gap-4">
        <Button
          className="bg-[#840404] hover:bg-[#750303] text-white flex items-center gap-2"
          onClick={() => setOpenDispo(true)}
        >
          <CalendarCheck size={16} /> Saisir disponibilités
        </Button>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setOpenCommande(true)}
        >
          <Plus size={16} /> Nouvelle commande
        </Button>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setOpenIncident(true)}
        >
          <AlertCircle size={16} /> Saisir incident
        </Button>
      </div>

      <AjoutDispoCandidat
        open={openDispo}
        onOpenChange={setOpenDispo}
        onSuccess={() => setRefreshTrigger((x) => x + 1)}
      />

      <NouvelleCommandeDialog
        open={openCommande}
        onOpenChange={setOpenCommande}
        onRefresh={async () => setRefreshTrigger((x) => x + 1)}
        onRefreshDone={() => {}}
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
    (+date -
      +start +
      (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000) /
    86400000
  return Math.floor((diff + start.getDay() + 6) / 7)
}
