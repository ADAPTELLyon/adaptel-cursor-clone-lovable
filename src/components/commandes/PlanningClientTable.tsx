import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Pencil, Check, Plus } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { statutColors, indicateurColors } from "@/lib/colors"
import { secteursList } from "@/lib/secteurs"
import type { Commande } from "@/types"

export function PlanningClientTable() {
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [heureTemp, setHeureTemp] = useState<Record<string, string>>({})

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

      setCommandes(data as unknown as Commande[])
    }

    fetchCommandes()
  }, [])

  const groupesParSemaine = commandes.reduce((acc, commande) => {
    const semaine = format(parseISO(commande.date), "I")
    if (!acc[semaine]) acc[semaine] = []
    acc[semaine].push(commande)
    return acc
  }, {} as Record<string, Commande[]>)

  const formatHeure = (val: string) => {
    const digits = val.replace(/\D/g, "")
    if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`
    if (digits.length === 3) return `0${digits[0]}:${digits.slice(1)}`
    return val
  }

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
                        <div className="h-5 w-5 rounded-full bg-[#48bb78] flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {groupesTries.map(([cle, lignes]) => {
              const { clients, secteur, service } = lignes[0]
              const client_nom = clients?.nom || ""
              const secteurInfo = secteursList.find((s) => s.value === secteur)

              return (
                <div key={cle} className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] border-t text-sm">
                  <div className="p-4 border-r space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{client_nom}</span>
                      <Pencil className="h-4 w-4 text-gray-400 cursor-pointer" />
                    </div>
                    <div className="flex items-start gap-2 flex-wrap text-sm">
                      {secteurInfo && (
                        <div className="text-[13px] px-2 py-1 rounded bg-gray-100 text-gray-800 flex items-center gap-1">
                          <secteurInfo.icon className="h-3 w-3" /> {secteurInfo.label}
                        </div>
                      )}
                      {service && (
                        <div className="text-[13px] px-2 py-1 rounded bg-gray-100 text-gray-800 italic">
                          {service}
                        </div>
                      )}
                    </div>
                    <div className="text-[13px] text-gray-500">{semaineTexte}</div>
                  </div>

                  {jours.map((jour, index) => {
                    const commandesJour = lignes.filter((c) => c.date === jour.dateStr)
                    const commande = commandesJour[0]

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
                              backgroundColor: statutColors[commande.statut]?.bg || "#e5e7eb",
                              color: statutColors[commande.statut]?.text || "#000000",
                            }}
                          >
                            <div className="leading-tight font-semibold">
                              {commande.statut === "Validé" &&
                              commande.candidats?.nom &&
                              commande.candidats?.prenom ? (
                                <>
                                  <span>{commande.candidats.nom}</span>
                                  <span className="block text-xs font-normal">
                                    {commande.candidats.prenom}
                                  </span>
                                </>
                              ) : (
                                <span className="font-medium">{commande.statut}</span>
                              )}
                            </div>

                            <div className="text-[13px] font-semibold mt-1 space-y-1">
                              {["matin", "soir"].map((creneau) => {
                                const heureDebut = commande[`heure_debut_${creneau}` as keyof Commande] as string | null
                                const heureFin = commande[`heure_fin_${creneau}` as keyof Commande] as string | null
                                const keyDebut = `${commande.id}-${creneau}-debut`
                                const keyFin = `${commande.id}-${creneau}-fin`

                                return (
                                  <div key={creneau} className="flex gap-1 items-center">
                                    {[keyDebut, keyFin].map((key, idx) => (
                                      editId === key ? (
                                        <input
                                          key={key}
                                          type="text"
                                          autoFocus
                                          value={heureTemp[key] || ""}
                                          onChange={(e) =>
                                            setHeureTemp({
                                              ...heureTemp,
                                              [key]: formatHeure(e.target.value),
                                            })
                                          }
                                          onBlur={() => setEditId(null)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              setEditId(null)
                                            }
                                          }}
                                          className="w-12 text-[13px] px-1 border rounded bg-white text-black"
                                        />
                                      ) : (
                                        <span
                                          key={key}
                                          onClick={() => {
                                            setEditId(key)
                                            setHeureTemp((prev) => ({
                                              ...prev,
                                              [key]:
                                                key.includes("debut")
                                                  ? heureDebut?.slice(0, 5) || ""
                                                  : heureFin?.slice(0, 5) || "",
                                            }))
                                          }}
                                          className="cursor-pointer hover:underline"
                                        >
                                          {(key.includes("debut") ? heureDebut : heureFin)?.slice(0, 5) || "–"}
                                        </span>
                                      )
                                    ))}
                                  </div>
                                )
                              })}
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
