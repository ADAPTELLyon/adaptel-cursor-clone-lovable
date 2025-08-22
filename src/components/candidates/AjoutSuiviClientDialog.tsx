// 📁 src/components/candidates/AjoutSuiviClientDialog.tsx
import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/lib/useUser"

import { secteursList } from "@/lib/secteurs"
import { useClientsBySecteur } from "@/hooks/useClientsBySecteur"

type Props = {
  open: boolean
  type: "priorite" | "interdiction"
  onClose: () => void
  candidatId: string
  secteurs: string[]            // secteurs associés au candidat (peut être vide)
  onSaved?: () => void
}

/**
 * Dialog d'ajout d'un suivi côté CANDIDAT (on choisit un CLIENT).
 * Anti-crash Radix:
 *  - Aucun <SelectItem> avec value=""
 *  - States Select initialisés à undefined (pas "")
 *  - Filtre des options sans id valide
 *  - Reset du client/service quand le secteur change
 * UX:
 *  - Si props.secteurs est vide → afficher TOUTE la liste secteursList
 *  - Si props.secteurs a des valeurs → intersection secteursList × props.secteurs
 */
export function AjoutSuiviClientDialog({
  open,
  type,
  onClose,
  candidatId,
  secteurs,
  onSaved,
}: Props) {
  const { user } = useUser()

  // Secteur sélectionné
  const [secteur, setSecteur] = useState<string | undefined>(undefined)

  // Liste des secteurs disponibles : fallback sur tous si props.secteurs est vide
  const secteursDisponibles = useMemo(() => {
    if (!secteurs || secteurs.length === 0) return secteursList
    const values = new Set(secteurs.map((s) => s.toLowerCase()))
    return secteursList.filter(
      (s) => values.has(s.value.toLowerCase()) || values.has(s.label.toLowerCase())
    )
  }, [secteurs])

  // Clients dépendants du secteur
  const { clients, loading: clientsLoading } = useClientsBySecteur(secteur || "")
  const safeClients = useMemo(
    () => (clients || []).filter((c: any) => c && typeof c.id === "string" && c.id.trim() !== ""),
    [clients]
  )
  const [clientId, setClientId] = useState<string | undefined>(undefined)

  // Service (optionnel) : ici champ libre (tu pourras le relier plus tard aux services client si besoin)
  const [service, setService] = useState<string | undefined>(undefined)

  const [commentaire, setCommentaire] = useState("")
  const [confirm, setConfirm] = useState(false)

  // Reset complet à la fermeture
  useEffect(() => {
    if (!open) {
      setSecteur(undefined)
      setClientId(undefined)
      setService(undefined)
      setCommentaire("")
      setConfirm(false)
    }
  }, [open])

  // Quand le secteur change, on réinitialise le client + service
  useEffect(() => {
    setClientId(undefined)
    setService(undefined)
  }, [secteur])

  const titre =
    type === "interdiction" ? "Ajouter une interdiction client" : "Ajouter un client prioritaire"

  const handleSave = async () => {
    if (!user?.id) {
      toast({ title: "Non connecté", description: "Veuillez vous reconnecter.", variant: "destructive" })
      return
    }
    if (!secteur || !clientId) {
      toast({ title: "Champs requis", description: "Sélectionnez un secteur et un client.", variant: "destructive" })
      return
    }
    if (type === "interdiction" && !confirm) {
      toast({ title: "Confirmation requise", description: "Cochez la case de confirmation d'interdiction.", variant: "destructive" })
      return
    }

    // Doublon actif ?
    const { data: existing, error: fetchError } = await supabase
      .from("interdictions_priorites")
      .select("id")
      .eq("candidat_id", candidatId)
      .eq("client_id", clientId)
      .eq("type", type)
      .eq("actif", true)

    if (fetchError) {
      toast({ title: "Erreur", description: fetchError.message, variant: "destructive" })
      return
    }
    if ((existing || []).length > 0) {
      toast({
        title: "Déjà présent",
        description:
          type === "interdiction"
            ? "Ce candidat a déjà une interdiction active pour ce client."
            : "Ce candidat est déjà prioritaire sur ce client.",
        variant: "destructive",
      })
      return
    }

    const payload = {
      client_id: clientId,
      candidat_id: candidatId,
      secteur,
      service: service ?? null,
      type, // "interdiction" | "priorite"
      commentaire: commentaire || null,
      created_by: user.id,
      actif: true,
    }

    const { error: insertError } = await supabase
      .from("interdictions_priorites")
      .insert([payload as never])

    if (insertError) {
      toast({ title: "Erreur", description: insertError.message, variant: "destructive" })
      return
    }

    toast({
      title: type === "interdiction" ? "Interdiction ajoutée" : "Priorité ajoutée",
    })
    onClose()
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Secteur */}
          <Select value={secteur} onValueChange={setSecteur}>
            <SelectTrigger>
              <SelectValue placeholder="Secteur" />
            </SelectTrigger>
            <SelectContent>
              {secteursDisponibles.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Client (dépend du secteur) */}
          <Select
            value={clientId}
            onValueChange={setClientId}
            disabled={!secteur || clientsLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={clientsLoading ? "Chargement..." : "Client"} />
            </SelectTrigger>
            <SelectContent>
              {safeClients.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Service optionnel (champ libre pour l’instant) */}
          <Input
            placeholder="Service (optionnel)"
            value={service ?? ""}
            onChange={(e) => {
              const v = e.target.value
              setService(v.trim() === "" ? undefined : v)
            }}
          />

          <Textarea
            placeholder="Commentaire (optionnel)"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
          />

          {type === "interdiction" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="confirm"
                checked={confirm}
                onCheckedChange={(v) => setConfirm(v === true)}
              />
              <label htmlFor="confirm" className="text-sm">
                Confirmer l’interdiction de ce candidat sur ce client
              </label>
            </div>
          )}

          <div className="pt-2">
            <Button
              onClick={handleSave}
              className="w-full bg-[#840404] text-white hover:bg-[#750303]"
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AjoutSuiviClientDialog
