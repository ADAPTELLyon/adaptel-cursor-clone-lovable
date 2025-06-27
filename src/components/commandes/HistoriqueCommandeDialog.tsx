import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"
import { HistoriqueDialogGauche } from "./HistoriqueDialogGauche"
import { PlanningCandidatsSemaine } from "./PlanningCandidatsSemaine"

interface Props {
  commandeIds: string[]
  secteur: string
  semaineDate: string
  children?: React.ReactNode
}

export function HistoriqueCommandeDialog({
  commandeIds,
  secteur,
  semaineDate,
  children,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {children ? (
        <span onClick={() => setOpen(true)} className="cursor-pointer">
          {children}
        </span>
      ) : (
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4 text-gray-600" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-7xl p-6">
          <DialogHeader>
            <DialogTitle>Historique & Disponibilités</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-[1fr_2fr] gap-6">
            <HistoriqueDialogGauche commandeIds={commandeIds} open={open} />
            <div className="h-[600px] overflow-y-auto pr-2">
              <PlanningCandidatsSemaine
                semaineDate={semaineDate}
                secteur={secteur}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
