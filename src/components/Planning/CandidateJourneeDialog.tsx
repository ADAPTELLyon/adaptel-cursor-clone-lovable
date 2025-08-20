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
  onSaved?: (d: { statut: "Dispo" | "Non Dispo" | "Non Renseigné"; matin: boolean; soir: boolean; commentaire?: string } | null) => void
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
  onSaved,
}: Props) {
  const [statut, setStatut] = useState<"Dispo" | "Non Dispo" | "Non Renseigné">("Non Renseigné")
  const [matin, setMatin] = useState(false)
  const [soir, setSoir] = useState(false)
  const [commentaire, setCommentaire] = useState("")

  useEffect(() => {
    if (disponibilite) {
      const s = (disponibilite.statut || "Non Renseigné") as "Dispo" | "Non Dispo" | "Non Renseigné"
      setStatut(s)
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
      setMatin(true)
      setSoir(secteur !== "Étages")
    }
  }, [statut, secteur, disponibilite])

  const handleSave = async () => {
    if (!candidatId || !secteur || !date) {
      toast({ title: "Erreur", description: "Données manquantes", variant: "destructive" })
      return
    }

    let finalMatin = creneauVerrouille === "matin" ? true : matin
    let finalSoir = creneauVerrouille === "soir" ? true : soir
    if (secteur === "Étages") finalSoir = false
    if (statut === "Non Dispo") { finalMatin = false; finalSoir = false }
    if (statut === "Dispo" && !finalMatin && !finalSoir) finalMatin = true

    const payload = {
      candidat_id: candidatId,
      date,
      secteur,
      service: service || null,
      statut,
      commentaire: commentaire || null,
      dispo_matin: finalMatin,
      dispo_soir: finalSoir,
      dispo_nuit: false,
    }

    let error = null

    if (statut === "Non Renseigné") {
      if (disponibilite?.id) {
        const { error: err } = await supabase.from("disponibilites").delete().eq("id", disponibilite.id)
        error = err
        if (!error) toast({ title: "Disponibilité supprimée" })
      }
    } else {
      if (disponibilite?.id) {
        const { error: err } = await supabase.from("disponibilites").update(payload).eq("id", disponibilite.id)
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
      try {
        window.dispatchEvent(new CustomEvent("adaptel:refresh-planning-candidat", { detail: { candidatId, date, secteur } }))
      } catch {}
      onSaved?.(statut === "Non Renseigné" ? null : { statut, matin: finalMatin, soir: finalSoir, commentaire: commentaire || undefined })
      onSuccess?.()
      onClose()
    }
  }

  const dateAffichee = format(new Date(date), "EEEE d MMMM", { locale: fr })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Disponibilité – {candidatNomPrenom} – {dateAffichee}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Statut</Label>
            <div className="grid grid-cols-3 gap-2">
              {["Dispo", "Non Dispo", "Non Renseigné"].map((val) => (
                <Button
                  key={val}
                  variant={statut === (val as any) ? "default" : "outline"}
                  onClick={() => setStatut(val as any)}
                  className="w-full py-2 text-sm"
                >
                  {val}
                </Button>
              ))}
            </div>
          </div>

          {statut === "Dispo" && (
            <div className="flex gap-6 items-center">
              <div className="flex items-center gap-2">
                <Switch
                  checked={creneauVerrouille === "matin" ? true : matin}
                  disabled={creneauVerrouille === "matin"}
                  onCheckedChange={(val) => setMatin(val)}
                />
                <span className="text-sm">
                  Matin / Midi
                  {creneauVerrouille === "matin" && <span className="text-xs italic text-gray-500 ml-2">En mission</span>}
                </span>
              </div>

              {secteur !== "Étages" && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={creneauVerrouille === "soir" ? true : soir}
                    disabled={creneauVerrouille === "soir"}
                    onCheckedChange={(val) => setSoir(val)}
                  />
                  <span className="text-sm">
                    Soir
                    {creneauVerrouille === "soir" && <span className="text-xs italic text-gray-500 ml-2">En mission</span>}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label>Commentaire</Label>
            <Textarea value={commentaire || ""} onChange={(e) => setCommentaire(e.target.value)} placeholder="Commentaire (optionnel)" />
          </div>

          <div className="pt-4 flex justify-end">
            <Button onClick={handleSave} className="bg-[#840404] text-white hover:bg-[#750303]">Enregistrer</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
