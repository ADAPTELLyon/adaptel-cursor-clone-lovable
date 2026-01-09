// AjoutDispoCandidat.tsx
import { useEffect, useMemo, useState } from "react"
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
import { format, startOfWeek, addDays, getISOWeek, getISOWeekYear } from "date-fns"
import { fr } from "date-fns/locale"
import type { Candidat } from "@/types/types-front"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import DispoSemainePanel from "@/components/Planning/DispoSemainePanel"
import { PieChart, Users, CalendarDays, MessageSquareText } from "lucide-react"

type DispoState = Record<
  string,
  { statut: "dispo" | "absence" | "non"; matin: boolean; soir: boolean }
>

type JourPlanMap = Record<
  string,
  { client: string; horaire: string; statut?: string }[]
>

function capitalize(str: string) {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

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

  // ⬇️ Lundi de la semaine en cours
  const lundi = startOfWeek(new Date(), { weekStartsOn: 1 })

  // 🔁 On stocke comme pour les commandes : valeur = date du lundi "yyyy-MM-dd"
  const [semaine, setSemaine] = useState(format(lundi, "yyyy-MM-dd"))

  const [semainesDisponibles, setSemainesDisponibles] = useState<
    { value: string; label: string; startDate: Date; year: number; week: number }[]
  >([])

  const [dispos, setDispos] = useState<DispoState>({})
  const [planningMap, setPlanningMap] = useState<JourPlanMap>({})
  const [existantesIndex, setExistantesIndex] = useState<Record<string, string>>({})

  const { data: candidatsSecteur = [] } = useCandidatsBySecteur(secteur)

  // --- Génération des semaines sélectionnables : N-2, N-1, N, N+1..N+20
  useEffect(() => {
    const weeks: { value: string; label: string; startDate: Date; year: number; week: number }[] = []
    const today = new Date()
    const start = startOfWeek(today, { weekStartsOn: 1 })

    for (let offset = -2; offset <= 20; offset++) {
      const monday = addDays(start, offset * 7)
      const year = getISOWeekYear(monday)
      const week = getISOWeek(monday)

      const value = format(monday, "yyyy-MM-dd")

      const lundiStrRaw = format(monday, "EEEE d MMM", { locale: fr })
      const dimanche = addDays(monday, 6)
      const dimancheStrRaw = format(dimanche, "EEEE d MMM", { locale: fr })

      const lundiStr = capitalize(lundiStrRaw.replace(/\.$/, ""))
      const dimancheStr = capitalize(dimancheStrRaw.replace(/\.$/, ""))

      // 🚫 Pas de "Semaine 53" dans l'affichage
      const displayWeek = week > 52 ? 52 : week

      const label = `Semaine ${displayWeek} - ${lundiStr} - ${dimancheStr}`

      weeks.push({ value, label, startDate: monday, year, week })
    }

    // Tri par année, puis par numéro de semaine
    weeks.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.week - b.week
    })

    setSemainesDisponibles(weeks)
  }, [])

  const semaineObj = useMemo(
    () => semainesDisponibles.find((s) => s.value === semaine),
    [semainesDisponibles, semaine]
  )

  const joursSemaine = useMemo(() => {
    if (!semaineObj) return []
    const base = semaineObj.startDate
    const now = new Date()
    const nowKey = format(now, "yyyy-MM-dd")

    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(base, i)
      const key = format(date, "yyyy-MM-dd")
      const isPast =
        date < startOfWeek(now, { weekStartsOn: 1 }) || key < nowKey
      return {
        key,
        jour: format(date, "EEEE d MMM", { locale: fr }),
        isPast,
        planifies: planningMap[key] || [],
      }
    })
  }, [semaineObj, planningMap])

  // --- Reset complet à la fermeture du modal (y compris le champ de recherche)
  useEffect(() => {
    if (!open) {
      setSecteur("")
      setCandidat(null)
      setDispos({})
      setCommentaire("")
      setSearch("")
      setPlanningMap({})
      setExistantesIndex({})
    }
  }, [open])

  // --- Chargement des dispos + commandes (pour la semaine)
  useEffect(() => {
    const fetchDispoAndPlanning = async () => {
      if (!open || !candidat || !secteur || !semaineObj) return
      const dates = Array.from({ length: 7 }, (_, i) =>
        format(addDays(semaineObj.startDate, i), "yyyy-MM-dd")
      )

      const [disposRes, planningRes] = await Promise.all([
        supabase
          .from("disponibilites")
          .select("id, date, statut, dispo_matin, dispo_soir, updated_at")
          .eq("candidat_id", candidat.id)
          .eq("secteur", secteur)
          .in("date", dates),
        supabase
          .from("commandes")
          .select(
            "id, date, statut, updated_at, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir, client:client_id(nom)"
          )
          .eq("candidat_id", candidat.id)
          .eq("secteur", secteur)
          .in("date", dates),
      ])

      if (disposRes.error || planningRes.error) {
        console.error("Erreur chargement dispos/commandes", {
          dispoErr: disposRes.error,
          cmdErr: planningRes.error,
        })
        return
      }

      // Index des dispos existantes => pour update/delete rapide
      const existIndex: Record<string, string> = {}
      const dispoMap: DispoState = {}

      for (const d of disposRes.data || []) {
        existIndex[d.date] = d.id
        let s: "dispo" | "absence" | "non" = "non"
        if ((d.statut || "").toLowerCase() === "dispo") s = "dispo"
        else if ((d.statut || "").toLowerCase() === "non dispo") s = "absence"
        // si s === "non" on garde quand même les flags pour édition locale
        dispoMap[d.date] = {
          statut: s,
          matin: !!d.dispo_matin,
          soir: !!d.dispo_soir,
        }
      }

      // Construction planningMap avec priorité:
      // 1) Commandes Validé (affiche matin et/ou soir, double planif gérée)
      // 2) Sinon Annexe (Annule Int / Client / ADA / Absence)
      // 3) Sinon Dispo (on laisse tableau vide => le panel colorera d'après dispos)
      const finalMap: JourPlanMap = {}

      for (const date of dates) {
        const commandesDuJour = (planningRes.data || []).filter(
          (c) => c.date === date
        )

        const valides = commandesDuJour.filter((c) => c.statut === "Validé")
        const annexes = commandesDuJour.filter((c) =>
          ["Annule Int", "Annule Client", "Annule ADA", "Absence"].includes(
            c.statut
          )
        )

        if (valides.length > 0) {
          // On liste séparément les créneaux validés (matin / soir), et on peut avoir 2 clients différents
          const lignes: { client: string; horaire: string; statut?: string }[] =
            []

          for (const v of valides) {
            const client = (v as any)?.client?.nom || "Client"
            if (v.heure_debut_matin && v.heure_fin_matin) {
              lignes.push({
                client,
                // heures sur une seule chaîne : le panel se charge de l’afficher sur 2 lignes (client puis heures)
                horaire: `${v.heure_debut_matin.slice(0, 5)} → ${v.heure_fin_matin.slice(
                  0,
                  5
                )}`,
                statut: "Validé",
              })
            }
            if (v.heure_debut_soir && v.heure_fin_soir) {
              lignes.push({
                client,
                horaire: `${v.heure_debut_soir.slice(0, 5)} → ${v.heure_fin_soir.slice(
                  0,
                  5
                )}`,
                statut: "Validé",
              })
            }
          }

          // S’il n’y a aucun créneau renseigné (cas rarissime), on met au moins une ligne “Validé”
          if (lignes.length === 0) {
            const v = valides[0]
            lignes.push({
              client: (v as any)?.client?.nom || "Client",
              horaire: "",
              statut: "Validé",
            })
          }

          finalMap[date] = lignes
          continue
        }

        if (annexes.length > 0) {
          // On affiche l’annexe UNIQUEMENT si aucune "Validé" ce jour-là
          // S’il y en a plusieurs, on prend la plus récente
          const a = annexes.sort(
            (a, b) =>
              new Date(b.updated_at || b.date).getTime() - new Date(a.updated_at || a.date).getTime()
          )[0]
          finalMap[date] = [
            {
              client: (a as any)?.client?.nom || "Client",
              horaire: "",
              statut: a.statut,
            },
          ]
          continue
        }

        // Sinon: la case sera affichée en fonction de la dispo (si présente)
        if (dispoMap[date]) {
          finalMap[date] = []
        }
      }

      setExistantesIndex(existIndex)
      setDispos(dispoMap)
      setPlanningMap(finalMap)
    }

    fetchDispoAndPlanning()
  }, [open, candidat, secteur, semaineObj])

  // --- Handlers UI (garde la même API que ton code)
  const toggleStatut = (key: string) => {
    setDispos((prev) => {
      const actuel = prev[key]?.statut || "non"
      const suivant = actuel === "non" ? "dispo" : actuel === "dispo" ? "absence" : "non"
      return {
        ...prev,
        [key]: {
          statut: suivant,
          // par défaut, quand on passe à "dispo", on coche les 2 créneaux
          matin: suivant === "dispo" ? (prev[key]?.matin ?? true) : (prev[key]?.matin ?? false),
          soir: suivant === "dispo" ? (prev[key]?.soir ?? true) : (prev[key]?.soir ?? false),
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

  const [allMatin, setAllMatin] = useState(true)
  const [allSoir, setAllSoir] = useState(true)

  const appliquerTous = (newStatut: "dispo" | "absence") => {
    const updated: DispoState = {}
    for (const j of joursSemaine) {
      // on ne touche pas aux jours où il y a déjà une planif
      if (planningMap[j.key]?.length) continue
      if (j.isPast) continue
      updated[j.key] = {
        statut: newStatut,
        matin: allMatin,
        soir: allSoir,
      }
    }
    setDispos(updated)
  }

  const appliquerMatinSoir = (creneau: "matin" | "soir", value: boolean) => {
    setDispos((prev) => {
      const copy = { ...prev }
      for (const k of Object.keys(copy)) {
        if (copy[k].statut === "dispo") {
          copy[k] = { ...copy[k], [creneau]: value }
        }
      }
      return copy
    })
  }

  // --- SAVE : insert / update / delete + rafraîchissement local immédiat
  const handleSave = async () => {
    if (!candidat || !secteur) return

    // On récupère l’état existant complet pour cette semaine
    const { data: existantes, error: fetchErr } = await supabase
      .from("disponibilites")
      .select("id, date")
      .eq("candidat_id", candidat.id)
      .eq("secteur", secteur)

    if (fetchErr) {
      toast({ title: "Erreur", description: "Chargement échoué", variant: "destructive" })
      return
    }

    const existingByDate: Record<string, string> = {}
    for (const e of existantes || []) existingByDate[e.date] = e.id

    const toInsert: any[] = []
    const toUpdate: any[] = []
    const toDeleteIds: string[] = []

    // On parcourt les 7 jours visibles — y compris ceux qui n’ont pas été touchés,
    // pour gérer un éventuel retour à “non” => suppression
    for (const j of joursSemaine) {
      // ne pas écraser si commande (Validé/Annexe) visible ce jour
      if (planningMap[j.key]?.length) continue

      const d = dispos[j.key]
      const existingId = existingByDate[j.key]

      // si rien en mémoire pour ce jour et pas d’existant -> on ignore
      if (!d && !existingId) continue

      // Normalisation:
      // - "dispo" => au moins un créneau doit être true, sinon on repasse à "non"
      // - "absence" => forçons les deux créneaux à false
      // - "non" => suppression si une ligne existe
      if (!d || d.statut === "non" || (d.statut === "dispo" && !d.matin && !d.soir)) {
        if (existingId) toDeleteIds.push(existingId)
        continue
      }

      const payload = {
        candidat_id: candidat.id,
        date: j.key,
        secteur,
        service: null,
        statut: d.statut === "dispo" ? "Dispo" : "Non Dispo",
        commentaire,
        dispo_matin: d.statut === "dispo" ? !!d.matin : false,
        dispo_soir: d.statut === "dispo" ? !!d.soir : false,
        dispo_nuit: false,
      }

      if (existingId) {
        toUpdate.push({ ...payload, id: existingId })
      } else {
        toInsert.push(payload)
      }
    }

    // Exécutions
    const execInserts = toInsert.length
      ? supabase.from("disponibilites").insert(toInsert)
      : Promise.resolve({ error: null })

    const execUpdates = toUpdate.length
      ? Promise.all(
          toUpdate.map((u) => supabase.from("disponibilites").update(u).eq("id", u.id))
        ).then(() => ({ error: null as any }))
      : Promise.resolve({ error: null })

    const execDeletes = toDeleteIds.length
      ? supabase.from("disponibilites").delete().in("id", toDeleteIds)
      : Promise.resolve({ error: null })

    const [{ error: errInsert }, { error: errUpdate }, { error: errDelete }] =
      await Promise.all([execInserts, execUpdates, execDeletes])

    if (errInsert || errUpdate || errDelete) {
      console.error("Erreur sauvegarde dispos", { errInsert, errUpdate, errDelete })
      toast({ title: "Erreur", description: "Échec d'enregistrement", variant: "destructive" })
      return
    }

    toast({ title: "Disponibilités enregistrées" })

    // ✅ Rafraîchissement local immédiat (sans impacter les autres users)
    try {
      const updatedDates = Object.keys(dispos)
      window.dispatchEvent(
        new CustomEvent("dispos:updated", {
          detail: {
            candidatId: candidat.id,
            secteur,
            dates: updatedDates,
          },
        })
      )
    } catch {}

    // on ferme proprement et on notifie le parent (qui peut faire un refetch soft si nécessaire)
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
          {/* Partie gauche */}
          <div className="space-y-6">
            {/* Secteur */}
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
                      setDispos({})
                      setPlanningMap({})
                    }}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Candidats */}
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
                        onClick={() => {
                          setCandidat(c)
                          // on vide les états pour éviter les artefacts de la sélection précédente
                          setDispos({})
                          setPlanningMap({})
                        }}
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

            {/* Semaine */}
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
                {(() => {
                  const nodes: JSX.Element[] = []
                  let currentYear: number | null = null

                  for (const s of semainesDisponibles) {
                    if (currentYear === null || currentYear !== s.year) {
                      currentYear = s.year
                      nodes.push(
                        <option key={`year-${s.year}`} value={`year-${s.year}`} disabled>
                          {s.year}
                        </option>
                      )
                    }

                    nodes.push(
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    )
                  }

                  return nodes
                })()}
              </select>
            </div>

            {/* Commentaire */}
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

          {/* Partie droite (panel 7 jours) */}
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
