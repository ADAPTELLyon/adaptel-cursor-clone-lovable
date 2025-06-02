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
import { CheckCircle2, XCircle, HelpCircle, Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"

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

type Statut = "Dispo" | "Non dispo" | "Non renseigné"

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
  const [statut, setStatut] = useState<Statut>("Non renseigné")
  const [matin, setMatin] = useState(false)
  const [soir, setSoir] = useState(false)
  const [commentaire, setCommentaire] = useState("")

  useEffect(() => {
    if (disponibilite) {
      setStatut((disponibilite.statut as Statut) || "Non renseigné")
      setMatin(disponibilite.matin || false)
      setSoir(disponibilite.soir || false)
      setCommentaire(disponibilite.commentaire || "")
    } else {
      setStatut("Non renseigné")
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

    const statutToSend = statut === "Non renseigné" ? null : statut

    const payload = {
      candidat_id: candidatId,
      date,
      secteur,
      service: service || null,
      statut: statutToSend,
      commentaire: commentaire || null,
      dispo_matin: matin,
      dispo_soir: soir,
      dispo_nuit: false,
    }

    const { error } = disponibilite?.id
      ? await supabase.from("disponibilites").update(payload).eq("id", disponibilite.id)
      : await supabase.from("disponibilites").insert([payload])

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

  const statusConfig = {
    "Dispo": {
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: "bg-green-100 text-green-800",
      activeColor: "bg-green-600 text-white hover:bg-green-700",
      iconColor: "text-green-600"
    },
    "Non dispo": {
      icon: <XCircle className="w-4 h-4" />,
      color: "bg-red-100 text-red-800",
      activeColor: "bg-red-600 text-white hover:bg-red-700",
      iconColor: "text-red-600"
    },
    "Non renseigné": {
      icon: <HelpCircle className="w-4 h-4" />,
      color: "bg-gray-100 text-gray-800",
      activeColor: "bg-gray-600 text-white hover:bg-gray-700",
      iconColor: "text-gray-600"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div>Disponibilité du candidat</div>
              <div className="text-sm font-normal text-muted-foreground">
                {candidatNomPrenom} • {dateAffichee}
                {service && ` • ${service}`}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Statut de disponibilité</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["Dispo", "Non dispo", "Non renseigné"] as Statut[]).map((val) => (
                <button
                  key={val}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    statut === val 
                      ? statusConfig[val].activeColor 
                      : `${statusConfig[val].color} hover:bg-opacity-80 border-border`
                  )}
                  onClick={() => setStatut(val)}
                >
                  <span className={cn(
                    "p-1 rounded-full",
                    statut === val ? "bg-white/20" : statusConfig[val].color
                  )}>
                    {React.cloneElement(statusConfig[val].icon, {
                      className: cn("w-4 h-4", statut === val ? "text-white" : statusConfig[val].iconColor)
                    })}
                  </span>
                  <span>{val}</span>
                </button>
              ))}
            </div>
          </div>

          {statut === "Dispo" && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Créneaux disponibles</Label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>Matin / Midi</span>
                    </div>
                    <Switch checked={matin} onCheckedChange={setMatin} />
                  </label>
                </div>
                
                {secteur !== "Étages" && (
                  <div className="flex-1">
                    <label className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Moon className="w-4 h-4 text-indigo-500" />
                        <span>Soir</span>
                      </div>
                      <Switch checked={soir} onCheckedChange={setSoir} />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-medium">Commentaire</Label>
            <Textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Ajouter un commentaire (optionnel)"
              className="min-h-[100px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={handleSave}>
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}