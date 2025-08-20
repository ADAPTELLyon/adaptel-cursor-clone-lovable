import { useEffect, useState } from "react"
import { AlertCircle, Clock, Plus } from "lucide-react"
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns"
import { statutColors } from "@/lib/colors"
import { supabase } from "@/lib/supabase"
import type { JourPlanningCandidat, CommandeFull } from "@/types/types-front"
import { ColonneCandidate } from "@/components/Planning/ColonneCandidate"
import { CellulePlanningCandidate } from "@/components/Planning/CellulePlanningCandidate"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { TooltipProvider } from "@/components/ui/tooltip"

export function PlanningCandidateTable({
  planning,
  selectedSecteurs,
  selectedSemaine,
  onRefresh,
}: {
  planning: Record<string, JourPlanningCandidat[]>
  selectedSecteurs: string[]
  selectedSemaine: string
  onRefresh: () => void
}) {
  const [heuresParCandidat, setHeuresParCandidat] = useState<Record<string, string>>({})

  // rafraîchissement local quand les dispos/planifs changent (sans impacter les autres users)
  useEffect(() => {
    const handler = () => onRefresh()
    window.addEventListener("dispos:updated", handler as EventListener)
    window.addEventListener("planif:updated", handler as EventListener)
    return () => {
      window.removeEventListener("dispos:updated", handler as EventListener)
      window.removeEventListener("planif:updated", handler as EventListener)
    }
  }, [onRefresh])

  useEffect(() => {
    const fetchHeures = async () => {
      const currentDate = new Date()
      const lundiSemaine = startOfWeek(currentDate, { weekStartsOn: 1 })
      let lundiTarget = lundiSemaine

      if (selectedSemaine !== "Toutes") {
        const numSemaineCible = parseInt(selectedSemaine)
        const numSemaineActuelle = parseInt(format(currentDate, "I"))
        const diff = numSemaineCible - numSemaineActuelle
        lundiTarget = addWeeks(lundiSemaine, diff)
      }

      const dimancheTarget = endOfWeek(lundiTarget, { weekStartsOn: 1 })
      const heures: Record<string, string> = {}

      for (const candidatNom of Object.keys(planning)) {
        let candidatId: string | null = null
        for (const jour of planning[candidatNom]) {
          candidatId = jour.disponibilite?.candidat_id || jour.commande?.candidat_id
          if (candidatId) break
        }
        if (!candidatId) {
          heures[candidatNom] = "00:00"
          continue
        }

        const { data, error } = await supabase
          .from("commandes")
          .select("*")
          .in("statut", ["Validé", "Planifié", "À valider"])
          .eq("candidat_id", candidatId)
          .gte("date", lundiTarget.toISOString().slice(0, 10))
          .lte("date", dimancheTarget.toISOString().slice(0, 10))

        if (error) {
          console.error("Erreur récupération heures:", error)
          heures[candidatNom] = "00:00"
          continue
        }

        let totalMinutes = 0
        data?.forEach((cmd) => {
          if (cmd.heure_debut_matin && cmd.heure_fin_matin) {
            const [h1, m1] = cmd.heure_debut_matin.split(":").map(Number)
            const [h2, m2] = cmd.heure_fin_matin.split(":").map(Number)
            totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1)
          }
          if (cmd.heure_debut_soir && cmd.heure_fin_soir) {
            const [h1, m1] = cmd.heure_debut_soir.split(":").map(Number)
            const [h2, m2] = cmd.heure_fin_soir.split(":").map(Number)
            totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1)
          }
          if (cmd.heure_debut_nuit && cmd.heure_fin_nuit) {
            const [h1, m1] = cmd.heure_debut_nuit.split(":").map(Number)
            const [h2, m2] = cmd.heure_fin_nuit.split(":").map(Number)
            totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1)
          }
        })

        const heuresTotal = Math.floor(totalMinutes / 60)
        const minutesTotal = totalMinutes % 60
        heures[candidatNom] = `${heuresTotal.toString().padStart(2, "0")}:${minutesTotal.toString().padStart(2, "0")}`
      }

      setHeuresParCandidat(heures)
    }

    fetchHeures()
  }, [planning, selectedSemaine])

  const groupesParSemaine: Record<string, Record<string, Record<string, JourPlanningCandidat[]>>> = {}

  Object.entries(planning).forEach(([candidat, jours]) => {
    jours.forEach((jour) => {
      const dateObj = new Date(jour.date)
      const lundiSemaine = startOfWeek(dateObj, { weekStartsOn: 1 })
      const numeroSemaine = format(lundiSemaine, "I")
      const secteur = jour.secteur || "Inconnu"
      const keySemaineSecteur = selectedSecteurs.length === 5 ? `${numeroSemaine}_${secteur}` : numeroSemaine

      if (!groupesParSemaine[keySemaineSecteur]) groupesParSemaine[keySemaineSecteur] = {}
      if (!groupesParSemaine[keySemaineSecteur][candidat]) groupesParSemaine[keySemaineSecteur][candidat] = {}

      const dateKey = dateObj.toISOString().slice(0, 10)
      if (!groupesParSemaine[keySemaineSecteur][candidat][dateKey]) {
        groupesParSemaine[keySemaineSecteur][candidat][dateKey] = []
      }
      groupesParSemaine[keySemaineSecteur][candidat][dateKey].push(jour)
    })
  })

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-8 mt-8">
        {Object.entries(groupesParSemaine).map(([keySemaineSecteur, groupes]) => {
          const [semaineStr, secteurStr] = keySemaineSecteur.split("_")
          const baseDate = startOfWeek(new Date(), { weekStartsOn: 1 })
          const diff = parseInt(semaineStr) - parseInt(format(baseDate, "I"))
          const lundiCible = addWeeks(baseDate, diff)
          const jours = Array.from({ length: 7 }, (_, i) => {
            const jour = new Date(lundiCible)
            jour.setDate(jour.getDate() + i)
            const dateStr = jour.toISOString().slice(0, 10)
            return {
              date: jour,
              dateStr: format(jour, "yyyy-MM-dd"),
              label: jour.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "Europe/Paris",
              }),
            }
          })

          return (
            <div key={keySemaineSecteur} className="border rounded-lg overflow-hidden shadow-sm">
              <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white">
                <div className="p-4 border-r flex flex-col items-center justify-center min-h-[64px]">
                  <div>{`Semaine ${semaineStr}`}</div>
                  {secteurStr && selectedSecteurs.length === 5 && (
                    <div className="text-xs mt-1 italic">{secteurStr}</div>
                  )}
                </div>
                {jours.map((jour, index) => {
                  let nbValide = 0
                  Object.values(groupes).forEach((groupe) => {
                    const joursCases = groupe[jour.dateStr]
                    joursCases?.forEach((j) => {
                      if (j.commande?.statut === "Validé") nbValide++
                    })
                  })
                  return (
                    <div key={index} className="p-4 border-r text-center relative min-h-[64px]">
                      <div>{jour.label.split(" ")[0]}</div>
                      <div>{jour.label.split(" ").slice(1).join(" ")}</div>
                      {nbValide > 0 && (
                        <div
                          className="absolute top-1 right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center"
                          style={{ backgroundColor: statutColors["Validé"].bg, color: "white" }}
                        >
                          {nbValide}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {Object.entries(groupes)
                .sort(([a], [b]) => a.localeCompare(b, "fr", { sensitivity: "base" }))
                .map(([key, jourMap]) => {
                  const ligne = jours.map((j) => jourMap[j.dateStr]?.[0] ?? null)
                  const disponibilites = ligne.map((j) => j?.disponibilite?.statut)
                  const hasDispo = disponibilites.includes("Dispo")

                  const premierJour = ligne.find((j) => j)
                  const secteur = premierJour?.secteur || ""
                  const candidatId =
                    premierJour?.disponibilite?.candidat_id || premierJour?.commande?.candidat_id || ""
                  const nomPrenom =
                    premierJour?.disponibilite?.candidat
                      ? `${premierJour.disponibilite.candidat.nom} ${premierJour.disponibilite.candidat.prenom}`
                      : premierJour?.commande?.candidat
                      ? `${premierJour.commande.candidat.nom} ${premierJour.commande.candidat.prenom}`
                      : key

                  const totalHeures = heuresParCandidat[key] || "00:00"

                  return (
                    <div
                      key={key}
                      className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] border-t text-sm"
                    >
                      <ColonneCandidate
                        nomComplet={nomPrenom}
                        secteur={secteur}
                        semaine={semaineStr}
                        statutGlobal={hasDispo ? "Dispo" : "Non Dispo"}
                        candidatId={candidatId}
                        totalHeures={totalHeures}
                      />
                      {jours.map((jour, index) => {
                        const jourCells = jourMap[jour.dateStr] || []

                        // 1) Construit la liste de commandes DU JOUR (commande + autresCommandes)
                        const rawCmds: CommandeFull[] = [
                          ...jourCells.map((j) => j.commande).filter((c): c is CommandeFull => !!c),
                          ...jourCells.flatMap((j) => (j.autresCommandes || []) as CommandeFull[]).filter(Boolean),
                        ]

                        // dédup par id
                        const byId = new Map<string, CommandeFull>()
                        for (const c of rawCmds) {
                          if (c?.id) byId.set(c.id, c)
                        }
                        const commandes: CommandeFull[] = Array.from(byId.values())

                        // 2) Priorité aux Validé
                        const valides = commandes.filter((c) => c.statut === "Validé")

                        // repère matin/soir validés
                        let missionMatin: CommandeFull | undefined
                        let missionSoir:  CommandeFull | undefined
                        for (const cmd of valides) {
                          if (!missionMatin && cmd.heure_debut_matin && cmd.heure_fin_matin) missionMatin = cmd
                          if (!missionSoir  && cmd.heure_debut_soir && cmd.heure_fin_soir)  missionSoir  = cmd
                          if (missionMatin && missionSoir) break
                        }

                        // Commande principale
                        const commandePrincipale: CommandeFull | undefined = missionMatin || missionSoir

                        // Seconde (pour l'alerte) seulement si 2 clients différents
                        let commandeSecondaire: CommandeFull | undefined
                        if (missionMatin && missionSoir && missionMatin.id !== missionSoir.id) {
                          commandeSecondaire = missionMatin === commandePrincipale ? missionSoir : missionMatin
                        }

                        // 3) Si aucune Validé → on regarde les annexes
                        const annexe = (!commandePrincipale)
                          ? commandes.find((c) =>
                              ["Annule Int", "Annule Client", "Annule ADA", "Absence"].includes(c.statut || "")
                            )
                          : undefined

                        const disponibilite = jourCells[0]?.disponibilite
                        const autres: CommandeFull[] = []
                        if (commandeSecondaire) autres.push(commandeSecondaire)

                        return (
                          <div key={`${jour.dateStr}-${index}`} className="border-r p-2 h-28 relative">
                            <CellulePlanningCandidate
                              disponibilite={disponibilite}
                              commande={commandePrincipale ?? (annexe || undefined)}
                              autresCommandes={autres}
                              secteur={secteur}
                              date={jour.dateStr}
                              candidatId={candidatId}
                              onSuccess={onRefresh}
                              nomPrenom={nomPrenom}
                              service={jourCells[0]?.commande?.service || ""}
                            />

                            {/* Plus si rien du tout */}
                            {!commandePrincipale && !annexe && !disponibilite?.statut && (
                              <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                                <Plus className="w-4 h-4 text-gray-400" />
                              </div>
                            )}

                            {/* Alerte (mission du 2e créneau sur autre client) */}
                            {commandeSecondaire && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="absolute top-2 right-2 bg-white rounded-full p-1 shadow z-20 translate-x-1/4 -translate-y-1/4">
                                    <AlertCircle className="w-5 h-5 text-[#840404]" />
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent side="top" className="text-sm max-w-xs space-y-1">
                                  <div className="font-semibold">
                                    {commandeSecondaire.client?.nom || "?"}
                                  </div>
                                  {commandeSecondaire.service && (
                                    <div>{commandeSecondaire.service}</div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>
                                      {commandeSecondaire.heure_debut_matin
                                        ? `${commandeSecondaire.heure_debut_matin.slice(0,5)} - ${commandeSecondaire.heure_fin_matin?.slice(0,5)}`
                                        : commandeSecondaire.heure_debut_soir
                                        ? `${commandeSecondaire.heure_debut_soir.slice(0,5)} - ${commandeSecondaire.heure_fin_soir?.slice(0,5)}`
                                        : "Non renseigné"}
                                    </span>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
