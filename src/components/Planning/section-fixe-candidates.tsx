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
  Send,
} from "lucide-react"
import { secteursList } from "@/lib/secteurs"
import { startOfWeek } from "date-fns"
import AjoutDispoCandidat from "@/components/Planning/AjoutDispoCandidat"
import NouvelleCommandeDialog from "@/components/commandes/NouvelleCommandeDialog"
import SaisirIncidentDialog from "@/components/commandes/SaisirIncidentDialog"
import SectionStatutPlanning from "@/components/Planning/SectionStatutPlanning"
import { Separator } from "@/components/ui/separator"
import FicheMemoCandidat from "@/components/commandes/Fiche-Memo-Candidat"
import PopoverSelectCandidat from "@/components/commandes/PopoverSelectCandidat"
import { Building2 } from "lucide-react"
import PopoverSelectClient from "@/components/commandes/PopoverSelectClient"
import FicheMemoClient from "@/components/clients/FicheMemoClient"

// NEW: popup "Envoyer planning candidat" (on le crée juste après)
import EnvoyerPlanningCandidatDialog from "./EnvoyerPlanningCandidatDialog"

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
  stats: { Dispo: number; "Non Dispo": number; Planifié: number; "Non renseigné"?: number }
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
  const [showSelectCandidat, setShowSelectCandidat] = useState(false)
  const [openFicheCandidat, setOpenFicheCandidat] = useState(false)
  const [selectedCandidatId, setSelectedCandidatId] = useState<string | null>(null)
  const [showSelectClient, setShowSelectClient] = useState(false)
  const [openFicheClient, setOpenFicheClient] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  // NEW: ouverture popup "Envoyer planning"
  const [openSendPlanning, setOpenSendPlanning] = useState(false)

  // Groupement des semaines par année pour l'affichage <optgroup>, à partir des clés "YYYY-WW"
  const groupedSemaines = (() => {
    const map: Record<number, number[]> = {}

    semainesDisponibles.forEach((key) => {
      const [yearStr, weekStr] = key.split("-")
      const year = parseInt(yearStr, 10)
      const week = parseInt(weekStr, 10)
      if (Number.isNaN(year) || Number.isNaN(week)) return
      if (!map[year]) map[year] = []
      if (!map[year].includes(week)) map[year].push(week)
    })

    return Object.entries(map)
      .map(([yearStr, weeks]) => ({
        year: parseInt(yearStr, 10),
        weeks: (weeks as number[]).sort((a, b) => a - b),
      }))
      .sort((a, b) => a.year - b.year)
  })()

  return (
    <div className="sticky top-[64px] z-10 bg-white shadow-sm p-4 pb-4 border-b border-gray-100 space-y-6">
      <SectionStatutPlanning stats={stats} />

      <div className="grid grid-cols-5 gap-2">
        {secteursList.map(({ label, icon: Icon }) => {
          const selected = selectedSecteurs.includes(label)
          return (
            <Button
              key={label}
              className={cn(
                "py-2 h-10 w-full text-sm font-medium flex items-center justify-center gap-2",
                selected
                  ? "bg-[#840404] text-white hover:bg-[#750303]"
                  : "bg-gray-100 text-black hover:bg-gray-200"
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

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={semaineEnCours}
            onCheckedChange={(val) => {
              setSemaineEnCours(val)
              if (val) {
                // On met à jour juste la date de référence (lundi de la semaine)
                const today = new Date()
                const monday = startOfWeek(today, { weekStartsOn: 1 })
                const iso = monday.toISOString().slice(0, 10)
                setSemaine(iso)
                // La valeur de selectedSemaine sera forcée côté page (Planning.tsx)
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
        {/* Sélecteur de semaine avec titres Année, comme sur Commandes */}
        <select
          className="border rounded px-2 py-2 text-sm w-[200px]"
          value={selectedSemaine}
          onChange={(e) => {
            const val = e.target.value
            setSelectedSemaine(val)
            // sélectionner via la liste “déconnecte” l’interrupteur
            setSemaineEnCours(false)
          }}
        >
          <option value="Toutes">Toutes les semaines</option>
          {groupedSemaines.map(({ year, weeks }) => (
            <optgroup key={year} label={`Année ${year}`}>
              {weeks.map((w) => {
                const value = `${year}-${String(w).padStart(2, "0")}`
                return (
                  <option key={value} value={value}>
                    {`Semaine ${w}`}
                  </option>
                )
              })}
            </optgroup>
          ))}
        </select>

        <select
          className="border rounded px-2 py-2 text-sm w[200px]"
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

        <div className="relative">
          <Input
            placeholder="Rechercher..."
            className="pl-10 w-[220px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSelectClient(true)}
          className="border border-gray-300 rounded-full text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          title="Infos client"
        >
          <Building2 size={18} />
        </Button>

        <Separator orientation="vertical" className="h-8" />

        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setOpenSendPlanning(true)}
        >
          <Send size={16} /> Envoyer planning
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
        onRefreshDone={() => {}}
      />

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

      <PopoverSelectClient
        open={showSelectClient}
        onOpenChange={setShowSelectClient}
        onClientSelected={(id) => {
          setSelectedClientId(id)
          setShowSelectClient(false)
          setOpenFicheClient(true)
        }}
      />

      {selectedClientId && (
        <FicheMemoClient
          open={openFicheClient}
          onOpenChange={setOpenFicheClient}
          clientId={selectedClientId}
        />
      )}

      <EnvoyerPlanningCandidatDialog
        open={openSendPlanning}
        onOpenChange={setOpenSendPlanning}
      />
    </div>
  )
}
