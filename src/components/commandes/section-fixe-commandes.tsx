import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { Plus, CalendarCheck, AlertCircle, RotateCcw } from "lucide-react"
import { indicateurColors } from "@/lib/colors"
import { secteursList } from "@/lib/secteurs"
import { startOfWeek, getWeek } from "date-fns"
import NouvelleCommandeDialog from "@/components/commandes/NouvelleCommandeDialog"
import IndicateurCard from "@/components/ui/IndicateurCard"

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

  return (
    <div className="sticky top-[64px] z-10 bg-white shadow-sm p-4 space-y-6">
      {/* Bloc indicateurs + cercle */}
      <div className="grid grid-cols-[1fr_auto] gap-6 items-start">
        <div className="flex flex-wrap gap-4">
          <IndicateurCard
            label="Demandées"
            value={stats.demandées}
            total={totauxSemaine.demandées}
            color={indicateurColors["Demandées"]}
          />
          <IndicateurCard
            label="Validées"
            value={stats.validées}
            total={totauxSemaine.validées}
            color={indicateurColors["Validées"]}
          />
          <IndicateurCard
            label="En recherche"
            value={stats.enRecherche}
            total={totauxSemaine.enRecherche}
            color={indicateurColors["En recherche"]}
          />
          <IndicateurCard
            label="Non pourvue"
            value={stats.nonPourvue}
            total={totauxSemaine.nonPourvue}
            color={indicateurColors["Non pourvue"]}
          />
        </div>
        <div className="self-center w-[180px] h-[160px] flex items-center justify-center border rounded-md bg-gray-100">
          <span className="text-sm text-muted-foreground">ProgressCircle à venir</span>
        </div>
      </div>

      {/* Mini-cards secteurs + comparatif */}
      <div className="grid grid-cols-[1fr_auto] gap-6 items-start">
        <div className="grid grid-cols-5 gap-2 flex-1">
          {["Étages", "Cuisine", "Salle", "Plonge", "Réception"].map((secteur, index) => (
            <div
              key={index}
              className="h-[60px] bg-white border rounded-md flex items-center justify-center text-sm text-muted-foreground"
            >
              {secteur}
            </div>
          ))}
        </div>
        <div className="w-[200px] h-[60px] bg-gray-100 border rounded-md flex flex-col items-center justify-center">
          <span className="text-sm text-muted-foreground">Comparatif N-1</span>
          <span className="text-xs text-gray-400">(à venir)</span>
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

      {/* Filtres semaine, client, recherche */}
      <div className="flex flex-wrap gap-4 items-center">
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
        <Button
          className="bg-[#840404] hover:bg-[#750303] text-white flex items-center gap-2"
          onClick={() => setOpenNouvelleCommande(true)}
        >
          <Plus size={16} /> Nouvelle commande
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <CalendarCheck size={16} /> Saisir disponibilités
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <AlertCircle size={16} /> Saisir incident
        </Button>
      </div>

      <NouvelleCommandeDialog
        open={openNouvelleCommande}
        onOpenChange={setOpenNouvelleCommande}
      />
    </div>
  )
}

function getWeekNumber(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1)
  const diff =
    (+date - +start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000) / 86400000
  return Math.floor((diff + start.getDay() + 6) / 7)
}
