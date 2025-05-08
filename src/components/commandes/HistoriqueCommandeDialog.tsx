import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { statutColors } from "@/lib/colors"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { UserRound, Clock, Info, Pencil } from "lucide-react"
import type { Historique } from "@/types/types-front"
import { Button } from "@/components/ui/button"

interface HistoriqueCommandeDialogProps {
  commandeId: string
}

export function HistoriqueCommandeDialog({ commandeId }: HistoriqueCommandeDialogProps) {
  const [historique, setHistorique] = useState<Historique[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!commandeId || !open) return

    const fetchHistorique = async () => {
      const { data, error } = await supabase
        .from("historique")
        .select("*, user:user_id (prenom)")
        .eq("table_cible", "commandes")
        .eq("ligne_id", commandeId)
        .order("date_action", { ascending: false })

      if (!error && data) {
        setHistorique(data)
      }
    }

    fetchHistorique()
  }, [commandeId, open])

  return (
    <div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4 text-gray-600" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Historique de la commande</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Colonne gauche : historique */}
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {historique.map((item) => (
                  <div key={item.id} className="border rounded p-3 bg-white shadow-sm">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {format(new Date(item.date_action), "EEEE d MMMM - HH:mm", { locale: fr })}
                      </div>
                      <div className="flex items-center gap-1">
                        <UserRound className="h-4 w-4" />
                        {item.user?.prenom || "Utilisateur inconnu"}
                      </div>
                    </div>
                    <div className="mt-2 text-sm">
                      {item.action === "statut" && item.apres?.statut ? (
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
                      ) : item.action === "planification" ? (
                        <div>
                          Planification de <strong>{item.apres?.candidat?.nom} {item.apres?.candidat?.prenom}</strong>
                        </div>
                      ) : item.action === "modification_horaire" ? (
                        <div>
                          Modification horaire : <span className="italic">{item.description}</span>
                        </div>
                      ) : item.action === "creation" ? (
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-gray-500" />
                          <span>Création de la commande</span>
                        </div>
                      ) : (
                        <div>{item.description}</div>
                      )}
                    </div>
                  </div>
                ))}

                {historique.length === 0 && (
                  <div className="text-sm text-muted-foreground italic">
                    Aucun historique pour cette commande.
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Colonne droite (future liste candidats) */}
            <div className="border rounded bg-gray-50 h-[500px] flex items-center justify-center text-muted-foreground text-sm italic">
              Partie liste des candidats à venir…
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}