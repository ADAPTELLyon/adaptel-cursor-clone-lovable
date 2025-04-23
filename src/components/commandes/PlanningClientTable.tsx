import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Pencil, CheckCircle, Plus, Building2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { statutColors, indicateurColors } from "@/lib/colors"
import type { Database } from "@/types/supabase"

type Commande = Database["public"]["Tables"]["commandes"]["Row"] & {
  clients?: { nom: string }
  candidats?: { nom: string; prenom: string }
}

export function PlanningClientTable() {
  const [commandes, setCommandes] = useState<Commande[]>([])

  useEffect(() => {
    const fetchCommandes = async () => {
      const { data, error } = await supabase
        .from("commandes")
        .select(`*, clients (nom), candidats (nom, prenom)`)
        .order("date", { ascending: true })

      if (error) {
        console.error("Erreur chargement commandes", error)
        return
      }

      setCommandes(data || [])
    }

    fetchCommandes()
  }, [])

  const groupesParSemaine = commandes.reduce((acc, commande) => {
    const semaine = format(parseISO(commande.date), "I")
    if (!acc[semaine]) acc[semaine] = []
    acc[semaine].push(commande)
    return acc
  }, {} as Record<string, Commande[]>)

  return (
    <div className="space-y-8 mt-8">
      {Object.entries(groupesParSemaine).map(([semaine, commandesSemaine]) => {
        const semaineTexte = `Semaine ${semaine}`
        const groupes = commandesSemaine.reduce((acc, cmd) => {
          const cle = `${cmd.client_id}-${cmd.secteur}-${cmd.service}`
          if (!acc[cle]) acc[cle] = []
          acc[cle].push(cmd)
          return acc
        }, {} as Record<string, Commande[]>)

        const groupesTries = Object.entries(groupes).sort((a, b) => {
          const nomA = a[1][0].clients?.nom || ""
          const nomB = b[1][0].clients?.nom || ""
          return nomA.localeCompare(nomB)
        })

        const jours = Array.from({ length: 7 }, (_, i) => {
          const base = parseISO(commandesSemaine[0].date)
          const lundi = new Date(base.setDate(base.getDate() - base.getDay() + 1))
          const jour = new Date(lundi)
          jour.setDate(lundi.getDate() + i)
          return {
            date: jour,
            dateStr: format(jour, "yyyy-MM-dd"),
            label: format(jour, "eeee dd MMMM", { locale: fr }),
          }
        })

        return (
          <div key={semaine} className="border rounded-lg overflow-hidden shadow-sm">
            {/* EN-TÊTE UNIQUE */}
            <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white">
              <div className="p-3 border-r flex items-center justify-center">{semaineTexte}</div>
              {jours.map((jour, index) => {
                const nbRecherche = commandesSemaine.filter(
                  (c) => c.date === jour.dateStr && c.statut === "En recherche"
                ).length

                return (
                  <div key={index} className="p-3 border-r text-center relative leading-tight">
                    <div>{jour.label.split(" ")[0]}</div>
                    <div className="text-xs">{jour.label.split(" ").slice(1).join(" ")}</div>
                    {nbRecherche > 0 ? (
                      <div
                        className="absolute top-1 right-1 h-5 w-5 text-xs rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: indicateurColors["En recherche"],
                          color: "white",
                        }}
                      >
                        {nbRecherche}
                      </div>
                    ) : (
                      <div className="absolute top-1 right-1">
                        <CheckCircle
                          className="h-4 w-4"
                          style={{ color: indicateurColors["Validé"] }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* LIGNES CLIENTS */}
            {groupesTries.map(([cle, lignes]) => {
              const { clients, secteur, service } = lignes[0]
              const client_nom = clients?.nom || ""

              return (
                <div key={cle} className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] border-t text-sm">
                  <div className="p-4 border-r space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{client_nom}</span>
                      <Pencil className="h-4 w-4 text-gray-400 cursor-pointer" />
                    </div>
                    <div className="flex items-start gap-2 flex-wrap text-sm">
                      <div className="text-[13px] px-2 py-1 rounded bg-gray-100 text-gray-800 flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {secteur}
                      </div>
                      {service && (
                        <div className="text-[13px] px-2 py-1 rounded bg-gray-100 text-gray-800 italic">
                          {service}
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500">{semaineTexte}</div>
                  </div>

                  {jours.map((jour, index) => {
                    const commandesJour = lignes.filter((c) => c.date === jour.dateStr)
                    const commande = commandesJour[0]

                    return (
                      <div key={index} className="border-r p-2 h-24 relative">
                        {!commande ? (
                          <div className="h-full bg-gray-100 rounded flex items-center justify-center">
                            <Plus className="h-4 w-4 text-gray-400" />
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "h-full rounded p-2 text-xs flex flex-col justify-between border relative"
                            )}
                            style={{
                              backgroundColor: statutColors[commande.statut]?.bg || "#e5e7eb",
                              color: statutColors[commande.statut]?.text || "#000000",
                            }}
                          >
                            {commande.statut === "Validé" &&
                            commande.candidats?.nom &&
                            commande.candidats?.prenom ? (
                              <div className="leading-tight font-semibold">
                                <span>{commande.candidats.nom}</span>
                                <span className="block text-xs font-normal">{commande.candidats.prenom}</span>
                              </div>
                            ) : (
                              <div className="font-medium">{commande.statut}</div>
                            )}

                            <div className="text-[11px] space-y-0.5">
                              {commande.heure_debut_matin && commande.heure_fin_matin && (
                                <div>{commande.heure_debut_matin.slice(0, 5)} - {commande.heure_fin_matin.slice(0, 5)}</div>
                              )}
                              {commande.heure_debut_soir && commande.heure_fin_soir && (
                                <div>{commande.heure_debut_soir.slice(0, 5)} - {commande.heure_fin_soir.slice(0, 5)}</div>
                              )}
                              {commande.heure_debut_nuit && commande.heure_fin_nuit && (
                                <div>{commande.heure_debut_nuit.slice(0, 5)} - {commande.heure_fin_nuit.slice(0, 5)}</div>
                              )}
                            </div>

                            <div className="absolute top-1 right-1">
                              <div className="rounded-full p-1 bg-white/40">
                                <Plus className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          </div>
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
