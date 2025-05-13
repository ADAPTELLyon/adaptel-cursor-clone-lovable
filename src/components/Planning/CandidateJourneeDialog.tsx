import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import type { CandidatDispoWithNom } from "@/types/types-front"

export interface CandidateJourneeDialogProps {
  open: boolean
  onClose: () => void
  date: string
  secteur: string
  candidatId: string
  service?: string | null
  disponibilite?: CandidatDispoWithNom
  onSuccess: () => void
  candidatNomPrenom: string
}

export const CandidateJourneeDialog = ({
  open,
  onClose,
  date,
  secteur,
  candidatId,
  service,
  disponibilite,
  onSuccess,
  candidatNomPrenom,
}: CandidateJourneeDialogProps) => {
  const [statut, setStatut] = useState<"Non renseigné" | "Dispo" | "Non Dispo">(
    disponibilite?.statut === "Non Renseigné" ? "Non renseigné" : (disponibilite?.statut ?? "Non renseigné")
  )
  const [matin, setMatin] = useState<boolean>(false)
  const [soir, setSoir] = useState<boolean>(false)
  const [commentaire, setCommentaire] = useState(disponibilite?.commentaire ?? "")

  useEffect(() => {
    const s = disponibilite?.statut === "Non Renseigné" ? "Non renseigné" : (disponibilite?.statut ?? "Non renseigné")
    setStatut(s)
    setMatin(disponibilite?.matin ?? false)
    setSoir(disponibilite?.soir ?? false)
    setCommentaire(disponibilite?.commentaire ?? "")
  }, [disponibilite, open])

  const handleSave = async () => {
    const payload = {
      date,
      secteur,
      service: service || null,
      statut,
      dispo_matin: statut === "Dispo" ? matin : false,
      dispo_soir: statut === "Dispo" && secteur !== "Réception" ? soir : false,
      dispo_nuit: statut === "Dispo" && secteur === "Réception" ? soir : false,
      commentaire: statut === "Dispo" || statut === "Non Dispo" ? commentaire : null,
      candidat_id: candidatId,
    }

    const { error } = disponibilite
      ? await supabase.from("disponibilites").update(payload).eq("id", disponibilite.id)
      : await supabase.from("disponibilites").insert([payload])

    if (error) {
      toast({
        title: "Erreur",
        description: "Échec de l'enregistrement",
        variant: "destructive",
      })
      return
    }

    toast({ title: "Disponibilité enregistrée" })
    onClose()
    onSuccess()
  }

  const dateLabel = format(new Date(date), "EEEE d MMMM", { locale: fr })

  const handleStatutChange = (newStatut: "Non renseigné" | "Dispo" | "Non Dispo") => {
    setStatut(newStatut)

    if (newStatut === "Dispo") {
      setMatin(true)
      setSoir(secteur !== "Étages")
    } else {
      setMatin(false)
      setSoir(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Ajout Disponibilité – {dateLabel} <br />
            <span className="text-sm text-muted-foreground">{candidatNomPrenom}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex gap-2">
            {(["Non renseigné", "Non Dispo", "Dispo"] as const).map((s) => (
              <Button
                key={s}
                variant={statut === s ? "default" : "outline"}
                onClick={() => handleStatutChange(s)}
              >
                {s}
              </Button>
            ))}
          </div>

          {statut === "Dispo" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm w-[110px]">Matin / Midi</label>
                <Switch checked={matin} onCheckedChange={setMatin} />
              </div>

              {secteur !== "Étages" && (
                <div className="flex items-center gap-3">
                  <label className="text-sm w-[110px]">Soir</label>
                  <Switch checked={soir} onCheckedChange={setSoir} />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm">Commentaire</label>
                <Input
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Ajouter un commentaire (facultatif)"
                />
              </div>
            </div>
          )}

          {statut === "Non Dispo" && (
            <div className="flex flex-col gap-1">
              <label className="text-sm">Commentaire</label>
              <Input
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Ajouter un commentaire (facultatif)"
              />
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave}>Valider</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
