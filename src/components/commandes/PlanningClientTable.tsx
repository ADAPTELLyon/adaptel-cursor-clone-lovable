import { useState } from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { format, startOfWeek, addDays, getWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { statutColors, indicateurColors } from "@/lib/colors"
import { supabase } from "@/lib/supabase"
import type { CommandeWithCandidat, JourPlanning } from "@/types/types-front"
import { Input } from "@/components/ui/input"
import { ColonneClient } from "@/components/commandes/ColonneClient"
import { CellulePlanning } from "@/components/commandes/CellulePlanning"

export function PlanningClientTable({
  planning,
  selectedSecteurs,
  selectedSemaine,
  onRefresh,
  refreshTrigger = 0,
}: {
  planning: Record<string, JourPlanning[]>
  selectedSecteurs: string[]
  selectedSemaine: string
  onRefresh: () => void
  refreshTrigger?: number
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [heureTemp, setHeureTemp] = useState<Record<string, string>>({})
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [commentaireTemp, setCommentaireTemp] = useState<string>("")

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

    if (!error) {
      commande[champ] = nouvelleValeur
      if (userId) {
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
  }

  const groupesParSemaineEtSecteur: Record<string, Record<string, Record<string, JourPlanning[][]>>> = {}

  Object.entries(planning).forEach(([clientNomStr, jours]) => {
    const clientNom = clientNomStr
    jours.forEach((jour) => {
      const semaine = getWeek(new Date(jour.date), { weekStartsOn: 1 }).toString()
      const secteur = jour.secteur
      if (!groupesParSemaineEtSecteur[semaine]) groupesParSemaineEtSecteur[semaine] = {}
      if (!groupesParSemaineEtSecteur[semaine][secteur]) groupesParSemaineEtSecteur[semaine][secteur] = {}

      const cle = `${clientNom}||${secteur}||${jour.service || ""}`
      if (!groupesParSemaineEtSecteur[semaine][secteur][cle]) groupesParSemaineEtSecteur[semaine][secteur][cle] = []

      let ligneExistante = groupesParSemaineEtSecteur[semaine][secteur][cle].find((ligne) =>
        !ligne.some(
          (cell) =>
            format(new Date(cell.date), "yyyy-MM-dd") ===
            format(new Date(jour.date), "yyyy-MM-dd")
        )
      )

      if (!ligneExistante) {
        ligneExistante = []
        groupesParSemaineEtSecteur[semaine][secteur][cle].push(ligneExistante)
      }
      ligneExistante.push(jour)
    })
  })

  return (
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
              <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white">
                <div className="p-3 border-r flex items-center justify-center">{semaineTexte}</div>
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
                    <div key={index} className="p-3 border-r text-center relative leading-tight">
                      <div>{jour.label.split(" ")[0]}</div>
                      <div className="text-xs">{jour.label.split(" ").slice(1).join(" ")}</div>
                      {totalMissions === 0 ? (
                        <div className="absolute top-1 right-1">
                          <div className="h-5 w-5 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">–</div>
                        </div>
                      ) : nbEnRecherche > 0 ? (
                        <div className="absolute top-1 right-1 h-5 w-5 text-xs rounded-full flex items-center justify-center" style={{ backgroundColor: indicateurColors["En recherche"], color: "white" }}>
                          {nbEnRecherche}
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
                const [clientNom, secteurNom, service] = key.split("||")
                return lignes.map((ligne, ligneIndex) => {
                  const nbEnRecherche = ligne
                    .flatMap((j) => j.commandes)
                    .filter((cmd) => cmd.statut === "En recherche").length

                  const clientId = ligne[0]?.commandes[0]?.client_id || ""
                  const commandeIdsLigne = ligne.flatMap((j) => j.commandes.map((c) => c.id))

                  return (
                    <div
                      key={`${key}-${ligneIndex}`}
                      className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] border-t text-sm"
                    >
                      <ColonneClient
                        clientNom={clientNom}
                        secteur={secteurNom}
                        service={service}
                        semaine={semaine}
                        nbEnRecherche={nbEnRecherche}
                        commandeIdsLigne={commandeIdsLigne}
                        semaineDate={lundiSemaine.toISOString()}
                      />
                      {jours.map((jour, index) => {
                        const jourCell = ligne.find(
                          (j) => format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr
                        )
                        const commande = jourCell?.commandes.find((c) => commandeIdsLigne.includes(c.id))
                        return (
                          <div key={index} className="border-r p-2 h-28 relative">
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
        })
      })}
    </div>
  )
}
