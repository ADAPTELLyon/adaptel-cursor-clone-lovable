import { useEffect, useState } from "react"
import { Check, AlertCircle, Clock, Plus } from "lucide-react"
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns"
import { fr } from "date-fns/locale"
import { indicateurColors, statutColors } from "@/lib/colors"
import { supabase } from "@/lib/supabase"
import type { JourPlanningCandidat } from "@/types/types-front"
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
        const premierJour = planning[candidatNom]?.[0]
        const candidatId =
          premierJour?.disponibilite?.candidat_id || premierJour?.commande?.candidat_id

        if (!candidatId) {
          heures[candidatNom] = "00:00"
          continue
        }

        const { data, error } = await supabase
          .from("commandes")
          .select("*")
          .eq("statut", "Validé")
          .eq("candidat_id", candidatId)
          .gte("date", lundiTarget.toISOString().slice(0, 10))
          .lte("date", dimancheTarget.toISOString().slice(0, 10))

        if (error || !data) {
          heures[candidatNom] = "00:00"
          continue
        }

        let totalMinutes = 0
        data.forEach((cmd) => {
          const slots = [
            { debut: cmd.heure_debut_matin, fin: cmd.heure_fin_matin },
            { debut: cmd.heure_debut_soir, fin: cmd.heure_fin_soir },
            { debut: cmd.heure_debut_nuit, fin: cmd.heure_fin_nuit },
          ]
          slots.forEach(({ debut, fin }) => {
            if (debut && fin) {
              const [h1, m1] = debut.split(":").map(Number)
              const [h2, m2] = fin.split(":").map(Number)
              totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1)
            }
          })
        })

        heures[candidatNom] = `${Math.floor(totalMinutes / 60)
          .toString()
          .padStart(2, "0")}:${(totalMinutes % 60).toString().padStart(2, "0")}`
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

      const keySemaineSecteur = selectedSecteurs.length === 5
        ? `${numeroSemaine}_${secteur}`
        : numeroSemaine

      if (!groupesParSemaine[keySemaineSecteur]) groupesParSemaine[keySemaineSecteur] = {}
      if (!groupesParSemaine[keySemaineSecteur][candidat]) groupesParSemaine[keySemaineSecteur][candidat] = {}

      // forcer la clé de date cohérente en YYYY-MM-DD
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
          const dimancheCible = endOfWeek(lundiCible, { weekStartsOn: 1 })

          const jours = Array.from({ length: 7 }, (_, i) => {
            const jour = new Date(lundiCible)
            jour.setDate(jour.getDate() + i)
            const dateStr = jour.toISOString().slice(0, 10)
            return {
              date: jour,
              dateStr,
              label: format(jour, "eeee dd MMMM", { locale: fr }),
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
                          style={{
                            backgroundColor: statutColors["Validé"].bg,
                            color: "white",
                          }}
                        >
                          {nbValide}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {Object.entries(groupes).map(([key, jourMap]) => {
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
                  <div key={key} className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] border-t text-sm">
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

                      const missionMatin = jourCells.find(
                        (j) => j.commande?.heure_debut_matin && j.commande?.heure_fin_matin
                      )
                      const missionSoir = jourCells.find(
                        (j) => j.commande?.heure_debut_soir && j.commande?.heure_fin_soir
                      )

                      const commandePrincipale = missionMatin || missionSoir
                      const commandeSecondaire = jourCells[0]?.autresCommandes?.[0] || null

                      return (
                        <div
                          key={`${jour.dateStr}-${index}`}
                          className="border-r p-2 h-28 relative"
                        >
                          <CellulePlanningCandidate
                            disponibilite={jourCells[0]?.disponibilite}
                            commande={commandePrincipale?.commande}
                            autresCommandes={commandeSecondaire ? [commandeSecondaire] : []}
                            secteur={secteur}
                            date={jour.dateStr}
                            candidatId={candidatId}
                            onSuccess={onRefresh}
                            nomPrenom={nomPrenom}
                            service={jourCells[0]?.commande?.service || ""}
                          />

                          {!commandePrincipale?.commande &&
                            !jourCells[0]?.disponibilite?.statut && (
                              <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                                <Plus className="w-4 h-4 text-gray-400" />
                              </div>
                            )}

                          {commandeSecondaire && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className="absolute top-2 right-2 bg-white rounded-full p-1 shadow z-20 translate-x-1/4 -translate-y-1/4">
                                  <AlertCircle className="w-5 h-5 text-[#840404]" />
                                </div>
                              </PopoverTrigger>
                              <PopoverContent side="top" className="text-sm max-w-xs space-y-1">
                                <div className="font-semibold">{commandeSecondaire.client?.nom || "?"}</div>
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
