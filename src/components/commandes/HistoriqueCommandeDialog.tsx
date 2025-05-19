import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { statutColors } from "@/lib/colors"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { UserRound, Clock, Pencil } from "lucide-react"
import type { Historique } from "@/types/types-front"
import { Button } from "@/components/ui/button"

interface HistoriqueCommandeDialogProps {
  commandeIds: string[]
}

export function HistoriqueCommandeDialog({ commandeIds }: HistoriqueCommandeDialogProps) {
  const [historique, setHistorique] = useState<Historique[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!commandeIds || commandeIds.length === 0 || !open) return

    const fetchHistorique = async () => {
      const { data, error } = await supabase
        .from("historique")
        .select("*, user:user_id (prenom)")
        .eq("table_cible", "commandes")
        .in("ligne_id", commandeIds)
        .order("date_action", { ascending: true })

      if (!error && data) {
        setHistorique(data)
      }
    }

    fetchHistorique()
  }, [commandeIds, open])

  const renderLibelleHeure = (champ: string) => {
    switch (champ) {
      case "heure_debut_matin": return "Heure début matin"
      case "heure_fin_matin": return "Heure fin matin"
      case "heure_debut_soir": return "Heure début soir"
      case "heure_fin_soir": return "Heure fin soir"
      case "heure_debut_nuit": return "Heure début nuit"
      case "heure_fin_nuit": return "Heure fin nuit"
      default: return champ
    }
  }

  return (
    <div>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4 text-gray-600" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Historique de la ligne de commande</DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[500px] pr-2">
            <div className="space-y-4">
              {historique.map((item) => {
                const date = format(new Date(item.date_action), "EEEE d MMMM - HH:mm", { locale: fr })

                return (
                  <div key={item.id} className="border rounded-lg p-3 bg-white shadow-sm space-y-2">
                    {/* Ligne de haut : Date + User */}
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {date}
                      </div>
                      <div className="flex items-center gap-1">
                        <UserRound className="h-4 w-4" />
                        {item.user?.prenom || "Utilisateur inconnu"}
                      </div>
                    </div>

                    {/* Contenu selon type d'action */}
                    <div className="text-sm space-y-1">
                      {item.action === "statut" && item.apres?.statut && (
                        <div className="flex items-center gap-2">
                          <span>Changement de statut</span>
                          <Badge
                            style={{
                              backgroundColor: statutColors[item.apres.statut]?.bg,
                              color: statutColors[item.apres.statut]?.text,
                            }}
                          >
                            {item.apres.statut}
                          </Badge>
                        </div>
                      )}

                      {item.action === "planification" && (
                        <>
                          <div className="flex items-center gap-2">
                            <span>Planification</span>
                            <Badge
                              style={{
                                backgroundColor: statutColors["Validé"].bg,
                                color: statutColors["Validé"].text,
                              }}
                            >
                              {item.apres?.candidat?.nom} {item.apres?.candidat?.prenom}
                            </Badge>
                          </div>
                          {item.apres?.date && (
                            <div>
                              Planifié sur le {format(new Date(item.apres.date), "EEEE d MMMM", { locale: fr })} de{" "}
                              {item.apres?.heure_debut_matin?.slice(0, 5)} à {item.apres?.heure_fin_matin?.slice(0, 5)}
                            </div>
                          )}
                        </>
                      )}

                      {item.action === "creation" && (
                        <>
                          <div className="flex items-center gap-2">
                            <span>Création commande</span>
                            <Badge
                              style={{
                                backgroundColor: statutColors["En recherche"].bg,
                                color: statutColors["En recherche"].text,
                              }}
                            >
                              En recherche
                            </Badge>
                          </div>
                          {item.apres?.date && (
                            <div>
                              Pour le {format(new Date(item.apres.date), "EEEE d MMMM", { locale: fr })} :{" "}
                              {item.apres?.heure_debut_matin?.slice(0, 5)} - {item.apres?.heure_fin_matin?.slice(0, 5)}
                              {item.apres?.heure_debut_soir && item.apres?.heure_fin_soir && (
                                <> et {item.apres.heure_debut_soir.slice(0, 5)} - {item.apres.heure_fin_soir.slice(0, 5)}</>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {item.action === "modification_horaire" && (
                        <>
                          <div className="font-semibold">Modification horaire</div>
                          <div className="italic text-gray-700">
                            {renderLibelleHeure(item.apres?.champ)} : {item.apres?.valeur}
                          </div>
                        </>
                      )}

                      {item.action !== "statut" && item.action !== "creation" && item.action !== "planification" && item.action !== "modification_horaire" && (
                        <div className="italic text-muted-foreground">
                          {item.description || "(Action non précisée)"}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {historique.length === 0 && (
                <div className="text-sm text-muted-foreground italic">
                  Aucun historique pour cette ligne de commande.
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
