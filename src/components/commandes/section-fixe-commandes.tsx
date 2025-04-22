import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { Plus, CalendarCheck, AlertCircle, RotateCcw } from "lucide-react"

const secteurs = ["Étages", "Cuisine", "Salle", "Plonge", "Réception"]

export function SectionFixeCommandes() {
  const [selectedSecteur, setSelectedSecteur] = useState("Étages")
  const [semaineEnCours, setSemaineEnCours] = useState(true)
  const [enRecherche, setEnRecherche] = useState(false)
  const [toutAfficher, setToutAfficher] = useState(false)
  const [semaine, setSemaine] = useState("")
  const [client, setClient] = useState("")
  const [search, setSearch] = useState("")

  const [stats, setStats] = useState({
    demandées: 0,
    validées: 0,
    enRecherche: 0,
    nonPourvue: 0,
  })

  const taux = stats.demandées > 0 ? Math.round((stats.validées / stats.demandées) * 100) : 0

  useEffect(() => {
    // TODO: Récupérer dynamiquement les données à partir du store ou props
  }, [])

  return (
    <div className="sticky top-0 z-10 bg-white shadow-sm p-4 space-y-6">
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-xl bg-blue-100 p-3">
          <div className="text-xs text-blue-700">Demandées</div>
          <div className="text-2xl font-bold text-blue-900">{stats.demandées}</div>
        </div>
        <div className="rounded-xl bg-green-100 p-3">
          <div className="text-xs text-green-700">Validées</div>
          <div className="text-2xl font-bold text-green-900">{stats.validées}</div>
        </div>
        <div className="rounded-xl bg-orange-100 p-3">
          <div className="text-xs text-orange-700">En recherche</div>
          <div className="text-2xl font-bold text-orange-900">{stats.enRecherche}</div>
        </div>
        <div className="rounded-xl bg-red-100 p-3">
          <div className="text-xs text-red-700">Non pourvue</div>
          <div className="text-2xl font-bold text-red-900">{stats.nonPourvue}</div>
        </div>
      </div>

      <div className="relative">
        <div className="h-6 w-full rounded bg-gray-200 overflow-hidden">
          <div
            className="h-full text-xs flex items-center justify-center text-white font-medium"
            style={{ width: `${taux}%`, backgroundColor: taux === 100 ? '#84cc16' : '#fb923c' }}
          >
            {taux === 100 ? "Tout validé" : `${taux}% validé`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {secteurs.map((secteur) => (
          <Button
            key={secteur}
            className={cn(
              "py-2 h-10 w-full text-sm font-medium",
              secteur === selectedSecteur
                ? "bg-[#840404] text-white hover:bg-[#750303]"
                : "bg-gray-100 text-black hover:bg-gray-200"
            )}
            onClick={() => setSelectedSecteur(secteur)}
          >
            {secteur}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={semaineEnCours}
            onCheckedChange={setSemaineEnCours}
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
            onCheckedChange={setToutAfficher}
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
          onClick={() => {
            setSemaineEnCours(true)
            setSemaine("")
            setClient("")
            setSelectedSecteur("Étages")
            setToutAfficher(false)
            setEnRecherche(false)
            setSearch("")
          }}
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
