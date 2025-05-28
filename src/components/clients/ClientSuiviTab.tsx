// src/components/clients/ClientSuiviTab.tsx
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import { AjoutSuiviCandidatDialog } from "./AjoutSuiviCandidatDialog"
import type { InterdictionPriorite } from "@/types/types-front"

type Props = {
  clientId: string
  secteurs: string[]
  services: string[]
}

export function ClientSuiviTab({ clientId, secteurs, services }: Props) {
  const [prioritaires, setPrioritaires] = useState<InterdictionPriorite[]>([])
  const [interdits, setInterdits] = useState<InterdictionPriorite[]>([])
  const [showDialog, setShowDialog] = useState<false | "priorite" | "interdiction">(false)

  const loadData = async () => {
    const { data, error } = await supabase
      .from("interdictions_priorites")
      .select("id, secteur, service, commentaire, type, candidat: candidat_id (id, nom, prenom)")
      .eq("client_id", clientId)

    if (error) {
      toast({ title: "Erreur", description: "Chargement échoué", variant: "destructive" })
      return
    }

    const propres = (data || []) as InterdictionPriorite[]
    setPrioritaires(propres.filter((d) => d.type === "priorite"))
    setInterdits(propres.filter((d) => d.type === "interdiction"))
  }

  useEffect(() => {
    if (clientId) loadData()
  }, [clientId])

  return (
    <div className="space-y-8">
      {/* PRIORITAIRES */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Candidats prioritaires</h3>
          <Button variant="outline" onClick={() => setShowDialog("priorite")}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>
        {prioritaires.length === 0 ? (
          <div className="text-sm italic text-muted-foreground">Aucun candidat prioritaire</div>
        ) : (
          <ul className="space-y-2">
            {prioritaires.map((item) => (
              <li key={item.id} className="border rounded p-2 text-sm bg-white shadow-sm">
                <div className="font-medium">
                  {item.candidat?.nom} {item.candidat?.prenom}
                </div>
                <div className="text-xs text-gray-500">
                  {item.secteur}{item.service ? ` • ${item.service}` : ""}
                </div>
                {item.commentaire && <div className="text-xs mt-1 italic">{item.commentaire}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* INTERDICTIONS */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Candidats interdits</h3>
          <Button variant="outline" onClick={() => setShowDialog("interdiction")}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>
        {interdits.length === 0 ? (
          <div className="text-sm italic text-muted-foreground">Aucun candidat interdit</div>
        ) : (
          <ul className="space-y-2">
            {interdits.map((item) => (
              <li key={item.id} className="border rounded p-2 text-sm bg-white shadow-sm">
                <div className="font-medium">
                  {item.candidat?.nom} {item.candidat?.prenom}
                </div>
                <div className="text-xs text-gray-500">
                  {item.secteur}{item.service ? ` • ${item.service}` : ""}
                </div>
                {item.commentaire && <div className="text-xs mt-1 italic">{item.commentaire}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* POPUP */}
      <AjoutSuiviCandidatDialog
        open={!!showDialog}
        type={showDialog || "priorite"}
        onClose={() => setShowDialog(false)}
        clientId={clientId}
        secteurs={secteurs}
        services={services}
        onSaved={loadData}
      />
    </div>
  )
}
