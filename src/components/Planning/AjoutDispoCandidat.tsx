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
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { secteursList } from "@/lib/secteurs"
import { disponibiliteColors } from "@/lib/colors"
import { format, startOfWeek, addDays, getWeek } from "date-fns"
import { fr } from "date-fns/locale"
import type { Candidat } from "@/types/types-front"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"

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

  useEffect(() => {
    if (!open) {
      setSecteur("")
      setCandidat(null)
      setDispos({})
      setCommentaire("")
      setAllMatin(true)
      setAllSoir(true)
    }
  }, [open])

  const semaineObj = semainesDisponibles.find((s) => s.value === semaine)
  const joursSemaine = semaineObj
    ? Array.from({ length: 7 }, (_, i) => {
        const date = addDays(semaineObj.startDate, i)
        const now = new Date()
        const isPast = date < startOfWeek(now, { weekStartsOn: 1 }) || format(date, "yyyy-MM-dd") < format(now, "yyyy-MM-dd")
        return {
          key: format(date, "yyyy-MM-dd"),
          jour: format(date, "EEEE d MMM", { locale: fr }),
          isPast,
        }
      })
    : []

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
      if (!j.isPast) {
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

    const lignes = Object.entries(dispos)
      .filter(([_, d]) => d.statut !== "non")
      .map(([date, d]) => ({
        candidat_id: candidat.id,
        date,
        secteur,
        service: null,
        statut: d.statut === "dispo" ? "Dispo" : "Non Dispo",
        commentaire,
        dispo_matin: d.matin,
        dispo_soir: d.soir,
        dispo_nuit: false,
      }))

    if (lignes.length === 0) {
      toast({ title: "Aucune ligne à enregistrer", variant: "destructive" })
      return
    }

    const { error } = await supabase.from("disponibilites").insert(lignes)

    if (error) {
      toast({ title: "Erreur", description: "Insertion échouée", variant: "destructive" })
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
          <div className="space-y-4 border p-4 rounded-lg shadow-md bg-white">
            <div className="grid grid-cols-2 gap-4">
              <Button
                className="w-full bg-gray-200 text-black hover:bg-gray-300"
                onClick={() => appliquerTous("dispo")}
              >
                Toutes Dispo
              </Button>
              <Button
                className="w-full bg-gray-200 text-black hover:bg-gray-300"
                onClick={() => appliquerTous("absence")}
              >
                Non Dispo
              </Button>
            </div>

            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">Matin / Midi</span>
                <Switch
                  checked={allMatin}
                  onCheckedChange={(val) => {
                    setAllMatin(val)
                    appliquerMatinSoir("matin", val)
                  }}
                  className="scale-90"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Soir</span>
                <Switch
                  checked={allSoir}
                  onCheckedChange={(val) => {
                    setAllSoir(val)
                    appliquerMatinSoir("soir", val)
                  }}
                  className="scale-90"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {joursSemaine.map((j) => {
                const dispo = dispos[j.key]?.statut || "non"
                const bgColor = disponibiliteColors[
                  dispo === "dispo"
                    ? "Dispo"
                    : dispo === "absence"
                    ? "Non Dispo"
                    : "Non Renseigné"
                ].bg

                return (
                  <div
                    key={j.key}
                    className={`border rounded p-3 shadow-sm flex justify-between items-center`}
                    style={{ backgroundColor: j.isPast ? "#e5e7eb" : bgColor }}
                  >
                    <div
                      onClick={() => !j.isPast && toggleStatut(j.key)}
                      className="cursor-pointer select-none flex-1"
                    >
                      <div className="text-sm font-medium">{j.jour}</div>
                    </div>

                    {dispos[j.key]?.statut === "dispo" && !j.isPast && (
                      <div className="flex gap-4 ml-4">
                        <div className="flex items-center gap-1">
                          <span className="text-xs">Matin</span>
                          <Switch
                            checked={dispos[j.key]?.matin}
                            onCheckedChange={() => handleToggleMatin(j.key)}
                            className="scale-90"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs">Soir</span>
                          <Switch
                            checked={dispos[j.key]?.soir}
                            onCheckedChange={() => handleToggleSoir(j.key)}
                            className="scale-90"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="pt-4">
              <Button
                className="w-full bg-[#840404] hover:bg-[#750303] text-white"
                onClick={handleSave}
              >
                Valider
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
