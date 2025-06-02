import { useState } from "react"
import { cn } from "@/lib/utils"
import { Check, Info } from "lucide-react"
import { format, startOfWeek, addDays, getWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { indicateurColors } from "@/lib/colors"
import type { JourPlanningCandidat } from "@/types/types-front"
import { ColonneCandidate } from "@/components/Planning/ColonneCandidate"
import { CellulePlanningCandidate } from "@/components/Planning/CellulePlanningCandidate"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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
  const groupesParSemaine: Record<string, Record<string, Record<string, JourPlanningCandidat[]>>> = {}

  Object.entries(planning).forEach(([candidat, jours]) => {
    jours.forEach((jour) => {
      const semaine = getWeek(new Date(jour.date), { weekStartsOn: 1 }).toString()
      if (!groupesParSemaine[semaine]) groupesParSemaine[semaine] = {}
      const cle = `${candidat}`
      const dateKey = format(new Date(jour.date), "yyyy-MM-dd")

      if (!groupesParSemaine[semaine][cle]) groupesParSemaine[semaine][cle] = {}
      if (!groupesParSemaine[semaine][cle][dateKey]) groupesParSemaine[semaine][cle][dateKey] = []
      groupesParSemaine[semaine][cle][dateKey].push(jour)
    })
  })

  return (
    <div className="space-y-8 mt-8">
      {Object.entries(groupesParSemaine).map(([semaine, groupes]) => {
        const semaineTexte = `Semaine ${semaine}`
        const baseDate = startOfWeek(new Date(), { weekStartsOn: 1 })
        const semaineDifference = parseInt(semaine) - getWeek(baseDate, { weekStartsOn: 1 })
        const lundiSemaine = addDays(baseDate, semaineDifference * 7)

        const jours = Array.from({ length: 7 }, (_, i) => {
          const jour = addDays(lundiSemaine, i)
          return {
            date: jour,
            dateStr: format(jour, "yyyy-MM-dd"),
            label: format(jour, "eeee dd MMMM", { locale: fr }),
          }
        })

        return (
          <div key={semaine} className="border rounded-lg overflow-hidden shadow-sm">
            <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white">
              <div className="p-3 border-r flex items-center justify-center">
                {semaineTexte}
              </div>
              {jours.map((jour, index) => {
                let totalDispos = 0
                let nbDisponibles = 0
                Object.values(groupes).forEach((groupe) => {
                  const jourCells = groupe[jour.dateStr]
                  jourCells?.forEach((j) => {
                    if (j.disponibilite) {
                      totalDispos++
                      if (j.disponibilite.statut === "Dispo") nbDisponibles++
                    }
                  })
                })

                return (
                  <div key={index} className="p-3 border-r text-center relative leading-tight">
                    <div>{jour.label.split(" ")[0]}</div>
                    <div className="text-xs">{jour.label.split(" ").slice(1).join(" ")}</div>
                    {totalDispos === 0 ? (
                      <div className="absolute top-1 right-1">
                        <div className="h-5 w-5 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">–</div>
                      </div>
                    ) : nbDisponibles > 0 ? (
                      <div className="absolute top-1 right-1 h-5 w-5 text-xs rounded-full flex items-center justify-center"
                        style={{ backgroundColor: indicateurColors["Dispo"], color: "white" }}>
                        {nbDisponibles}
                      </div>
                    ) : (
                      <div className="absolute top-1 right-1">
                        <div className="h-5 w-5 rounded-full bg-[#4b5563] flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {Object.entries(groupes).map(([key, jourMap]) => {
              const ligne = jours.map(j => jourMap[j.dateStr]?.[0] ?? null)
              const disponibilites = ligne.map((j) => j?.disponibilite?.statut)
              const hasDispo = disponibilites.includes("Dispo")

              const premierJour = ligne.find(j => j)
              const secteur = premierJour?.secteur || ""
              const service = premierJour?.service || ""
              const candidatId =
                premierJour?.disponibilite?.candidat_id ||
                premierJour?.commande?.candidat_id ||
                ""
              const nomPrenom =
                premierJour?.disponibilite?.candidat
                  ? `${premierJour.disponibilite.candidat.nom} ${premierJour.disponibilite.candidat.prenom}`
                  : premierJour?.commande?.candidat
                  ? `${premierJour.commande.candidat.nom} ${premierJour.commande.candidat.prenom}`
                  : key

              return (
                <div
                  key={key}
                  className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] border-t text-sm"
                >
                  <ColonneCandidate
                    nomComplet={nomPrenom}
                    secteur={secteur}
                    service={service}
                    semaine={semaine}
                    statutGlobal={hasDispo ? "Dispo" : "Non Dispo"}
                    candidatId={candidatId}
                  />

                  {jours.map((jour, index) => {
                    const jourCells = jourMap[jour.dateStr] || []
                    const jourCell = jourCells[0]
                    const extra = jourCells.length > 1 ? jourCells[1] : null
                    const dispo = jourCell?.disponibilite
                    const commande = jourCell?.commande
                    const commandeExtra = extra?.commande

                    return (
                      <div key={index} className="border-r p-2 h-28 relative">
                        <CellulePlanningCandidate
                          disponibilite={dispo}
                          commande={commande}
                          secteur={secteur}
                          date={jour.dateStr}
                          candidatId={candidatId}
                          service={service}
                          onSuccess={onRefresh}
                          nomPrenom={nomPrenom}
                        />

                        {commande && commandeExtra && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <div className="absolute bottom-1 right-1 cursor-pointer bg-white rounded-full p-1 shadow">
                                <Info className="w-4 h-4 text-[#840404]" />
                              </div>
                            </PopoverTrigger>
                            <PopoverContent side="top" className="text-sm">
                              <div className="font-medium mb-1">Mission secondaire :</div>
                              <div>
                                Client :{" "}
                                {commandeExtra.client?.nom || "Autre"}
                              </div>
                              <div>
                                Créneau :{" "}
                                {commandeExtra.heure_debut_matin
                                  ? `Matin ${commandeExtra.heure_debut_matin} - ${commandeExtra.heure_fin_matin}`
                                  : commandeExtra.heure_debut_soir
                                  ? `Soir ${commandeExtra.heure_debut_soir} - ${commandeExtra.heure_fin_soir}`
                                  : "Heures non renseignées"}
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
  )
}
