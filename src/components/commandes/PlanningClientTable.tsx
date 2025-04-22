import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Pencil, Share2, CheckCircle, Plus, Building2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"

interface Commande {
  id: string
  client_id: string
  candidat_id?: string
  secteur: string
  service?: string
  date: string
  creneau: string
  statut: string
  partage: boolean
  client_nom: string
  candidat_nom?: string
  candidat_prenom?: string
}

export function PlanningClientTable() {
  const [commandes, setCommandes] = useState<Commande[]>([])

  useEffect(() => {
    const fetchCommandes = async () => {
      const { data, error } = await supabase
        .from("commandes")
        .select(
          `id, client_id, candidat_id, secteur, service, date, creneau, statut, partage,
           clients:client_id (nom),
           candidats:candidat_id (nom, prenom)`
        )
        .order("date")

      if (error) {
        console.error("Erreur chargement commandes", error)
        return
      }

      const transform: Commande[] = (data || []).map((c) => ({
        id: c.id,
        client_id: c.client_id,
        candidat_id: c.candidat_id,
        secteur: c.secteur,
        service: c.service,
        date: c.date,
        creneau: c.creneau,
        statut: c.statut,
        partage: c.partage,
        client_nom: c.clients?.nom || "",
        candidat_nom: c.candidats?.nom || undefined,
        candidat_prenom: c.candidats?.prenom || undefined,
      }))

      setCommandes(transform)
    }

    fetchCommandes()
  }, [])

  const commandesParClient = commandes.reduce((acc, c) => {
    const semaine = format(parseISO(c.date), "I")
    const cle = `${semaine}-${c.client_id}`
    if (!acc[cle]) acc[cle] = []
    acc[cle].push(c)
    return acc
  }, {} as Record<string, Commande[]>)

  return (
    <div className="space-y-6 mt-8">
      {Object.entries(commandesParClient).map(([cle, lignes]) => {
        const { client_nom, secteur, service, partage } = lignes[0]
        const semaineTexte = `Semaine ${format(parseISO(lignes[0].date), "I")}`

        const jours = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(parseISO(lignes[0].date))
          const lundi = new Date(d.setDate(d.getDate() - d.getDay() + 1))
          const jour = new Date(lundi)
          jour.setDate(lundi.getDate() + i)
          const jourStr = format(jour, "yyyy-MM-dd")
          return {
            date: jourStr,
            label: format(jour, "EEEE", { locale: fr }),
            jourNum: format(jour, "dd", { locale: fr }),
            mois: format(jour, "MMMM", { locale: fr }),
            commandes: lignes.filter((c) => c.date === jourStr),
          }
        })

        return (
          <div key={cle} className="border rounded-lg overflow-hidden shadow-sm">
            {/* En-tête semaine */}
            <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white">
              <div className="p-3 border-r">{semaineTexte}</div>
              {jours.map((jour, index) => (
                <div key={index} className="p-3 border-r text-center relative">
                  <div>{jour.label}</div>
                  <div className="text-xs">
                    {jour.jourNum}<br />{jour.mois}
                  </div>
                  {jour.commandes.some((c) => c.statut === "En recherche") ? (
                    <div className="absolute top-2 right-2 h-4 w-4 text-xs rounded-full bg-[#fdba74] text-white flex items-center justify-center">
                      {jour.commandes.filter((c) => c.statut === "En recherche").length}
                    </div>
                  ) : (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="text-[#86efac] h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Ligne planning */}
            <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] text-sm">
              <div className="p-4 border-r space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{client_nom}</span>
                  <Pencil className="h-4 w-4 text-gray-400 cursor-pointer" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-800 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {secteur}
                  </div>
                  {service && <div className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-800 italic">{service}</div>}
                </div>
                <div className="text-xs text-gray-500 mt-2 flex justify-between items-center">
                  {semaineTexte}
                  <div className="flex items-center gap-1">
                    <Share2 className="h-4 w-4 text-gray-400 cursor-pointer" />
                    <div className={cn("h-2 w-2 rounded-full", partage ? "bg-[#86efac]" : "bg-gray-400")} />
                  </div>
                </div>
              </div>

              {jours.map((jour, index) => (
                <div key={index} className="border-r p-2 space-y-1 relative">
                  {jour.commandes.length === 0 && (
                    <div className="h-20 bg-gray-100 rounded relative">
                      <div className="absolute top-2 left-2">
                        <div className="rounded-full p-1 bg-gray-300">
                          <Plus className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    </div>
                  )}
                  {jour.commandes.map((cmd) => (
                    <div
                      key={cmd.id}
                      className={cn(
                        "h-20 rounded p-2 text-xs space-y-1 text-white flex flex-col justify-between border relative",
                        cmd.statut === "En recherche" && "bg-[#fdba74]",
                        cmd.statut === "Validé" && "bg-[#86efac]",
                        cmd.statut === "Non pourvue" && "bg-[#fca5a5]",
                        cmd.statut === "Absence" && "bg-gray-200 text-red-500",
                        ["Annule Int", "Annule Client", "Annule Ada"].includes(cmd.statut) && "bg-yellow-100 text-black"
                      )}
                    >
                      {cmd.statut === "Validé" && cmd.candidat_nom && cmd.candidat_prenom ? (
                        <div className="flex flex-col leading-tight font-semibold">
                          <span>{cmd.candidat_nom}</span>
                          <span className="text-xs font-normal">{cmd.candidat_prenom}</span>
                        </div>
                      ) : (
                        <div className="font-medium cursor-pointer">{cmd.statut}</div>
                      )}
                      <div className="text-[10px]">
                        {cmd.creneau === "Matin/Midi" && "08:00 - 14:00"}
                        {cmd.creneau === "Soir" && "17:00 - 22:00"}
                        {cmd.creneau === "Matin/Midi + Soir" && (
                          <>
                            <div>08:00 - 14:00</div>
                            <div>17:00 - 22:00</div>
                          </>
                        )}
                      </div>
                      <div className="absolute top-1 left-1">
                        <div className="rounded-full p-1 bg-white/40">
                          <Plus className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
