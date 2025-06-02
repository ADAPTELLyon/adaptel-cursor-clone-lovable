import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Candidat, Client } from "@/types/types-front"

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  client: Client
  secteurs: string[]
  services: string[]
  type: "priorite" | "interdiction"
}

export function AjoutSuiviCandidatDialog({ open, onClose, onSaved, client, secteurs, services, type }: Props) {
  const [secteur, setSecteur] = useState("")
  const [service, setService] = useState("")
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [search, setSearch] = useState("")
  const [selectedCandidat, setSelectedCandidat] = useState<Candidat | null>(null)
  const [commentaire, setCommentaire] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("candidats")
        .select("id, nom, prenom")
        .eq("actif", true)

      if (!error && data) setCandidats(data)
    }

    if (open) load()
  }, [open])

  useEffect(() => {
    if (secteurs.length === 1) setSecteur(secteurs[0])
    if (services.length === 1) setService(services[0])
  }, [secteurs, services])

  const handleSave = async () => {
    if (!selectedCandidat || !secteur) {
      toast({ title: "Champs requis", description: "Merci de renseigner un candidat et un secteur", variant: "destructive" })
      return
    }

    setLoading(true)

    const { error } = await supabase.from("interdictions_priorites").insert({
      candidat_id: selectedCandidat.id,
      client_id: client.id,
      secteur,
      service: service || null,
      commentaire,
      type,
      actif: true,
    })

    setLoading(false)

    if (error) {
      toast({ title: "Erreur", description: "Échec de l'enregistrement", variant: "destructive" })
    } else {
      toast({ title: "Ajouté" })
      onSaved()
      onClose()
      setSelectedCandidat(null)
      setCommentaire("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajouter une {type === "priorite" ? "priorité" : "interdiction"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Secteur */}
          {secteurs.length > 1 && (
            <div>
              <label className="text-sm font-medium">Secteur</label>
              <select
                className="w-full border rounded p-2 text-sm"
                value={secteur}
                onChange={(e) => setSecteur(e.target.value)}
              >
                <option value="">-- Choisir un secteur --</option>
                {secteurs.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {/* Service */}
          {services.length > 1 && (
            <div>
              <label className="text-sm font-medium">Service</label>
              <select
                className="w-full border rounded p-2 text-sm"
                value={service}
                onChange={(e) => setService(e.target.value)}
              >
                <option value="">-- Choisir un service --</option>
                {services.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {/* Recherche candidat */}
          <div>
            <label className="text-sm font-medium">Candidat</label>
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <ScrollArea className="h-40 mt-2 border rounded p-2">
              {candidats
                .filter((c) =>
                  `${c.prenom} ${c.nom}`.toLowerCase().includes(search.toLowerCase()))
                .map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCandidat(c)}
                    className={`p-2 text-sm cursor-pointer rounded ${
                      selectedCandidat?.id === c.id ? "bg-blue-100" : "hover:bg-gray-100"
                    }`}
                  >
                    {c.prenom} {c.nom}
                  </div>
                ))}
            </ScrollArea>
          </div>

          {/* Commentaire */}
          <Textarea placeholder="Commentaire (optionnel)" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />

          {/* Bouton */}
          <div className="text-right">
            <Button onClick={handleSave} disabled={loading || !selectedCandidat || !secteur}>
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
