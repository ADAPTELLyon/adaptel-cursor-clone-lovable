import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { format, startOfWeek, addDays, getWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { indicateurColors } from "@/lib/colors"
import type { JourPlanningCandidat } from "@/types/types-front"
import { ColonneCandidate } from "@/components/Planning/ColonneCandidate"
import { CellulePlanningCandidate } from "@/components/Planning/CellulePlanningCandidate"

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
  const groupesParSemaine: Record<string, Record<string, JourPlanningCandidat[][]>> = {}

  Object.entries(planning).forEach(([candidat, jours]) => {
    jours.forEach((jour) => {
      const semaine = getWeek(new Date(jour.date), { weekStartsOn: 1 }).toString()
      if (!groupesParSemaine[semaine]) groupesParSemaine[semaine] = {}
      const cle = `${candidat}||${jour.secteur}||${jour.service || ""}`
      if (!groupesParSemaine[semaine][cle]) groupesParSemaine[semaine][cle] = []

      let ligneExistante = groupesParSemaine[semaine][cle].find((ligne) => {
        return !ligne.some(
          (cell) =>
            format(new Date(cell.date), "yyyy-MM-dd") ===
            format(new Date(jour.date), "yyyy-MM-dd")
        )
      })

      if (!ligneExistante) {
        ligneExistante = []
        groupesParSemaine[semaine][cle].push(ligneExistante)
      }
      ligneExistante.push(jour)
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
                Object.values(groupes).forEach((groupe) =>
                  groupe.forEach((ligne) => {
                    const jourCell = ligne.find(
                      (j) => format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr
                    )
                    if (jourCell) {
                      totalDispos += 1
                      const statut = jourCell.disponibilite?.statut
                      if (statut === "Dispo") nbDisponibles++
                    }
                  })
                )
                return (
                  <div
                    key={index}
                    className="p-3 border-r text-center relative leading-tight"
                  >
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

            {Object.entries(groupes).map(([key, lignes]) => {
              const [candidatNom, secteur, service] = key.split("||")

              return lignes.map((ligne, ligneIndex) => {
                const disponibilites = ligne.map((j) => j.disponibilite?.statut)
                const hasDispo = disponibilites.includes("Dispo")

                const candidatId = ligne[0]?.disponibilite?.candidat_id || ""
                const nomPrenom = ligne[0]?.disponibilite?.candidat
                  ? `${ligne[0].disponibilite.candidat.nom} ${ligne[0].disponibilite.candidat.prenom}`
                  : candidatNom

                return (
                  <div
                    key={`${key}-${ligneIndex}`}
                    className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] border-t text-sm"
                  >
                    <ColonneCandidate
                      nomComplet={candidatNom}
                      secteur={secteur}
                      service={service}
                      semaine={semaine}
                      statutGlobal={hasDispo ? "Dispo" : "Non Dispo"}
                      candidatId={candidatId}
                    />

                    {jours.map((jour, index) => {
                      const jourCell = ligne.find(
                        (j) => format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr
                      )
                      const dispo = jourCell?.disponibilite

                      return (
                        <div key={index} className="border-r p-2 h-28 relative">
                          <CellulePlanningCandidate
                            disponibilite={dispo}
                            secteur={secteur}
                            date={jour.dateStr}
                            candidatId={candidatId}
                            service={service}
                            onSuccess={onRefresh}
                            nomPrenom={nomPrenom}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })
            })}
          </div>
        )
      })}
    </div>
  )
}
