import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog"
  import { Button } from "@/components/ui/button"
  import { Input } from "@/components/ui/input"
  import { Textarea } from "@/components/ui/textarea"
  import { Switch } from "@/components/ui/switch"
  import { secteursList } from "@/lib/secteurs"
  import { useClientsBySecteur } from "@/hooks/useClientsBySecteur"
  import { usePostesTypesByClient } from "@/hooks/usePostesTypesByClient"
  import { useEffect, useState } from "react"
  import { format, addWeeks, startOfWeek, addDays } from "date-fns"
  import { fr } from "date-fns/locale"
  
  export default function NouvelleCommandeDialog({
    open,
    onOpenChange,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
  }) {
    const [secteur, setSecteur] = useState<string>("")
    const [clientId, setClientId] = useState<string>("")
    const [service, setService] = useState<string>("")
    const [semaine, setSemaine] = useState<string>("")
    const [commentaire, setCommentaire] = useState<string>("")
    const [motif, setMotif] = useState<string>("Extra Usage constant")
    const [joursState, setJoursState] = useState<Record<string, boolean>>({})
    const [semainesDisponibles, setSemainesDisponibles] = useState<
      { value: string; label: string; startDate: Date }[]
    >([])
  
    const { clients } = useClientsBySecteur(secteur)
    const selectedClient = clients.find((c) => c.id === clientId)
    const services = selectedClient?.services || []
  
    const { postesTypes } = usePostesTypesByClient(clientId, secteur)
  
    useEffect(() => {
      const semaines: { value: string; label: string; startDate: Date }[] = []
      const today = new Date()
      const start = addWeeks(today, -6)
      const end = addWeeks(today, 16)
  
      let current = startOfWeek(start, { weekStartsOn: 1 })
      while (current <= end) {
        const weekNumber = getWeekNumber(current)
        const weekStart = format(current, "dd MMM", { locale: fr })
        const weekEnd = format(addDays(current, 6), "dd MMM", { locale: fr })
        semaines.push({
          value: weekNumber.toString(),
          label: `Semaine ${weekNumber} - ${weekStart} au ${weekEnd}`,
          startDate: current,
        })
        current = addWeeks(current, 1)
      }
      setSemainesDisponibles(semaines)
      const currentWeek = getWeekNumber(new Date())
      setSemaine(currentWeek.toString())
    }, [])
  
    const semaineObj = semainesDisponibles.find((s) => s.value === semaine)
    const joursSemaine = semaineObj
      ? Array.from({ length: 7 }, (_, i) => {
          const date = addDays(semaineObj.startDate, i)
          return {
            jour: format(date, "EEEE dd MMMM", { locale: fr }),
            key: format(date, "yyyy-MM-dd"),
          }
        })
      : []
  
    const toggleJour = (key: string) => {
      setJoursState((prev) => ({ ...prev, [key]: !prev[key] }))
    }
  
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Nouvelle commande</DialogTitle>
          </DialogHeader>
  
          <div className="grid grid-cols-2 gap-6 mt-4">
            {/* Partie gauche */}
            <div className="space-y-6 border p-4 rounded-lg shadow-md bg-white">
              {/* Secteurs */}
              <div className="space-y-2">
                <div className="font-semibold text-sm">Secteur</div>
                <div className="grid grid-cols-5 gap-2">
                  {secteursList.map(({ label, icon: Icon }) => (
                    <Button
                      key={label}
                      variant={secteur === label ? "default" : "outline"}
                      className="flex items-center justify-center gap-1 text-xs py-2"
                      onClick={() => {
                        setSecteur(label)
                        setClientId("")
                        setService("")
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
  
              {/* Client */}
              <div className="space-y-2">
                <div className="font-semibold text-sm">Client</div>
                <select
                  className="border rounded w-full px-2 py-2 text-sm"
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value)
                    setService("")
                  }}
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nom}
                    </option>
                  ))}
                </select>
              </div>
  
              {/* Service */}
              <div className="space-y-2">
                <div className="font-semibold text-sm">Service</div>
                <select
                  className={`border rounded w-full px-2 py-2 text-sm ${
                    services.length === 0 ? "opacity-50 cursor-not-allowed bg-gray-100" : ""
                  }`}
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  disabled={services.length === 0}
                >
                  <option value="">
                    {services.length === 0
                      ? "Aucun service disponible"
                      : "Sélectionner un service"}
                  </option>
                  {services.map((svc) => (
                    <option key={svc} value={svc}>
                      {svc}
                    </option>
                  ))}
                </select>
              </div>
  
              {/* Semaine */}
              <div className="space-y-2">
                <div className="font-semibold text-sm">Semaine</div>
                <select
                  className="border rounded w-full px-2 py-2 text-sm"
                  value={semaine}
                  onChange={(e) => setSemaine(e.target.value)}
                >
                  {semainesDisponibles.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
  
              {/* Motif */}
              <div className="space-y-2">
                <div className="font-semibold text-sm">Motif contrat</div>
                <select
                  className="border rounded w-full px-2 py-2 text-sm"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                >
                  <option>Extra Usage constant</option>
                  <option>Accroissement d’activité</option>
                  <option>Remplacement de personnel</option>
                </select>
                {(motif === "Accroissement d’activité" ||
                  motif === "Remplacement de personnel") && (
                  <Input
                    placeholder="Précisez le motif"
                    className="mt-2"
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                  />
                )}
              </div>
  
              {/* Info */}
              <div className="space-y-2">
                <div className="font-semibold text-sm">Information</div>
                <Textarea
                  placeholder="Informations complémentaires..."
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                />
              </div>
  
              {/* Poste type */}
              <div className="space-y-2">
                <div className="font-semibold text-sm">Poste type</div>
                <select
                  className="border rounded w-full px-2 py-2 text-sm"
                  disabled={!postesTypes || postesTypes.length === 0}
                >
                  <option>
                    {postesTypes.length === 0
                      ? "Aucun poste type disponible"
                      : "Sélectionner un poste type"}
                  </option>
                  {postesTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.nom}
                    </option>
                  ))}
                </select>
              </div>
            </div>
  
            {/* Partie droite */}
            <div className="space-y-4 border p-4 rounded-lg shadow-md bg-white">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">Activer toutes les journées</div>
                <Switch
                  onCheckedChange={(val) => {
                    const newState: Record<string, boolean> = {}
                    joursSemaine.forEach((j) => {
                      newState[j.key] = val
                    })
                    setJoursState(newState)
                  }}
                />
              </div>
              <Button variant="outline" size="sm">
                Répliquer les heures
              </Button>
              <div className="grid grid-cols-1 gap-2">
                {joursSemaine.map((j) => (
                  <div
                    key={j.key}
                    className="border rounded p-3 space-y-2 bg-gray-50 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{j.jour}</div>
                      <Switch
                        checked={joursState[j.key] || false}
                        onCheckedChange={() => toggleJour(j.key)}
                      />
                    </div>
  
                    {joursState[j.key] && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Input type="time" placeholder="Heure début matin" />
                        <Input type="time" placeholder="Heure fin matin" />
                        <Input type="time" placeholder="Heure début soir" />
                        <Input type="time" placeholder="Heure fin soir" />
                        <Input type="number" placeholder="Nb de personnes" min={1} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-4">
                <Button className="w-full bg-[#840404] hover:bg-[#750303] text-white">
                  Valider
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
  