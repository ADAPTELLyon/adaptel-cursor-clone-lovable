import { useState, useMemo, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { format, startOfWeek, addDays, getWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { statutColors, indicateurColors } from "@/lib/colors"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat, JourPlanning } from "@/types/types-front"
import { ColonneClient } from "@/components/commandes/ColonneClient"
import { CellulePlanning } from "@/components/commandes/CellulePlanning"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface PlanningClientTableProps {
  planning: Record<string, JourPlanning[]>
  selectedSecteurs: string[]
  selectedSemaine: string
  onRefresh: () => void
  refreshTrigger?: number
}

export function PlanningClientTable({
  planning,
  selectedSecteurs,
  selectedSemaine,
  onRefresh,
  refreshTrigger,
}: PlanningClientTableProps) {
  const [editId, setEditId] = useState<string | null>(null)
  const [heureTemp, setHeureTemp] = useState<Record<string, string>>({})
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [commentaireTemp, setCommentaireTemp] = useState<string>("")
  const [lastClickedCommandeId, setLastClickedCommandeId] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const elt = document.getElementById("commandes-filters")
    if (elt) {
      const update = () => setOffset(elt.getBoundingClientRect().bottom)
      update()
      window.addEventListener("resize", update)
      return () => window.removeEventListener("resize", update)
    }
  }, [])

  const champsHoraire: (keyof CommandeWithCandidat)[] = [
    "heure_debut_matin",
    "heure_fin_matin",
    "heure_debut_soir",
    "heure_fin_soir",
  ]

  const updateHeure = async (
    commande: CommandeWithCandidat,
    champ: keyof CommandeWithCandidat,
    nouvelleValeur: string
  ) => {
    const isChampHoraire = champsHoraire.includes(champ)
    const isValidTime = !isChampHoraire || /^\d{2}:\d{2}$/.test(nouvelleValeur)
    if (!isValidTime) return

    const { data: authData } = await supabase.auth.getUser()
    const userEmail = authData?.user?.email || null

    const { data: userApp } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("email", userEmail)
      .single()

    const userId = userApp?.id || null

    const { error } = await supabase
      .from("commandes")
      .update({ [champ]: nouvelleValeur })
      .eq("id", commande.id)

    if (!error && userId) {
      await supabase.from("historique").insert({
        table_cible: "commandes",
        ligne_id: commande.id,
        action: isChampHoraire ? "modification_horaire" : "modification_commentaire",
        description: isChampHoraire
          ? `Changement de ${champ} à ${nouvelleValeur}`
          : `Nouveau commentaire : ${nouvelleValeur}`,
        user_id: userId,
        date_action: new Date().toISOString(),
        apres: { champ, valeur: nouvelleValeur },
      })
    }
  }

  const groupesParSemaineEtSecteur = useMemo(() => {
    const groupes: Record<string, Record<string, Record<string, JourPlanning[]>>> = {}

    Object.values(planning)
      .flat()
      .forEach((jour) => {
        jour.commandes.forEach((commande) => {
          if (!commande.client) return

          const semaine = getWeek(new Date(jour.date), { weekStartsOn: 1 }).toString()
          const secteur = jour.secteur
          const clientNom = commande.client.nom
          const service = commande.service || ""
          const missionSlot = commande.mission_slot

          const groupKey = `${clientNom}||${secteur}||${semaine}||${service}||${missionSlot}`

          groupes[semaine] = groupes[semaine] || {}
          groupes[semaine][secteur] = groupes[semaine][secteur] || {}
          groupes[semaine][secteur][groupKey] = groupes[semaine][secteur][groupKey] || []

          let jourExistant = groupes[semaine][secteur][groupKey].find(
            (j) => j.date === jour.date
          )

          if (jourExistant) {
            jourExistant.commandes.push(commande)
          } else {
            groupes[semaine][secteur][groupKey].push({
              ...jour,
              commandes: [commande],
            })
          }
        })
      })

    return groupes
  }, [planning])

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-8 mt-8">
        {Object.entries(groupesParSemaineEtSecteur).map(([semaine, secteurs]) => {
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

          return Object.entries(secteurs).map(([secteur, groupes]) => {
            const semaineTexte = `Semaine ${semaine} • ${secteur}`

            return (
              <div key={`${semaine}-${secteur}`} className="border rounded-lg overflow-hidden shadow-sm">
                <div
                  className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white sticky z-[10]"
                  style={{ top: offset }}
                >
                  <div className="p-4 border-r flex items-center justify-center min-h-[64px]">{semaineTexte}</div>
                  {jours.map((jour, index) => {
                    let totalMissions = 0
                    let nbEnRecherche = 0
                    let nbValides = 0

                    Object.values(groupes).forEach((ligne) => {
                      const jourCell = ligne.find(
                        (j) => format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr
                      )
                      if (jourCell) {
                        totalMissions += jourCell.commandes.length
                        nbEnRecherche += jourCell.commandes.filter(
                          (cmd) => cmd.statut === "En recherche"
                        ).length
                        nbValides += jourCell.commandes.filter(
                          (cmd) => cmd.statut === "Validé"
                        ).length
                      }
                    })

                    return (
                      <div key={index} className="p-4 border-r text-center relative leading-tight min-h-[64px]">
                        <div className="text-sm font-semibold leading-tight">
                          {jour.label.split(" ")[0]}
                        </div>
                        <div className="text-sm leading-tight">
                          {jour.label.split(" ").slice(1).join(" ")}
                        </div>

                        {totalMissions === 0 ? (
                          <div className="absolute top-1 right-1">
                            <div className="h-5 w-5 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">–</div>
                          </div>
                        ) : nbEnRecherche > 0 ? (
                          <div className="absolute top-1 right-1 h-5 w-5 text-xs rounded-full flex items-center justify-center" style={{ backgroundColor: indicateurColors["En recherche"], color: "#1f2937" }}>
                            {nbEnRecherche}
                          </div>
                        ) : (
                          <div className="absolute top-1 right-1">
                            <div className="h-5 w-5 rounded-full bg-[#a9d08e] text-xs flex items-center justify-center text-gray-800">
                              {nbValides}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {Object.entries(groupes)
                  .sort(([aKey], [bKey]) => {
                    const [aClient, , , , aSlot] = aKey.split("||")
                    const [bClient, , , , bSlot] = bKey.split("||")
                    if (aClient < bClient) return -1
                    if (aClient > bClient) return 1
                    return parseInt(aSlot) - parseInt(bSlot)
                  })
                  .map(([groupKey, ligne]) => {
                    const [clientNom, secteurNom, _, service, missionSlotStr] = groupKey.split("||")
                    const missionSlot = parseInt(missionSlotStr)
                    const nbEnRecherche = ligne.flatMap((j) => j.commandes).filter((cmd) => cmd.statut === "En recherche").length
                    const clientId = ligne[0]?.commandes[0]?.client_id || ""
                    const commandeIdsLigne = ligne.flatMap((j) => j.commandes.map((c) => c.id))
                    const toutesCommandes = ligne.flatMap((j) => j.commandes)

                    return (
                      <div
                        className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-white text-sm font-medium text-gray-800 sticky z-[10] border-b"
                        style={{ top: offset }}
                      >
                        <ColonneClient
                          clientNom={clientNom}
                          secteur={secteurNom}
                          service={service}
                          semaine={semaine}
                          nbEnRecherche={nbEnRecherche}
                          commandeIdsLigne={commandeIdsLigne}
                          semaineDate={lundiSemaine.toISOString()}
                          commandes={toutesCommandes}
                        />
                        {jours.map((jour, index) => {
                          const jourCell = ligne.find(
                            (j) => format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr
                          )
                          const commande = jourCell?.commandes[0]
                          const jourLabel = format(jour.date, "EEEE dd MMMM", { locale: fr })

                          return (
                            <Tooltip key={index}>
                              <TooltipTrigger asChild>
                                <div
                                  className="border-r p-2 h-28 relative"
                                  data-commande-id={commande?.id}
                                  onClick={() => {
                                    if (commande?.id) {
                                      setLastClickedCommandeId(commande.id)
                                      localStorage.setItem('lastClickedCommandeId', commande.id)
                                    }
                                  }}
                                >
                                  <CellulePlanning
                                    commande={commande}
                                    secteur={secteurNom}
                                    editId={editId}
                                    heureTemp={heureTemp}
                                    setEditId={setEditId}
                                    setHeureTemp={setHeureTemp}
                                    updateHeure={updateHeure}
                                    commentaireTemp={commentaireTemp}
                                    setCommentaireTemp={setCommentaireTemp}
                                    editingCommentId={editingCommentId}
                                    setEditingCommentId={setEditingCommentId}
                                    date={jour.dateStr}
                                    clientId={clientId}
                                    service={service}
                                    onSuccess={onRefresh}
                                    lastClickedCommandeId={lastClickedCommandeId}
                                    missionSlot={missionSlot}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-sm capitalize">
                                {jourLabel}
                              </TooltipContent>
                            </Tooltip>
                          )
                        })}
                      </div>
                    )
                  })}
              </div>
            )
          })
        })}
      </div>
    </TooltipProvider>
  )
}
