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
  User2,
} from "lucide-react"
import { secteursList } from "@/lib/secteurs"
import { startOfWeek } from "date-fns"
import NouvelleCommandeDialog from "../../components/commandes/NouvelleCommandeDialog"
import AjoutDispoCandidat from "../../components/Planning/AjoutDispoCandidat"
import SaisirIncidentDialog from "../../components/commandes/SaisirIncidentDialog"
import { Separator } from "@/components/ui/separator"
import { FicheMemoCandidat } from "./Fiche-Memo-Candidat"
import PopoverSelectCandidat from "./PopoverSelectCandidat"

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

  const [showSelectCandidat, setShowSelectCandidat] = useState(false)
  const [openFicheCandidat, setOpenFicheCandidat] = useState(false)
  const [selectedCandidatId, setSelectedCandidatId] = useState<string | null>(null)

  return (
    <div className="sticky top-[64px] z-10 bg-white shadow-sm px-6 pb-4 pt-2 border-b border-gray-100">
      <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-4 space-y-4 shadow-sm">

        {/* Secteurs */}
        <div className="grid grid-cols-5 gap-2">
          {secteursList.map(({ label, icon: Icon }) => {
            const selected = selectedSecteurs.includes(label)
            return (
              <Button
                key={label}
                variant={selected ? "default" : "outline"}
                className={cn(
                  "w-full h-10 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all",
                  selected ? "bg-[#840404] hover:bg-[#840404]/90" : "hover:bg-gray-50"
                )}
                onClick={() => {
                  if (toutAfficher) setToutAfficher(false)
                  setSelectedSecteurs([label])
                }}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            )
          })}
        </div>

        <Separator className="my-2" />

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="semaine-en-cours"
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
              <Label htmlFor="semaine-en-cours">Semaine en cours</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="en-recherche"
                checked={enRecherche}
                onCheckedChange={setEnRecherche}
                className="data-[state=checked]:bg-[#840404]"
              />
              <Label htmlFor="en-recherche">En recherche</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="tous-secteurs"
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
              <Label htmlFor="tous-secteurs">Tous les secteurs</Label>
            </div>
          </div>

          <Separator orientation="vertical" className="h-8" />

          <div className="flex items-center gap-3">
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={selectedSemaine}
              onChange={(e) => {
                setSelectedSemaine(e.target.value)
                setSemaineEnCours(false)
              }}
            >
              <option value="Toutes">Toutes les semaines</option>
              {semainesDisponibles.map((s: string) => (
                <option key={s} value={s}>Semaine {s}</option>
              ))}
            </select>

            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            >
              <option value="">Tous les clients</option>
              {clientsDisponibles.map((nom: string) => (
                <option key={nom} value={nom}>{nom}</option>
              ))}
            </select>

            <div className="relative">
              <Input
                placeholder="Rechercher..."
                className="pl-10 w-[200px] border-gray-300 focus:ring-2 focus:ring-[#840404]/20 focus:border-[#840404]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="bg-[#840404] hover:bg-[#750303] text-white flex items-center gap-2 shadow-sm"
            onClick={() => setOpenNouvelleCommande(true)}
          >
            <Plus size={16} /> Nouvelle commande
          </Button>

          <Button
            variant="outline"
            className="flex items-center gap-2 border-gray-300 hover:bg-gray-50"
            onClick={() => setOpenDispo(true)}
          >
            <CalendarCheck size={16} /> Saisir disponibilités
          </Button>

          <Button
            variant="outline"
            className="flex items-center gap-2 border-gray-300 hover:bg-gray-50"
            onClick={() => setOpenIncident(true)}
          >
            <AlertCircle size={16} /> Saisir incident
          </Button>

          <Separator orientation="vertical" className="h-8" />

          <Button
            variant="ghost"
            size="icon"
            onClick={resetFiltres}
            className="border border-gray-300 rounded-full text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            title="Réinitialiser les filtres"
          >
            <RotateCcw size={18} />
          </Button>

          <Separator orientation="vertical" className="h-8" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSelectCandidat(true)}
            className="border border-gray-300 rounded-full text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            title="Infos candidat"
          >
            <User2 size={18} />
          </Button>
        </div>
      </div>

      <NouvelleCommandeDialog open={openNouvelleCommande} onOpenChange={setOpenNouvelleCommande} />
      <AjoutDispoCandidat open={openDispo} onOpenChange={setOpenDispo} onSuccess={() => {}} />
      <SaisirIncidentDialog open={openIncident} onOpenChange={setOpenIncident} />
      <PopoverSelectCandidat
        open={showSelectCandidat}
        onOpenChange={setShowSelectCandidat}
        onCandidatSelected={(id) => {
          setSelectedCandidatId(id)
          setShowSelectCandidat(false)
          setOpenFicheCandidat(true)
        }}
      />
      {selectedCandidatId && (
        <FicheMemoCandidat
          open={openFicheCandidat}
          onOpenChange={setOpenFicheCandidat}
          candidatId={selectedCandidatId}
        />
      )}
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

function Label({ htmlFor, className, children }: { htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={cn("text-sm font-medium text-gray-700", className)}>
      {children}
    </label>
  )
}
