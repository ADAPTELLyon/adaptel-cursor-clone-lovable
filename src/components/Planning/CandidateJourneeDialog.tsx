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
  creneauVerrouille?: "matin" | "soir"
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
  creneauVerrouille,
}: Props) {
  const [statut, setStatut] = useState<"Dispo" | "Non Dispo" | "Non Renseigné">("Non Renseigné")
  const [matin, setMatin] = useState(false)
  const [soir, setSoir] = useState(false)
  const [commentaire, setCommentaire] = useState("")

  useEffect(() => {
    if (disponibilite) {
      setStatut(disponibilite.statut || "Non Renseigné")
      setMatin(disponibilite.matin ?? false)
      setSoir(disponibilite.soir ?? false)
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
      setMatin(creneauVerrouille === "matin" ? true : true)
      setSoir(secteur !== "Étages" ? (creneauVerrouille === "soir" ? true : true) : false)
    }
  }, [statut, secteur, disponibilite, creneauVerrouille])

  const handleSave = async () => {
    if (!candidatId || !secteur || !date) {
      toast({ title: "Erreur", description: "Données manquantes", variant: "destructive" })
      return
    }

    const payload = {
      candidat_id: candidatId,
      date,
      secteur,
      service: service || null,
      statut,
      commentaire: commentaire || null,
      dispo_matin: creneauVerrouille === "matin" ? true : matin,
      dispo_soir: creneauVerrouille === "soir" ? true : soir,
      dispo_nuit: false,
    }

    let error = null

    if (statut === "Non Renseigné") {
      if (disponibilite?.id) {
        const { error: err } = await supabase
          .from("disponibilites")
          .delete()
          .eq("id", disponibilite.id)
        error = err
        if (!error) toast({ title: "Disponibilité supprimée" })
      }
    } else {
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
      if (!error) toast({ title: "Disponibilité enregistrée" })
    }

    if (error) {
      console.error("Erreur Supabase:", error)
      toast({ title: "Erreur", description: "Échec enregistrement", variant: "destructive" })
    } else {
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

        <div className="space-y-6 pt-2">
          {/* Statut */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Statut</Label>
            <div className="grid grid-cols-3 gap-2">
              {["Dispo", "Non Dispo", "Non Renseigné"].map((val) => (
                <Button
                  key={val}
                  variant={statut === val ? "default" : "outline"}
                  onClick={() => setStatut(val as any)}
                  className="w-full py-2 text-sm"
                >
                  {val}
                </Button>
              ))}
            </div>
          </div>

          {/* Créneaux */}
          {statut === "Dispo" && (
            <div className="flex gap-6 items-center">
              {/* Matin */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={creneauVerrouille === "matin" ? true : matin}
                  disabled={creneauVerrouille === "matin"}
                  onCheckedChange={(val) => setMatin(val)}
                />
                <span className="text-sm">
                  Matin / Midi
                  {creneauVerrouille === "matin" && (
                    <span className="text-xs italic text-gray-500 ml-2">En mission</span>
                  )}
                </span>
              </div>

              {/* Soir */}
              {secteur !== "Étages" && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={creneauVerrouille === "soir" ? true : soir}
                    disabled={creneauVerrouille === "soir"}
                    onCheckedChange={(val) => setSoir(val)}
                  />
                  <span className="text-sm">
                    Soir
                    {creneauVerrouille === "soir" && (
                      <span className="text-xs italic text-gray-500 ml-2">En mission</span>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Commentaire */}
          <div className="space-y-1">
            <Label>Commentaire</Label>
            <Textarea
              value={commentaire || ""}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Commentaire (optionnel)"
            />
          </div>

          {/* Bouton Enregistrer */}
          <div className="pt-4 flex justify-end">
            <Button onClick={handleSave} className="bg-[#840404] text-white hover:bg-[#750303]">
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
