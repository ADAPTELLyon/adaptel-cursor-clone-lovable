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
  const [semaine, setSemaine] = useState(getWeek(new Date()).toString())
  const [semainesDisponibles, setSemainesDisponibles] = useState<
    { value: string; label: string; startDate: Date }[]
  >([])
  const [dispos, setDispos] = useState<
    Record<string, { statut: "dispo" | "absence" | "non"; matin: boolean; soir: boolean }>
  >({})
  const [planningMap, setPlanningMap] = useState<
    Record<string, { client: string; horaire: string }[]>
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
          .select("*")
          .eq("candidat_id", candidat.id)
          .eq("secteur", secteur)
          .in("date", dates),
        supabase
          .from("commandes")
          .select("date, client:clients(nom), heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir")
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

      const planMap: Record<string, { client: string; horaire: string }[]> = {}
      for (const p of planningRes.data) {
        const date = p.date
        const client = p.client?.nom || "Client"
        const plans: { client: string; horaire: string }[] = []

        if (p.heure_debut_matin) {
          plans.push({
            client,
            horaire: `${p.heure_debut_matin.slice(0, 5)} → ${p.heure_fin_matin?.slice(0, 5) || "--:--"}`,
          })
        }

        if (p.heure_debut_soir) {
          plans.push({
            client,
            horaire: `${p.heure_debut_soir.slice(0, 5)} → ${p.heure_fin_soir?.slice(0, 5) || "--:--"}`,
          })
        }

        if (plans.length) {
          if (!planMap[date]) planMap[date] = []
          planMap[date].push(...plans)
        }
      }

      setDispos(dispoMap)
      setPlanningMap(planMap)
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
          {/* Partie gauche */}
          <div className="space-y-6 border p-4 rounded-lg shadow-md bg-white">
            {/* Secteurs */}
            <div className="space-y-2">
              <div className="font-semibold text-sm">Secteur</div>
              <div className="grid grid-cols-5 gap-2">
                {secteursList.map(({ label, icon: Icon }) => (
                  <Button
                    key={label}
                    variant="outline"
                    className={`flex items-center justify-center gap-1 text-xs py-2 ${
                      secteur === label ? "bg-[#840404] text-white hover:bg-[#750303]" : ""
                    }`}
                    onClick={() => {
                      setSecteur(label)
                      setCandidat(null)
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {secteur && (
              <div className="space-y-2">
                <div className="font-semibold text-sm">Candidats</div>
                <div className="border p-2 h-40 overflow-y-auto rounded">
                  {candidatsSecteur.map((c) => (
                    <Button
                      key={c.id}
                      variant={candidat?.id === c.id ? "default" : "outline"}
                      className="w-full justify-start text-left mb-1"
                      onClick={() => setCandidat(c)}
                    >
                      {c.nom} {c.prenom}
                    </Button>
                  ))}
                </div>
              </div>
            )}

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

            <div className="space-y-2">
              <div className="font-semibold text-sm">Commentaire</div>
              <Textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Ajouter un commentaire"
                className="min-h-[80px]"
              />
            </div>
          </div>

          {/* Partie droite */}
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
