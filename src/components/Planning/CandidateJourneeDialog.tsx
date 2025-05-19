import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import type { CandidatDispoWithNom } from "@/types/types-front"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

interface Props {
  open: boolean
  onClose: () => void
  date: string
  secteur: string
  candidatId: string
  service: string
  disponibilite?: CandidatDispoWithNom
  onSuccess: () => void
  candidatNomPrenom: string
}

export function CandidateJourneeDialog({
  open,
  onClose,
  date,
  secteur,
  candidatId,
  service,
  disponibilite,
  onSuccess,
  candidatNomPrenom,
}: Props) {
  const [statut, setStatut] = useState<"Dispo" | "Non Dispo" | "Non Renseigné">("Non Renseigné")
  const [matin, setMatin] = useState(false)
  const [soir, setSoir] = useState(false)
  const [commentaire, setCommentaire] = useState("")

  useEffect(() => {
    if (disponibilite) {
      setStatut(disponibilite.statut || "Non Renseigné")
      setMatin(disponibilite.matin || false)
      setSoir(disponibilite.soir || false)
      setCommentaire(disponibilite.commentaire || "")
    } else {
      setStatut("Non Renseigné")
      setMatin(false)
      setSoir(false)
      setCommentaire("")
    }
  }, [disponibilite, open])

  useEffect(() => {
    if (statut === "Dispo" && !disponibilite) {
      setMatin(true)
      setSoir(secteur !== "Étages")
    }
  }, [statut, secteur, disponibilite])

  const handleSave = async () => {
    if (!candidatId || !secteur || !date) {
      toast({ title: "Erreur", description: "Données manquantes" })
      return
    }

    if (statut === "Non Renseigné") {
      toast({ title: "Erreur", description: "Veuillez choisir un statut." })
      return
    }

    const payload = {
      candidat_id: candidatId,
      date,
      secteur,
      service: service || null,
      statut,
      commentaire: commentaire || null,
      dispo_matin: matin,
      dispo_soir: soir,
      dispo_nuit: false,
    }

    let error = null

    if (disponibilite?.id) {
      const { error: err } = await supabase
        .from("disponibilites")
        .update(payload)
        .eq("id", disponibilite.id)
      error = err
    } else {
      const { error: err } = await supabase.from("disponibilites").insert([payload])
      error = err
    }

    if (error) {
      console.error("Erreur Supabase:", error)
      toast({ title: "Erreur", description: "Échec enregistrement", variant: "destructive" })
    } else {
      toast({ title: "Disponibilité enregistrée" })
      onSuccess()
      onClose()
    }
  }

  const dateAffichee = format(new Date(date), "EEEE d MMMM", { locale: fr })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Disponibilité – {candidatNomPrenom} – {dateAffichee}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Statut</Label>
            <div className="flex gap-2">
              {["Dispo", "Non Dispo", "Non Renseigné"].map((val) => (
                <Button
                  key={val}
                  variant={statut === val ? "default" : "outline"}
                  onClick={() => setStatut(val as any)}
                >
                  {val}
                </Button>
              ))}
            </div>
          </div>

          {statut === "Dispo" && (
            <div className="flex gap-6 items-center">
              <div className="flex items-center gap-2">
                <Switch checked={matin} onCheckedChange={setMatin} />
                <span>Matin / Midi</span>
              </div>
              {secteur !== "Étages" && (
                <div className="flex items-center gap-2">
                  <Switch checked={soir} onCheckedChange={setSoir} />
                  <span>Soir</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label>Commentaire</Label>
            <Textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Commentaire (optionnel)"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <Button onClick={handleSave}>Enregistrer</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
