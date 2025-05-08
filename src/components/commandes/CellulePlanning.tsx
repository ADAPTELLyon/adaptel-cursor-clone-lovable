import { useState } from "react"
import { cn } from "@/lib/utils"
import { Plus, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { statutColors } from "@/lib/colors"
import type { CommandeWithCandidat } from "@/types/types-front"
import { CommandeJourneeDialog } from "@/components/commandes/CommandeJourneeDialog"

interface CellulePlanningProps {
  commande?: CommandeWithCandidat
  secteur: string
  editId: string | null
  heureTemp: Record<string, string>
  setEditId: (val: string | null) => void
  setHeureTemp: React.Dispatch<React.SetStateAction<Record<string, string>>>
  updateHeure: (
    commande: CommandeWithCandidat,
    champ: keyof CommandeWithCandidat,
    value: string
  ) => Promise<void>
  commentaireTemp: string
  setCommentaireTemp: (val: string) => void
  editingCommentId: string | null
  setEditingCommentId: (val: string | null) => void
  date: string
  clientId: string
  service?: string | null
  onSuccess?: () => void
}

export function CellulePlanning({
  commande,
  secteur,
  editId,
  heureTemp,
  setEditId,
  setHeureTemp,
  updateHeure,
  commentaireTemp,
  setCommentaireTemp,
  editingCommentId,
  setEditingCommentId,
  date,
  clientId,
  service,
  onSuccess,
}: CellulePlanningProps) {
  const isEtages = secteur === "Étages"
  const [openDialog, setOpenDialog] = useState(false)

  if (!commande) {
    return (
      <div
        className="h-full bg-gray-100 rounded flex items-center justify-center cursor-pointer"
        onClick={() => setOpenDialog(true)}
      >
        <Plus className="h-4 w-4 text-gray-400" />
        <CommandeJourneeDialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          date={date}
          clientId={clientId}
          secteur={secteur}
          service={service}
          onSuccess={onSuccess}
        />
      </div>
    )
  }

  return (
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
          const heureDebut = commande[`heure_debut_${creneau}` as keyof CommandeWithCandidat] ?? ""
          const heureFin = commande[`heure_fin_${creneau}` as keyof CommandeWithCandidat] ?? ""
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
                        setHeureTemp((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      onBlur={async () => {
                        const rawValue = heureTemp[key] ?? ""
                        await updateHeure(commande, champ as keyof CommandeWithCandidat, rawValue)
                        setHeureTemp((prev) => ({ ...prev, [key]: rawValue }))
                        setEditId(null)
                      }}
                      className="w-16 text-[13px] px-1 rounded text-black bg-transparent border-none focus:border focus:bg-white"
                    />
                  ) : (
                    <span
                      key={key}
                      onClick={() => {
                        setEditId(key)
                        setHeureTemp((prev) => ({ ...prev, [key]: String(value) }))
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
              <Button variant="ghost" className="p-0 h-auto w-auto text-black hover:text-black">
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 text-sm">
              {editingCommentId === commande.id ? (
                <div className="space-y-2">
                  <Input
                    value={commentaireTemp}
                    onChange={(e) => setCommentaireTemp(e.target.value)}
                  />
                  <Button size="sm" onClick={() => setEditingCommentId(null)}>
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
                      setCommentaireTemp(commande.commentaire || "")
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
  )
}
