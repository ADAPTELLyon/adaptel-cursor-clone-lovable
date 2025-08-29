import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import type { CandidatDispoWithNom } from "@/types/types-front"
import { format, startOfWeek, endOfWeek, addDays } from "date-fns"
import { fr } from "date-fns/locale"

type Statut = "Dispo" | "Non Dispo" | "Non Renseigné"

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
  onSaved?: (d: { statut: Statut; matin: boolean | null; soir: boolean | null; commentaire?: string } | null) => void
}

type Tri = Statut

type DispoInsert = {
  candidat_id: string
  date: string
  secteur: string
  service?: string | null
  statut?: string | null
  commentaire?: string | null
  dispo_matin?: boolean | null
  dispo_soir?: boolean | null
  dispo_nuit?: boolean | null
}

const isEtagesSecteur = (s?: string | null) =>
  !!(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .includes("etages")

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
  const isEtages = isEtagesSecteur(secteur)

  const [modeJournee, setModeJournee] = useState<boolean>(false)
  const [journee, setJournee] = useState<Tri>("Non Renseigné")
  const [matin, setMatin] = useState<Tri>("Non Renseigné")
  const [soir, setSoir] = useState<Tri>("Non Renseigné")
  const [applyWeek, setApplyWeek] = useState<boolean>(false)
  const [commentaire, setCommentaire] = useState<string>("")

  const dateAffichee = useMemo(
    () => format(new Date(date), "EEEE d MMMM", { locale: fr }),
    [date]
  )

  const triFromBool = (v: boolean | null | undefined): Tri =>
    v === true ? "Dispo" : v === false ? "Non Dispo" : "Non Renseigné"

  const initFromRow = (row?: {
    statut?: Statut | null
    dispo_matin?: boolean | null
    dispo_soir?: boolean | null
    commentaire?: string | null
  }) => {
    const dStatut: Statut = (row?.statut as Statut) || "Non Renseigné"
    const dMatin = row?.dispo_matin ?? disponibilite?.matin ?? null
    const dSoir = isEtages ? null : (row?.dispo_soir ?? disponibilite?.soir ?? null)
    setCommentaire((row?.commentaire ?? disponibilite?.commentaire) || "")

    if (isEtages) {
      setModeJournee(false)
      setJournee("Non Renseigné")
      setMatin(triFromBool(dMatin))
      setSoir("Non Renseigné")
      return
    }

    if (dStatut === "Non Dispo" || (dMatin === false && dSoir === false)) {
      setModeJournee(true)
      setJournee("Non Dispo")
      setMatin("Non Dispo")
      setSoir("Non Dispo")
      return
    }
    if (dMatin === true && dSoir === true) {
      setModeJournee(true)
      setJournee("Dispo")
      setMatin("Dispo")
      setSoir("Dispo")
      return
    }

    setModeJournee(false)
    setMatin(triFromBool(dMatin))
    setSoir(triFromBool(dSoir))
  }

  useEffect(() => {
    if (!open) return
    initFromRow()
    ;(async () => {
      const { data } = await supabase
        .from("disponibilites")
        .select("statut, dispo_matin, dispo_soir, commentaire")
        .eq("candidat_id", candidatId)
        .eq("date", date)
        .eq("secteur", secteur)
        .maybeSingle()
      if (data) initFromRow(data as any)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidatId, date, secteur])

  const selectJournee = (s: Tri) => {
    setModeJournee(true)
    setJournee(s)
    if (s === "Dispo") { setMatin("Dispo"); setSoir("Dispo") }
    else if (s === "Non Dispo") { setMatin("Non Dispo"); setSoir("Non Dispo") }
    else { setMatin("Non Renseigné"); setSoir("Non Renseigné") }
  }
  const selectMatin = (s: Tri) => { setModeJournee(false); setJournee("Non Renseigné"); setMatin(s) }
  const selectSoir  = (s: Tri)  => { setModeJournee(false); setJournee("Non Renseigné"); setSoir(s) }

  const triToBool = (t: Tri): boolean | null =>
    t === "Dispo" ? true : t === "Non Dispo" ? false : null

  type Built = { statut: Statut; matin: boolean | null; soir: boolean | null; commentaire: string | null }

  const buildForSave = (): Built => {
    if (isEtages) {
      const m = triToBool(matin)
      let statut: Statut = "Non Renseigné"
      if (m === true) statut = "Dispo"
      else if (m === false) statut = "Non Dispo"
      return { statut, matin: m, soir: null, commentaire: commentaire || null }
    }
    if (modeJournee) {
      if (journee === "Dispo")     return { statut: "Dispo",       matin: true,  soir: true,  commentaire: commentaire || null }
      if (journee === "Non Dispo") return { statut: "Non Dispo",   matin: false, soir: false, commentaire: commentaire || null }
      return { statut: "Non Renseigné", matin: null, soir: null, commentaire: commentaire || null }
    }
    const m = triToBool(matin)
    const s = triToBool(soir)
    let statut: Statut = "Non Renseigné"
    if (m === true || s === true) statut = "Dispo"
    else if (m === false && s === false) statut = "Non Dispo"
    return { statut, matin: m, soir: s, commentaire: commentaire || null }
  }

  const upsertOne = async (dateISO: string, built: Built) => {
    const allNull =
      built.statut === "Non Renseigné" &&
      built.matin === null &&
      (isEtages ? true : built.soir === null)

    const { data: existing } = await supabase
      .from("disponibilites")
      .select("id")
      .eq("candidat_id", candidatId)
      .eq("date", dateISO)
      .eq("secteur", secteur)
      .limit(1)
      .maybeSingle()

    if (allNull) {
      if (existing?.id) await supabase.from("disponibilites").delete().eq("id", existing.id)
      return
    }

    const payload: DispoInsert = {
      candidat_id: candidatId,
      date: dateISO,
      secteur,
      service: service || null,
      statut: built.statut,
      commentaire: built.commentaire,
      dispo_matin: built.matin,
      dispo_soir: isEtages ? null : built.soir,
      dispo_nuit: null,
    }

    if (existing?.id) {
      await supabase.from("disponibilites").update(payload).eq("id", existing.id)
    } else {
      await supabase.from("disponibilites").insert([payload])
    }
  }

  const handleSave = async () => {
    try {
      const built = buildForSave()

      if (!applyWeek) {
        await upsertOne(date, built)
      } else {
        const monday = startOfWeek(new Date(date), { weekStartsOn: 1 })
        const sunday = endOfWeek(new Date(date), { weekStartsOn: 1 })
        for (let d = new Date(monday); d <= sunday; d = addDays(d, 1)) {
          await upsertOne(format(d, "yyyy-MM-dd"), built)
          try {
            window.dispatchEvent(new CustomEvent("dispos:updated", {
              detail: { candidatId, date: format(d, "yyyy-MM-dd") }
            }))
          } catch {}
        }
      }

      toast({ title: "Disponibilité enregistrée" })
      try {
        window.dispatchEvent(new CustomEvent("dispos:updated", { detail: { candidatId, date } }))
        window.dispatchEvent(new CustomEvent("adaptel:refresh-planning-candidat", { detail: { candidatId, date, secteur } }))
        window.dispatchEvent(new CustomEvent("dispos:updated", { detail: {} as any }))
      } catch {}

      onSaved?.({
        statut: built.statut,
        matin: built.matin,
        soir: built.soir,
        commentaire: built.commentaire || undefined,
      })
      onSuccess?.()
      onClose()
    } catch (e) {
      console.error(e)
      toast({ title: "Erreur", description: "Échec enregistrement", variant: "destructive" })
    }
  }

  const Btn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <Button
      type="button"
      onClick={onClick}
      variant={active ? "default" : "outline"}
      className={active ? "w-full py-2 text-sm bg-[#840404] hover:bg-[#840404]/90 text-white" : "w-full py-2 text-sm"}
    >
      {children}
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl w-[720px]">
        <DialogHeader>
          <DialogTitle className="text-[16px]">
            Saisie disponibilités — {candidatNomPrenom} — {dateAffichee}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-1">
          {!isEtages && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Journée complète</Label>
              <div className="grid grid-cols-3 gap-2">
                <Btn active={modeJournee && journee === "Dispo"} onClick={() => selectJournee("Dispo")}>Dispo</Btn>
                <Btn active={modeJournee && journee === "Non Dispo"} onClick={() => selectJournee("Non Dispo")}>Non Dispo</Btn>
                <Btn active={modeJournee && journee === "Non Renseigné"} onClick={() => selectJournee("Non Renseigné")}>Non renseigné</Btn>
              </div>
            </div>
          )}

          {!isEtages && (
            <div className="flex items-center gap-3">
              <div className="h-px bg-gray-200 flex-1" />
              <div className="text-[12px] text-gray-500 uppercase tracking-wide">ou</div>
              <div className="h-px bg-gray-200 flex-1" />
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">{isEtages ? "Créneau" : "Créneaux"}</Label>

              <div className="mt-2 grid grid-cols-[140px_1fr] items-center gap-3">
                <div className="text-[13px] text-gray-700">Matin / Midi</div>
                <div className="grid grid-cols-3 gap-2">
                  <Btn active={(!isEtages && !modeJournee && matin === "Dispo") || (isEtages && matin === "Dispo")} onClick={() => selectMatin("Dispo")}>Dispo</Btn>
                  <Btn active={(!isEtages && !modeJournee && matin === "Non Dispo") || (isEtages && matin === "Non Dispo")} onClick={() => selectMatin("Non Dispo")}>Non Dispo</Btn>
                  <Btn active={(!isEtages && !modeJournee && matin === "Non Renseigné") || (isEtages && matin === "Non Renseigné")} onClick={() => selectMatin("Non Renseigné")}>Non renseigné</Btn>
                </div>
              </div>

              {!isEtages && (
                <div className="mt-3 grid grid-cols-[140px_1fr] items-center gap-3">
                  <div className="text-[13px] text-gray-700">Soir</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Btn active={!modeJournee && soir === "Dispo"} onClick={() => selectSoir("Dispo")}>Dispo</Btn>
                    <Btn active={!modeJournee && soir === "Non Dispo"} onClick={() => selectSoir("Non Dispo")}>Non Dispo</Btn>
                    <Btn active={!modeJournee && soir === "Non Renseigné"} onClick={() => selectSoir("Non Renseigné")}>Non renseigné</Btn>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Switch checked={applyWeek} onCheckedChange={setApplyWeek} />
            <span className="text-sm select-none">Appliquer le même statut à toute la semaine</span>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Commentaire</Label>
            <Textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Commentaire (optionnel)"
              rows={3}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="button" className="bg-[#840404] text-white hover:bg-[#750303]" onClick={handleSave}>
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CandidateJourneeDialog
