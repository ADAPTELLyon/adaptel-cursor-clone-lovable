import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Plus, Pencil, Check, FileText, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { statutColors, statutBorders } from "@/lib/colors"
import type { CommandeWithCandidat } from "@/types/types-front"
import { CommandeJourneeDialog } from "@/components/commandes/CommandeJourneeDialog"
import { PlanificationCandidatDialog } from "@/components/commandes/PlanificationCandidatDialog"
import { PopoverPlanificationRapide } from "@/components/commandes/PopoverPlanificationRapide"
import { PopoverChangementStatut } from "@/components/commandes/PopoverChangementStatut"
import { supabase } from "@/lib/supabase"

interface CellulePlanningProps {
  commande?: CommandeWithCandidat
  secteur: string
  editId: string | null
  heureTemp: Record<string, string>
  setEditId: (val: string | null) => void
  setHeureTemp: React.Dispatch<React.SetStateAction<Record<string, string>>>
  updateHeure: (
    commande: CommandeWithCandidat,
    champ: keyof CommandeWithCandidat,
    value: string
  ) => Promise<void>
  commentaireTemp: string
  setCommentaireTemp: (val: string) => void
  editingCommentId: string | null
  setEditingCommentId: (val: string | null) => void
  date: string
  clientId: string
  service?: string | null
  onSuccess?: () => void
  lastClickedCommandeId?: string | null
  missionSlot: number
}

const MOTIFS = [
  "Extra",
  "Accroissement d'activité",
  "Remplacement Personnel Absent",
] as const

// Normalise quel que soit la casse/accents vers nos 3 libellés
const normalizeMotif = (m?: string | null): typeof MOTIFS[number] | null => {
  if (!m) return null
  const s = m.trim().toLowerCase()
  if (s === "extra") return "Extra"
  if (s.startsWith("accroissement")) return "Accroissement d'activité"
  if (s.startsWith("remplacement")) return "Remplacement Personnel Absent"
  return (m as unknown) as typeof MOTIFS[number]
}

// Utilitaire: début/fin de semaine (Lundi→Dimanche) à partir d'une date YYYY-MM-DD
function getWeekBounds(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number)
  const base = new Date(y, (m ?? 1) - 1, d ?? 1)
  const day = base.getDay() // 0=Dim,1=Lun,...6=Sam
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(base)
  monday.setDate(base.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const toYMD = (dt: Date) => {
    const yy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, "0")
    const dd = String(dt.getDate()).padStart(2, "0")
    return `${yy}-${mm}-${dd}`
  }
  return { start: toYMD(monday), end: toYMD(sunday) }
}

export function CellulePlanning({
  commande,
  secteur,
  editId,
  heureTemp,
  setEditId,
  setHeureTemp,
  updateHeure,
  commentaireTemp,
  setCommentaireTemp,
  editingCommentId,
  setEditingCommentId,
  date,
  clientId,
  service,
  onSuccess,
  lastClickedCommandeId,
  missionSlot,
}: CellulePlanningProps) {
  const isEtages = secteur === "Étages"
  const [openDialog, setOpenDialog] = useState(false)
  const [openPlanifDialog, setOpenPlanifDialog] = useState(false)

  // Hydratation immédiate du nom/prénom après planif (sans refetch global)
  const [localCandidat, setLocalCandidat] = useState<{ nom: string; prenom: string } | null>(null)

  // Popover CONTRAT (icône dédié)
  const [openContrat, setOpenContrat] = useState(false)
  const [motifTemp, setMotifTemp] = useState<string>("")
  const [complementMotifTemp, setComplementMotifTemp] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      if (!commande) return
      if (commande.statut === "Validé" && !commande.candidat && commande.candidat_id) {
        const sb: any = supabase
        const { data } = await sb
          .from("candidats")
          .select("nom, prenom")
          .eq("id", commande.candidat_id)
          .single()
        if (!cancelled && data) {
          setLocalCandidat({
            nom: data.nom ?? "–",
            prenom: data.prenom ?? "–",
          })
        }
      } else {
        setLocalCandidat(null)
      }
    }
    hydrate()
    return () => { cancelled = true }
  }, [commande?.id, commande?.statut, commande?.candidat_id, !!commande?.candidat])

  if (!commande) {
    return (
      <>
        <div
          className="h-full bg-gray-100 rounded flex items-center justify-center cursor-pointer hover:bg-gray-200"
          onClick={() => setOpenDialog(true)}
        >
          <Plus className="h-4 w-4 text-gray-400" />
        </div>
        <CommandeJourneeDialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          date={date}
          clientId={clientId}
          secteur={secteur}
          service={service}
          missionSlot={missionSlot}
          onSuccess={onSuccess}
        />
      </>
    )
  }

  const statutColor = statutColors[commande.statut] || { bg: "#e5e7eb", text: "#000000" }
  const borderColor = statutBorders[commande.statut] || "#d1d5db"

  const candidatToShow = commande.candidat ?? localCandidat

  // Icônes en bas à droite :
  const hasComment = !!commande.commentaire
  const motifNorm = normalizeMotif(commande.motif_contrat)
  const showContratIcon =
    motifNorm === "Accroissement d'activité" || motifNorm === "Remplacement Personnel Absent"

  return (
    <div
      className={cn(
        "h-full rounded p-2 text-xs flex flex-col justify-start gap-1 border relative"
      )}
      style={{
        backgroundColor: statutColor.bg,
        color: statutColor.text,
        borderLeft: `5px solid ${borderColor}`,
      }}
      data-commande-id={commande.id}
    >
      <PopoverChangementStatut
        commande={commande}
        onSuccess={onSuccess || (() => {})}
        trigger={
          <div className="cursor-pointer min-h-[2.5rem] leading-tight font-semibold">
            {commande.statut === "Validé" && candidatToShow ? (
              <div className="flex flex-col">
                <div className="text-sm font-bold leading-tight whitespace-nowrap">
                  {candidatToShow.nom}
                </div>
                <div className="text-xs font-medium leading-tight whitespace-nowrap">
                  {candidatToShow.prenom}
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="text-sm font-semibold leading-tight whitespace-nowrap">
                  {commande.statut}
                </div>
                <div className="text-xs font-normal min-h-[1.1rem] whitespace-nowrap">
                  &nbsp;
                </div>
              </div>
            )}
          </div>
        }
      />

      <div className="text-[13px] font-semibold mt-1 space-y-1">
        {["matin", ...(isEtages ? [] : ["soir"])].map((creneau) => {
          const heureDebut = commande[`heure_debut_${creneau}` as keyof CommandeWithCandidat] ?? ""
          const heureFin = commande[`heure_fin_${creneau}` as keyof CommandeWithCandidat] ?? ""
          const keyDebut = `${commande.id}-${creneau}-debut`
          const keyFin = `${commande.id}-${creneau}-fin`

          return (
            <div key={creneau} className="flex gap-1 items-center">
              {[{ key: keyDebut, value: heureDebut, champ: `heure_debut_${creneau}` },
                { key: keyFin, value: heureFin, champ: `heure_fin_${creneau}` }
              ].map(({ key, value, champ }) => (
                editId === key ? (
                  <Input
                    key={key}
                    type="time"
                    value={String(heureTemp[key] ?? value).slice(0, 5)}
                    autoFocus
                    onChange={(e) =>
                      setHeureTemp((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    onBlur={async () => {
                      const rawValue = heureTemp[key] ?? ""
                      await updateHeure(commande, champ as keyof CommandeWithCandidat, rawValue)
                      setHeureTemp((prev) => ({ ...prev, [key]: rawValue }))
                      setEditId(null)
                      if (onSuccess) onSuccess()
                    }}
                    className="w-16 text-[13px] px-1 rounded text-black bg-transparent border-none focus:border focus:bg-white"
                  />
                ) : (
                  <span
                    key={key}
                    onClick={() => {
                      setEditId(key)
                      setHeureTemp((prev) => ({ ...prev, [key]: String(value) }))
                    }}
                    className="cursor-pointer hover:underline"
                  >
                    {String(value).slice(0, 5) || "–"}
                  </span>
                )
              ))}
            </div>
          )
        })}
      </div>

      {["En recherche", "Validé"].includes(commande.statut) && (
        <PopoverPlanificationRapide
          commande={commande}
          date={date}
          secteur={secteur}
          onRefresh={onSuccess || (() => {})}
          trigger={
            <button
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-white/60 flex items-center justify-center hover:bg-white/80 transition"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="h-3 w-3 text-gray-400" />
            </button>
          }
          onOpenListes={() => setOpenPlanifDialog(true)}
        />
      )}

      {/* Icône CONTRAT : seulement pour Accroissement ou Remplacement */}
      {showContratIcon && (
        <div className="absolute bottom-2 right-7 z-10">
          <Popover open={openContrat} onOpenChange={(o) => setOpenContrat(o)}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="p-0 h-auto w-auto text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  const initial = normalizeMotif(commande.motif_contrat) || MOTIFS[0]
                  setMotifTemp(initial)
                  setComplementMotifTemp(commande.complement_motif || "")
                }}
                title="Motif contrat"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 space-y-3" align="end">
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-600">Motif contrat</div>
                <Select
                  value={motifTemp || MOTIFS[0]}
                  onValueChange={(v) => setMotifTemp(v)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIFS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-600">Précision</div>
                <Input
                  value={complementMotifTemp}
                  onChange={(e) => setComplementMotifTemp(e.target.value)}
                  placeholder="Ex : nom du remplacé / raison…"
                  className="h-8"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    const updates = {
                      motif_contrat: motifTemp,
                      complement_motif: complementMotifTemp || null,
                    } as const

                    const sb: any = supabase

                    // 1) Récup user (pour historique)
                    const { data: authData } = await sb.auth.getUser()
                    const userEmail = authData?.user?.email || null
                    const { data: userApp } = userEmail
                      ? await sb.from("utilisateurs").select("id").eq("email", userEmail).single()
                      : { data: null as any }
                    const userId = userApp?.id || null

                    // 2) UPDATE EN MASSE sur toute la ligne (client+secteur+mission_slot+service) sur la semaine vue
                    const { start, end } = getWeekBounds(date)
                    let q = sb
                      .from("commandes")
                      .update(updates)
                      .eq("client_id", (commande as any).client_id)
                      .eq("secteur", (commande as any).secteur)
                      .eq("mission_slot", (commande as any).mission_slot ?? missionSlot)
                      .gte("date", start)
                      .lte("date", end)

                    const serviceValue = (commande as any).service ?? service ?? null
                    if (serviceValue === null) {
                      q = q.is("service", null)
                    } else {
                      q = q.eq("service", serviceValue)
                    }

                    const { error } = await q

                    // 3) Historique (une entrée agrégée par ligne)
                    if (!error && userId) {
                      await sb.from("historique").insert({
                        table_cible: "commandes",
                        ligne_id: (commande as any).id, // référence de contexte
                        action: "modification_motif_contrat_ligne",
                        description: "Mise à jour motif contrat sur toute la ligne (semaine courante)",
                        user_id: userId,
                        date_action: new Date().toISOString(),
                        apres: {
                          ...updates,
                          scope: {
                            client_id: (commande as any).client_id,
                            secteur: (commande as any).secteur,
                            mission_slot: (commande as any).mission_slot ?? missionSlot,
                            service: serviceValue,
                            date_from: start,
                            date_to: end,
                          },
                        },
                      })
                    }

                    setOpenContrat(false)
                    if (onSuccess) onSuccess()
                  }}
                  title="Enregistrer"
                >
                  <Check className="w-4 h-4 text-green-600" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

{/* Popover COMMENTAIRE (pencil blanc si vide, pastille rouge pleine “!” si présent) */}
<div className="absolute bottom-2 right-1 z-10">
  <Popover
    open={editingCommentId === commande.id}
    onOpenChange={(open) => !open && setEditingCommentId(null)}
  >
    <PopoverTrigger asChild>
      <Button
        variant="ghost"
        className="p-0 h-auto w-auto text-white"
        onClick={(e) => {
          e.stopPropagation()
          setEditingCommentId(commande.id)
          setCommentaireTemp(commande.commentaire || "")
        }}
        title={hasComment ? "Voir/éditer le commentaire" : "Ajouter un commentaire"}
        aria-label={hasComment ? "Commentaire présent" : "Ajouter un commentaire"}
      >
        {hasComment ? (
          // SVG custom : rond rouge plein + point d’exclamation blanc (sans cercle blanc)
          <svg
            className="h-5 w-5"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="10" fill="#dc2626" />
            {/* barre de l’exclamation */}
            <rect x="9" y="4.5" width="2" height="8" rx="1" fill="#ffffff" />
            {/* point de l’exclamation */}
            <circle cx="10" cy="14.5" r="1.2" fill="#ffffff" />
          </svg>
        ) : (
          <Pencil className="h-4 w-4" />
        )}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-64 p-2 space-y-2" align="end">
      <textarea
        value={commentaireTemp}
        onChange={(e) => setCommentaireTemp(e.target.value)}
        rows={4}
        className="w-full border rounded px-2 py-1 text-sm"
      />
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            await updateHeure(commande, "commentaire", commentaireTemp as any)
            setEditingCommentId(null)
            if (onSuccess) onSuccess()
          }}
          title="Enregistrer"
          aria-label="Enregistrer le commentaire"
        >
          <Check className="w-4 h-4 text-green-600" />
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</div>


      <PlanificationCandidatDialog
        open={openPlanifDialog}
        onClose={() => setOpenPlanifDialog(false)}
        date={date}
        secteur={secteur}
        service={service || ""}
        onSuccess={onSuccess || (() => {})}
        commande={commande}
      />
    </div>
  )
}
