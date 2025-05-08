import { useState } from "react"
import { cn } from "@/lib/utils"
import { Pencil, Check, Plus, Info } from "lucide-react"
import { format, startOfWeek, addDays, getWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { statutColors, indicateurColors } from "@/lib/colors"
import { secteursList } from "@/lib/secteurs"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat, JourPlanning } from "@/types/types-front"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { HistoriqueCommandeDialog } from "@/components/commandes/HistoriqueCommandeDialog"

export function PlanningClientTable({
  planning,
  selectedSecteurs,
  selectedSemaine,
}: {
  planning: Record<string, JourPlanning[]>
  selectedSecteurs: string[]
  selectedSemaine: string
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [heureTemp, setHeureTemp] = useState<Record<string, string>>({})
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [commentaireTemp, setCommentaireTemp] = useState<string>("")
  const [commandeHistoriqueId, setCommandeHistoriqueId] = useState<string | null>(null)

  const updateHeure = async (
    commande: CommandeWithCandidat,
    champ: keyof CommandeWithCandidat,
    nouvelleValeur: string
  ) => {
    const isValidTime = /^\d{2}:\d{2}$/.test(nouvelleValeur)
    if (!isValidTime) return
    const { error } = await supabase
      .from("commandes")
      .update({ [champ]: nouvelleValeur })
      .eq("id", commande.id)
    if (!error) commande[champ] = nouvelleValeur
  }

  const updateCommentaire = async (commande: CommandeWithCandidat) => {
    const { error } = await supabase
      .from("commandes")
      .update({ commentaire: commentaireTemp })
      .eq("id", commande.id)
    if (!error) {
      commande.commentaire = commentaireTemp
      setEditingCommentId(null)
    }
  }

  const groupesParSemaine: Record<string, Record<string, JourPlanning[][]>> = {}

  Object.entries(planning).forEach(([client, jours]) => {
    jours.forEach((jour) => {
      const semaine = getWeek(new Date(jour.date), { weekStartsOn: 1 }).toString()
      if (!groupesParSemaine[semaine]) groupesParSemaine[semaine] = {}
      const cle = `${client}||${jour.secteur}||${jour.service || ""}`
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
                let totalMissions = 0
                let nbEnRecherche = 0
                Object.values(groupes).forEach((groupe) =>
                  groupe.forEach((ligne) => {
                    const jourCell = ligne.find(
                      (j) => format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr
                    )
                    if (jourCell) {
                      totalMissions += jourCell.commandes.length
                      nbEnRecherche += jourCell.commandes.filter(
                        (cmd) => cmd.statut === "En recherche"
                      ).length
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
                    {totalMissions === 0 ? null : nbEnRecherche > 0 ? (
                      <div
                        className="absolute top-1 right-1 h-5 w-5 text-xs rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "#fdba74", color: "white" }}
                      >
                        !
                      </div>
                    ) : (
                      <div className="absolute top-1 right-1">
                        <div className="h-5 w-5 rounded-full bg-[#a9d08e] flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {Object.entries(groupes).map(([key, lignes]) => {
              const [clientNom, secteur, service] = key.split("||")
              const secteurInfo = secteursList.find((s) => s.value === secteur)

              return lignes.map((ligne, ligneIndex) => {
                const nbEnRecherche = ligne
                  .flatMap((j) => j.commandes)
                  .filter((cmd) => cmd.statut === "En recherche").length

                const commandeId = ligne[0]?.commandes[0]?.id

                return (
                  <div
                    key={`${key}-${ligneIndex}`}
                    className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] border-t text-sm"
                  >
                    <div className="p-4 border-r bg-gray-50">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{clientNom}</span>
                        {commandeId && (
                          <div className="h-5 w-5 rounded-full bg-white border shadow flex items-center justify-center">
                            <HistoriqueCommandeDialog commandeId={commandeId} />
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center mt-1">
                        <div className="flex flex-wrap gap-2">
                          {secteurInfo && (
                            <div className="text-[13px] font-semibold px-2 py-1 rounded border bg-white text-gray-800 flex items-center gap-1">
                              <secteurInfo.icon className="h-3 w-3" />
                              {secteurInfo.label}
                            </div>
                          )}
                          {service && (
                            <div className="text-[13px] px-2 py-1 rounded border bg-white text-gray-800">
                              {service}
                            </div>
                          )}
                        </div>

                        {nbEnRecherche > 0 ? (
                          <div className="h-5 w-5 rounded-full bg-[#fdba74] flex items-center justify-center">
                            <span className="text-white text-xs font-bold">!</span>
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-[#a9d08e] flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="text-[13px] text-gray-500 mt-1">{`Semaine ${semaine}`}</div>
                    </div>

                    {jours.map((jour, index) => {
                      const jourCell = ligne.find(
                        (j) => format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr
                      )
                      const commande = jourCell?.commandes[0]
                      const isEtages = secteur === "Étages"

                      return (
                        <div key={index} className="border-r p-2 h-28 relative">
                          {!commande ? (
                            <div className="h-full bg-gray-100 rounded flex items-center justify-center">
                              <Plus className="h-4 w-4 text-gray-400" />
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "h-full rounded p-2 text-xs flex flex-col justify-start gap-1 border relative"
                              )}
                              style={{
                                backgroundColor:
                                  statutColors[commande.statut]?.bg || "#e5e7eb",
                                color: statutColors[commande.statut]?.text || "#000000",
                              }}
                            >
                              <div className="leading-tight font-semibold">
                                {commande.statut === "Validé" && commande.candidat ? (
                                  <>
                                    <span>{commande.candidat.nom}</span>
                                    <span className="block text-xs font-normal">
                                      {commande.candidat.prenom}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-medium">{commande.statut}</span>
                                    <span className="block text-xs font-normal h-[1.25rem]"></span>
                                  </>
                                )}
                              </div>
                              <div className="text-[13px] font-semibold mt-1 space-y-1">
                                {["matin", ...(isEtages ? [] : ["soir"])].map((creneau) => {
                                  const heureDebut =
                                    commande[`heure_debut_${creneau}` as keyof CommandeWithCandidat] ?? ""
                                  const heureFin =
                                    commande[`heure_fin_${creneau}` as keyof CommandeWithCandidat] ?? ""
                                  const keyDebut = `${commande.id}-${creneau}-debut`
                                  const keyFin = `${commande.id}-${creneau}-fin`

                                  return (
                                    <div key={creneau} className="flex gap-1 items-center">
                                      {[{ key: keyDebut, value: heureDebut, champ: `heure_debut_${creneau}` },
                                        { key: keyFin, value: heureFin, champ: `heure_fin_${creneau}` }].map(
                                        ({ key, value, champ }) =>
                                          editId === key ? (
                                            <Input
                                              key={key}
                                              type="time"
                                              value={String(heureTemp[key] ?? value).slice(0, 5)}
                                              autoFocus
                                              onChange={(e) =>
                                                setHeureTemp((prev) => ({
                                                  ...prev,
                                                  [key]: e.target.value,
                                                }))
                                              }
                                              onBlur={async () => {
                                                const rawValue = heureTemp[key] ?? ""
                                                await updateHeure(
                                                  commande,
                                                  champ as keyof CommandeWithCandidat,
                                                  rawValue
                                                )
                                                setHeureTemp((prev) => ({
                                                  ...prev,
                                                  [key]: rawValue,
                                                }))
                                                setEditId(null)
                                              }}
                                              className="w-16 text-[13px] px-1 rounded text-black bg-transparent border-none focus:border focus:bg-white"
                                            />
                                          ) : (
                                            <span
                                              key={key}
                                              onClick={() => {
                                                setEditId(key)
                                                setHeureTemp((prev) => ({
                                                  ...prev,
                                                  [key]: String(value),
                                                }))
                                              }}
                                              className="cursor-pointer hover:underline"
                                            >
                                              {String(value).slice(0, 5) || "–"}
                                            </span>
                                          )
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                              <div className="absolute top-1 right-1">
                                <div className="rounded-full p-1 bg-white/40">
                                  <Plus className="h-3 w-3 text-white" />
                                </div>
                              </div>

                              {commande.commentaire && (
                                <div className="absolute bottom-1 right-1">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        className="p-0 h-auto w-auto text-black hover:text-black"
                                      >
                                        <Info className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 text-sm">
                                      {editingCommentId === commande.id ? (
                                        <div className="space-y-2">
                                          <Input
                                            value={commentaireTemp}
                                            onChange={(e) =>
                                              setCommentaireTemp(e.target.value)
                                            }
                                          />
                                          <Button
                                            size="sm"
                                            onClick={() => updateCommentaire(commande)}
                                          >
                                            Sauvegarder
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          <div>{commande.commentaire}</div>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              setEditingCommentId(commande.id)
                                              setCommentaireTemp(
                                                commande.commentaire || ""
                                              )
                                            }}
                                          >
                                            Modifier
                                          </Button>
                                        </div>
                                      )}
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              )}
                            </div>
                          )}
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
