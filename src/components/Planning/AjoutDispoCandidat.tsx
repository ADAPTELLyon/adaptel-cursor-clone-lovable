// AjoutDispoCandidat.tsx
import { useEffect, useState } from "react"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { secteursList } from "@/lib/secteurs"
import { format, startOfWeek, addDays, getWeek } from "date-fns"
import { fr } from "date-fns/locale"
import type { Candidat } from "@/types/types-front"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"
import DispoSemainePanel from "@/components/Planning/DispoSemainePanel"
import { PieChart, Users, CalendarDays, MessageSquareText } from "lucide-react"

export default function AjoutDispoCandidat({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (val: boolean) => void
  onSuccess: () => void
}) {
  const [secteur, setSecteur] = useState("")
  const [candidat, setCandidat] = useState<Candidat | null>(null)
  const [commentaire, setCommentaire] = useState("")
  const [search, setSearch] = useState("")
  const lundi = startOfWeek(new Date(), { weekStartsOn: 1 })
  const [semaine, setSemaine] = useState(getWeek(lundi).toString())  
  const [semainesDisponibles, setSemainesDisponibles] = useState<
    { value: string; label: string; startDate: Date }[]
  >([])
  const [dispos, setDispos] = useState<
    Record<string, { statut: "dispo" | "absence" | "non"; matin: boolean; soir: boolean }>
  >({})
  const [planningMap, setPlanningMap] = useState<
  Record<string, { client: string; horaire: string; statut?: string }[]>
>({})
  const [allMatin, setAllMatin] = useState(true)
  const [allSoir, setAllSoir] = useState(true)

  const { data: candidatsSecteur = [] } = useCandidatsBySecteur(secteur)

  useEffect(() => {
    const semaines: { value: string; label: string; startDate: Date }[] = []
    const today = new Date()
    const start = startOfWeek(today, { weekStartsOn: 1 })

    for (let i = 0; i < 10; i++) {
      const monday = addDays(start, i * 7)
      const value = getWeek(monday).toString()
      const label = `Semaine ${value} - ${format(monday, "dd MMM", {
        locale: fr,
      })} au ${format(addDays(monday, 6), "dd MMM", { locale: fr })}`
      semaines.push({ value, label, startDate: monday })
    }

    setSemainesDisponibles(semaines)
  }, [])

  const semaineObj = semainesDisponibles.find((s) => s.value === semaine)
  const joursSemaine = semaineObj
    ? Array.from({ length: 7 }, (_, i) => {
        const date = addDays(semaineObj.startDate, i)
        const now = new Date()
        const key = format(date, "yyyy-MM-dd")
        const isPast = date < startOfWeek(now, { weekStartsOn: 1 }) || key < format(now, "yyyy-MM-dd")
        return {
          key,
          jour: format(date, "EEEE d MMM", { locale: fr }),
          isPast,
          planifies: planningMap[key] || [],
        }
      })
    : []

  useEffect(() => {
    if (!open) {
      setSecteur("")
      setCandidat(null)
      setDispos({})
      setCommentaire("")
      setAllMatin(true)
      setAllSoir(true)
      setPlanningMap({})
    }
  }, [open])

  useEffect(() => {
    const fetchDispoAndPlanning = async () => {
      if (!candidat || !secteur || !semaineObj) return
      const dates = joursSemaine.map((j) => j.key)

      const [disposRes, planningRes] = await Promise.all([
        supabase
          .from("disponibilites")
          .select("date, statut, dispo_matin, dispo_soir, updated_at")
          .eq("candidat_id", candidat.id)
          .eq("secteur", secteur)
          .in("date", dates),
        supabase
          .from("commandes")
          .select("id, date, statut, updated_at, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir, client:client_id(nom)")
          .eq("candidat_id", candidat.id)
          .eq("secteur", secteur)
          .in("date", dates),

      ])      

      if (disposRes.error || planningRes.error) return

      const dispoMap: typeof dispos = {}
      for (const ligne of disposRes.data) {
        dispoMap[ligne.date] = {
          statut: ligne.statut === "Dispo" ? "dispo" : "absence",
          matin: ligne.dispo_matin,
          soir: ligne.dispo_soir,
        }
      }

      const finalMap: typeof planningMap = {}

      for (const date of dates) {
        const commandes = planningRes.data.filter((p) => p.date === date)
        const dispo = dispoMap[date]
      
        // On récupère la date de dernière mise à jour pour chaque source (approximatif ici)
        const dateDispo = null
        const cmdAnnexe = commandes.find((c) =>
          ["Annule Int", "Annule Client", "Annule ADA", "Absence"].includes(c.statut)
        )
        const cmdValidee = commandes.find((c) => c.statut === "Validé")
      
        const dateAnnexe = cmdAnnexe ? new Date(cmdAnnexe.updated_at || cmdAnnexe.date) : null
        const dateValidee = cmdValidee ? new Date(cmdValidee.updated_at || cmdValidee.date) : null
      
        // Choix prioritaire
        if (cmdAnnexe && (!dateDispo || dateAnnexe >= dateDispo)) {
          finalMap[date] = [{
            client: (cmdAnnexe as any)?.client?.nom || "Client",
            horaire: "",
            statut: cmdAnnexe.statut
          }]
          continue
        }
      
        if (cmdValidee && (!dateDispo || dateValidee >= dateDispo)) {
          const client = (cmdValidee as any)?.client?.nom || "Client"
          const horaires = []
      
          if (cmdValidee.heure_debut_matin) {
            horaires.push({
              client,
              horaire: `${cmdValidee.heure_debut_matin.slice(0, 5)} → ${cmdValidee.heure_fin_matin?.slice(0, 5) || "--:--"}`
            })
          }
      
          if (cmdValidee.heure_debut_soir) {
            horaires.push({
              client,
              horaire: `${cmdValidee.heure_debut_soir.slice(0, 5)} → ${cmdValidee.heure_fin_soir?.slice(0, 5) || "--:--"}`
            })
          }
      
          if (horaires.length) {
            finalMap[date] = horaires.map((h) => ({
              ...h,
              statut: "Validé"
            }))
            continue
          }         
        }
      
        // Sinon on affiche dispo
        if (dispo) {
          finalMap[date] = []
          continue
        }
      }

      setDispos(dispoMap)
      setPlanningMap(finalMap)
    }
    fetchDispoAndPlanning()
  }, [candidat, secteur, semaineObj])

  const toggleStatut = (key: string) => {
    setDispos((prev) => {
      const actuel = prev[key]?.statut || "non"
      const suivant =
        actuel === "non" ? "dispo" : actuel === "dispo" ? "absence" : "non"
      return {
        ...prev,
        [key]: {
          statut: suivant,
          matin: prev[key]?.matin ?? true,
          soir: prev[key]?.soir ?? true,
        },
      }
    })
  }

  const handleToggleMatin = (key: string) => {
    setDispos((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        matin: !prev[key]?.matin,
      },
    }))
  }

  const handleToggleSoir = (key: string) => {
    setDispos((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        soir: !prev[key]?.soir,
      },
    }))
  }

  const appliquerTous = (statut: "dispo" | "absence") => {
    const updated: typeof dispos = {}
    joursSemaine.forEach((j) => {
      if (!j.isPast && !(planningMap[j.key]?.length)) {
        updated[j.key] = {
          statut,
          matin: allMatin,
          soir: allSoir,
        }
      }
    })
    setDispos(updated)
  }

  const appliquerMatinSoir = (creneau: "matin" | "soir", value: boolean) => {
    const updated = { ...dispos }
    for (const key in updated) {
      if (updated[key].statut === "dispo") {
        updated[key][creneau] = value
      }
    }
    setDispos(updated)
  }

  const handleSave = async () => {
    if (!candidat || !secteur) return

    const { data: existantes, error: fetchErr } = await supabase
      .from("disponibilites")
      .select("id, date")
      .eq("candidat_id", candidat.id)
      .eq("secteur", secteur)

    if (fetchErr) {
      toast({ title: "Erreur", description: "Chargement échoué", variant: "destructive" })
      return
    }

    const update: any[] = []
    const insert: any[] = []

    for (const [date, d] of Object.entries(dispos)) {
      if (!["dispo", "absence"].includes(d.statut)) continue
      if (planningMap[date]?.length) continue

      const payload = {
        candidat_id: candidat.id,
        date,
        secteur,
        service: null,
        statut: d.statut === "dispo" ? "Dispo" : "Non Dispo",
        commentaire,
        dispo_matin: d.matin,
        dispo_soir: d.soir,
        dispo_nuit: false,
      }

      const existe = existantes?.find((e) => e.date === date)
      if (existe) {
        update.push({ ...payload, id: existe.id })
      } else {
        insert.push(payload)
      }
    }

    const [{ error: errInsert }, { error: errUpdate }] = await Promise.all([
      insert.length > 0
        ? supabase.from("disponibilites").insert(insert)
        : Promise.resolve({ error: null }),
      update.length > 0
        ? Promise.all(
            update.map((u) =>
              supabase.from("disponibilites").update(u).eq("id", u.id)
            )
          ).then(() => ({ error: null }))
        : Promise.resolve({ error: null }),
    ])

    if (errInsert || errUpdate) {
      toast({ title: "Erreur", description: "Échec d'enregistrement", variant: "destructive" })
      return
    }

    toast({ title: "Disponibilités enregistrées" })
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Saisie disponibilités
            {secteur && (
              <span className="text-sm bg-[#840404] text-white px-2 py-1 rounded">{secteur}</span>
            )}
            {candidat && (
              <span className="text-sm bg-[#840404] text-white px-2 py-1 rounded">
                {candidat.nom} {candidat.prenom}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 mt-4">
          {/* Partie gauche en sections claires */}
          <div className="space-y-6">
            {/* Section Secteur */}
            <div className="space-y-2 border rounded-lg p-4 bg-gray-50 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <PieChart className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">Secteur</h3>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {secteursList.map(({ label, icon: Icon }) => (
                  <Button
                    key={label}
                    variant="outline"
                    className={`flex flex-col items-center justify-center gap-1 text-xs py-2 h-16 ${
                      secteur === label ? "bg-[#840404] text-white hover:bg-[#750303]" : ""
                    }`}
                    onClick={() => {
                      setSecteur(label)
                      setCandidat(null)
                    }}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

          {/* Section Candidats */}
<div className="space-y-2 border rounded-lg p-4 bg-gray-50 shadow-sm">
  <div className="flex items-center gap-2 mb-2">
    <Users className="w-4 h-4 text-muted-foreground" />
    <h3 className="font-medium text-sm">Candidats</h3>
  </div>

  <input
    type="text"
    placeholder="Rechercher un candidat"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="w-full px-2 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#840404]"
  />

  <div className="border p-2 h-[240px] overflow-y-auto rounded bg-white shadow-sm">
    {secteur && candidatsSecteur.length > 0 ? (
      candidatsSecteur
        .filter((c) =>
          `${c.nom} ${c.prenom}`.toLowerCase().includes(search.toLowerCase())
        )
        .map((c) => (
          <Button
            key={c.id}
            variant={candidat?.id === c.id ? "default" : "outline"}
            className="w-full justify-start text-left mb-1"
            onClick={() => setCandidat(c)}
          >
            {c.nom} {c.prenom}
          </Button>
        ))
    ) : (
      <div className="text-sm text-muted-foreground italic">
        Aucun secteur sélectionné
      </div>
    )}
  </div>
</div>

            {/* Section Semaine */}
            <div className="space-y-2 border rounded-lg p-4 bg-gray-50 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">Semaine</h3>
              </div>
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

            {/* Section Commentaire */}
            <div className="space-y-2 border rounded-lg p-4 bg-gray-50 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquareText className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">Commentaire</h3>
              </div>
              <Textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Ajouter un commentaire"
                className="min-h-[80px]"
              />
            </div>
          </div>

          {/* Partie droite identique */}
          <DispoSemainePanel
            joursSemaine={joursSemaine}
            dispos={dispos}
            toggleStatut={toggleStatut}
            handleToggleMatin={handleToggleMatin}
            handleToggleSoir={handleToggleSoir}
            appliquerMatinSoir={appliquerMatinSoir}
            allMatin={allMatin}
            setAllMatin={setAllMatin}
            allSoir={allSoir}
            setAllSoir={setAllSoir}
            handleSave={handleSave}
            appliquerTous={appliquerTous}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
