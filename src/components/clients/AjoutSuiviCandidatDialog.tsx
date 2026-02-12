import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "@/hooks/use-toast"
import { useCandidatsBySecteur } from "@/hooks/useCandidatsBySecteur"
import { Badge } from "@/components/ui/badge"

type Props = {
  open: boolean
  onClose: () => void
  clientId: string
  secteurs: string[]
  services: string[]
  type: "priorite" | "interdiction"
  onSaved: () => void
}

const SERVICE_NONE = "__NONE__"

const prettyLabel = (v: string) => {
  const s = (v || "").trim()
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const cleanList = (list: string[]) =>
  (list || []).map((x) => (x || "").trim()).filter((x) => x.length > 0)

export function AjoutSuiviCandidatDialog({
  open,
  onClose,
  clientId,
  secteurs,
  services,
  type,
  onSaved,
}: Props) {
  const { user } = useAuth()
  const [secteur, setSecteur] = useState("")
  const [service, setService] = useState<string>(SERVICE_NONE) // ✅ plus de ""
  const [candidatId, setCandidatId] = useState("")
  const [commentaire, setCommentaire] = useState("")
  const [createdBy, setCreatedBy] = useState<string | null>(null)

  const [searchCandidat, setSearchCandidat] = useState("")

  const secteursClean = useMemo(() => cleanList(secteurs), [secteurs])
  const servicesClean = useMemo(() => cleanList(services), [services])

  const { data: candidats = [], isLoading, refetch } = useCandidatsBySecteur(secteur)

  useEffect(() => {
    if (secteursClean.length === 1) setSecteur(secteursClean[0])
  }, [secteursClean])

  useEffect(() => {
    const fetchCreatedBy = async () => {
      if (!user?.email) return
      const { data, error } = await supabase
        .from("utilisateurs")
        .select("id")
        .eq("email", user.email)
        .single()
      if (!error && data?.id) setCreatedBy(data.id)
    }

    fetchCreatedBy()
  }, [user?.email])

  useEffect(() => {
    // reset léger à l’ouverture
    if (open) {
      setSearchCandidat("")
      // si on a des services, on remet sur NONE à l'ouverture
      setService(SERVICE_NONE)
    }
  }, [open])

  const candidatSelectedLabel = useMemo(() => {
    const found = candidats.find((c: any) => c.id === candidatId)
    if (!found) return ""
    return `${found.nom || ""} ${found.prenom || ""}`.trim()
  }, [candidats, candidatId])

  const candidatsFiltered = useMemo(() => {
    const q = searchCandidat.trim().toLowerCase()
    if (!q) return candidats
    return candidats.filter((c: any) => {
      const full = `${c.nom || ""} ${c.prenom || ""}`.toLowerCase()
      return full.includes(q)
    })
  }, [candidats, searchCandidat])

  const handleSave = async () => {
    if (!secteur || !candidatId || !createdBy) {
      toast({
        title: "Erreur",
        description: "Champs obligatoires manquants",
        variant: "destructive",
      })
      return
    }

    const serviceToSave = service === SERVICE_NONE ? null : service

    const { data: existants, error: checkError } = await supabase
      .from("interdictions_priorites")
      .select("id, type")
      .eq("client_id", clientId)
      .eq("candidat_id", candidatId)
      .eq("actif", true)

    if (checkError) {
      toast({ title: "Erreur", description: "Erreur de vérification", variant: "destructive" })
      return
    }

    const dejaPrioritaire = existants?.some((e) => e.type === "priorite")
    const dejaInterdit = existants?.some((e) => e.type === "interdiction")

    if (type === "priorite" && dejaPrioritaire) {
      toast({ title: "Erreur", description: "Ce candidat est déjà prioritaire pour ce client." })
      return
    }

    if (type === "interdiction" && dejaInterdit) {
      toast({ title: "Erreur", description: "Ce candidat est déjà interdit pour ce client." })
      return
    }

    if ((type === "priorite" && dejaInterdit) || (type === "interdiction" && dejaPrioritaire)) {
      toast({
        title: "Incohérence",
        description: `Ce candidat est déjà ${type === "priorite" ? "interdit" : "prioritaire"} pour ce client. Supprimez ce statut avant de modifier.`,
        variant: "destructive",
      })
      return
    }

    const payload = {
      client_id: clientId,
      candidat_id: candidatId,
      secteur,
      service: serviceToSave,
      type,
      commentaire: commentaire || null,
      created_by: createdBy,
      actif: true,
    }

    const { error: insertError } = await supabase
      .from("interdictions_priorites")
      .insert(payload)

    if (insertError) {
      toast({
        title: "Erreur",
        description: `Échec de l’enregistrement : ${insertError.message}`,
        variant: "destructive",
      })
      return
    }

    toast({ title: "Ajout réussi" })
    onSaved()
    onClose()

    setSecteur(secteursClean.length === 1 ? secteursClean[0] : "")
    setService(SERVICE_NONE)
    setCandidatId("")
    setCommentaire("")
    setSearchCandidat("")
  }

  const titre = type === "priorite" ? "Ajouter une priorité" : "Ajouter une interdiction"

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Secteur */}
          {secteursClean.length > 1 ? (
            <div className="space-y-2">
              <Label>Secteur *</Label>
              <Select
                value={secteur}
                onValueChange={(val) => {
                  setSecteur(val)
                  setCandidatId("")
                  setSearchCandidat("")
                  refetch()
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Sélectionner un secteur" />
                </SelectTrigger>
                <SelectContent>
                  {secteursClean.map((s) => (
                    <SelectItem key={s} value={s}>
                      {prettyLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Secteur *</Label>
              <Input value={prettyLabel(secteur || secteursClean[0] || "")} disabled className="h-10 bg-gray-50" />
            </div>
          )}

          {/* Service */}
          {servicesClean.length > 0 && (
            <div className="space-y-2">
              <Label>Service (facultatif)</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Sélectionner un service" />
                </SelectTrigger>
                <SelectContent>
                  {/* ✅ Radix: pas de value="" */}
                  <SelectItem value={SERVICE_NONE}>— Aucun —</SelectItem>
                  {servicesClean.map((s) => (
                    <SelectItem key={s} value={s}>
                      {prettyLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Candidat (recherche + liste) */}
          <div className="space-y-2">
            <Label>Candidat *</Label>

            <div className="rounded-md border border-gray-200 bg-white p-2">
              <Input
                value={searchCandidat}
                onChange={(e) => setSearchCandidat(e.target.value)}
                placeholder={isLoading ? "Chargement..." : "Rechercher un candidat..."}
                className="h-9"
                disabled={!secteur || isLoading}
              />

              {candidatSelectedLabel ? (
                <div className="mt-2">
                  <Badge className="rounded-md bg-gray-100 text-gray-800 border border-gray-200">
                    Sélectionné : {candidatSelectedLabel}
                  </Badge>
                </div>
              ) : null}

              <div className="mt-2 max-h-[220px] overflow-y-auto space-y-1 pr-1">
                {!secteur ? (
                  <div className="text-sm text-gray-500 italic px-2 py-2">
                    Sélectionne d’abord un secteur.
                  </div>
                ) : candidats.length === 0 && !isLoading ? (
                  <div className="text-sm text-gray-500 italic px-2 py-2">
                    Aucun candidat pour ce secteur
                  </div>
                ) : (
                  candidatsFiltered.map((c: any) => {
                    const label = `${c.nom || ""} ${c.prenom || ""}`.trim()
                    const selected = candidatId === c.id

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCandidatId(c.id)}
                        className={[
                          "w-full text-left px-2.5 py-2 rounded-md border transition-colors",
                          selected
                            ? "bg-[#840404] text-white border-[#840404]"
                            : "bg-white border-gray-200 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <div className="text-sm font-medium">{label || "Candidat"}</div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Commentaire */}
          <div className="space-y-2">
            <Label>Commentaire (facultatif)</Label>
            <Textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={handleSave} className="bg-[#840404] hover:bg-[#6a0303]">
              Ajouter
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
