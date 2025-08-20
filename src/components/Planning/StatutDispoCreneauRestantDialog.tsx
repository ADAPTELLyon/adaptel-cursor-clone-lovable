import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import type { CandidatDispoWithNom } from "@/types/types-front"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

interface Props {
  open: boolean
  onClose: () => void
  candidatId: string
  date: string
  secteur: string
  creneau: "matin" | "soir"
  disponibilite?: CandidatDispoWithNom
  service: string
  onSuccess: () => void
  candidatNomPrenom: string
  commentaireActuel?: string
  onSaved?: (d: { statut: "Dispo" | "Non Dispo" | "Non Renseigné"; matin: boolean | null; soir: boolean | null; commentaire?: string } | null) => void
}

export function StatutDispoCreneauRestantDialog({
  open,
  onClose,
  candidatId,
  date,
  secteur,
  creneau,
  disponibilite,
  service,
  onSuccess,
  candidatNomPrenom,
  commentaireActuel = "",
  onSaved,
}: Props) {
  const [statut, setStatut] = useState<"Dispo" | "Non Dispo" | "Non Renseigné">("Non Renseigné")
  const [commentaire, setCommentaire] = useState(commentaireActuel || "")

  useEffect(() => {
    const s = (disponibilite?.statut || "").toLowerCase()
    if (s === "dispo") setStatut("Dispo")
    else if (s === "non dispo") setStatut("Non Dispo")
    else setStatut("Non Renseigné")
    setCommentaire(disponibilite?.commentaire || "")
  }, [disponibilite, open])

  const handleSave = async () => {
    let dispo_matin: boolean | null
    let dispo_soir: boolean | null

    if (statut === "Non Dispo") {
      dispo_matin = false
      dispo_soir = false
    } else if (statut === "Dispo") {
      const isMatin = creneau === "matin"
      dispo_matin = isMatin ? true : (disponibilite?.matin ?? null)
      dispo_soir = !isMatin ? true : (disponibilite?.soir ?? null)
      if ((dispo_matin === null || dispo_matin === false) && (dispo_soir === null || dispo_soir === false)) {
        if (isMatin) dispo_matin = true
        else dispo_soir = true
      }
    } else {
      const isMatin = creneau === "matin"
      dispo_matin = isMatin ? null : (disponibilite?.matin ?? null)
      dispo_soir = !isMatin ? null : (disponibilite?.soir ?? null)
    }

    const payload = {
      candidat_id: candidatId,
      date,
      secteur,
      service: service || null,
      statut,
      commentaire: commentaire || null,
      dispo_matin,
      dispo_soir,
      dispo_nuit: false,
    }

    const table = supabase.from("disponibilites")
    let error = null

    const tousVides = (statut === "Non Renseigné") && (dispo_matin === null) && (dispo_soir === null)
    if (tousVides && disponibilite?.id) {
      const { error: err } = await table.delete().eq("id", disponibilite.id)
      error = err
      if (!error) toast({ title: "Disponibilité supprimée" })
    } else {
      if (disponibilite?.id) {
        const { error: err } = await table.update(payload).eq("id", disponibilite.id)
        error = err
      } else {
        const { error: err } = await table.insert([payload])
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
      onSaved?.(statut === "Non Renseigné" ? null : { statut, matin: dispo_matin, soir: dispo_soir, commentaire: commentaire || undefined })
      onSuccess?.()
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

          <div>
            <label className="text-sm block mb-1">Commentaire</label>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={3}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>

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
