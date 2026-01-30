import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Loader2, Send, X, MessageSquare } from "lucide-react"
import { buildPlanningCandidatEmail, type PlanningCandidatItem } from "@/lib/email/buildPlanningCandidatEmail"
import { format, addDays } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"

type EmailPreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTo: string
  initialSubject: string
  candidatNom: string
  weekNumber: number
  onSent?: () => void

  mondayISO?: string
  items?: PlanningCandidatItem[]
  prenom?: string
}

type EditableItem = PlanningCandidatItem & {
  commentaire?: string
}

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function fmtDayTitle(date: Date) {
  return cap(format(date, "EEEE d MMMM", { locale: fr }))
}

function formatTimeInput(value: string | null | undefined): string {
  if (!value) return ""
  return value.split(":").slice(0, 2).join(":")
}

function joinClientLine(clientNom: string, secteur: string, service?: string | null) {
  const svc = (service || "").trim()
  const sec = (secteur || "").trim().toUpperCase()
  if (!svc) return `${clientNom} - ${sec}`
  return `${clientNom} - ${sec} - ${svc.toUpperCase()}`
}

function InlineInput({
  value,
  onChange,
  placeholder,
  className = "",
  maxLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  maxLength?: number
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={[
        "h-8 px-2 text-[14px] leading-none",
        "bg-gray-100/80 border border-gray-200",
        "hover:bg-gray-100 hover:border-gray-300",
        "focus-visible:bg-white focus-visible:border-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0",
        "rounded-md",
        className,
      ].join(" ")}
    />
  )
}

function InlineTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  minH = "min-h-[40px]",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  minH?: string
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={[
        "text-[14px] leading-snug",
        "bg-gray-100/80 border border-gray-200",
        "hover:bg-gray-100 hover:border-gray-300",
        "focus-visible:bg-white focus-visible:border-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0",
        "rounded-md resize-none",
        minH,
        "py-2 px-2",
        className,
      ].join(" ")}
    />
  )
}

async function getSenderPrenom(): Promise<string> {
  try {
    const { data } = await supabase.auth.getUser()
    const email = data?.user?.email?.trim() || ""
    if (!email) return ""

    const { data: u, error } = await supabase
      .from("utilisateurs")
      .select("prenom")
      .eq("email", email)
      .maybeSingle()

    if (!error && u?.prenom) return String(u.prenom).trim()

    // fallback propre : avant @
    const fallback = email.split("@")[0] || ""
    return fallback ? fallback.charAt(0).toUpperCase() + fallback.slice(1) : ""
  } catch {
    return ""
  }
}

export default function EmailPreviewDialog({
  open,
  onOpenChange,
  initialTo,
  initialSubject,
  candidatNom,
  weekNumber,
  onSent,
  mondayISO,
  items = [],
  prenom = "",
}: EmailPreviewDialogProps) {
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [generalComment, setGeneralComment] = useState("")
  const [editableItems, setEditableItems] = useState<EditableItem[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [senderPrenom, setSenderPrenom] = useState("")

  const canSend = useMemo(() => !!to.trim() && !!subject.trim(), [to, subject])

  const itemsByDate = useMemo(() => {
    const map = new Map<string, EditableItem[]>()

    editableItems.forEach((item) => {
      const date = item.dateISO
      if (!map.has(date)) map.set(date, [])
      map.get(date)!.push(item)
    })

    map.forEach((arr) => {
      arr.sort((a, b) => {
        const timeA = a.heure_debut_matin || a.heure_debut_soir || a.heure_debut_nuit || "99:99"
        const timeB = b.heure_debut_matin || b.heure_debut_soir || b.heure_debut_nuit || "99:99"
        return timeA.localeCompare(timeB)
      })
    })

    return map
  }, [editableItems])

  const weekDays = useMemo(() => {
    if (!mondayISO) return []
    const monday = new Date(`${mondayISO}T00:00:00`)
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i)
      return {
        date,
        dateISO: format(date, "yyyy-MM-dd"),
        dayTitle: fmtDayTitle(date),
      }
    })
  }, [mondayISO])

  useEffect(() => {
    if (!open) return

    setTo(initialTo || "")
    setSubject(initialSubject || `Votre planning ADAPTEL Lyon - Semaine ${weekNumber}`)
    setGeneralComment("")
    setError(null)
    setSuccess(false)
    setSending(false)

    ;(async () => {
      const sp = await getSenderPrenom()
      setSenderPrenom(sp)
    })()

    if (items && mondayISO) {
      const initialEditableItems: EditableItem[] = items.map((item) => ({
        ...item,
        commentaire: item.commentaire || "",
        heure_debut_matin: formatTimeInput(item.heure_debut_matin),
        heure_fin_matin: formatTimeInput(item.heure_fin_matin),
        heure_debut_soir: formatTimeInput(item.heure_debut_soir),
        heure_fin_soir: formatTimeInput(item.heure_fin_soir),
        heure_debut_nuit: formatTimeInput(item.heure_debut_nuit),
        heure_fin_nuit: formatTimeInput(item.heure_fin_nuit),
      }))
      setEditableItems(initialEditableItems)
    } else {
      setEditableItems([])
    }
  }, [open, initialTo, initialSubject, weekNumber, items, mondayISO])

  const updateItem = (index: number, updates: Partial<EditableItem>) => {
    setEditableItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  const handleClose = () => onOpenChange(false)

  const handleSend = async () => {
    setError(null)
    setSuccess(false)

    if (!canSend) {
      setError("Veuillez renseigner l'email et l'objet.")
      return
    }
    if (!mondayISO) {
      setError("Données de planning manquantes.")
      return
    }

    setSending(true)
    try {
      const finalItems: PlanningCandidatItem[] = editableItems.map((item) => ({
        dateISO: item.dateISO,
        clientNom: item.clientNom,
        secteur: item.secteur,
        service: item.service,
        heure_debut_matin: item.heure_debut_matin,
        heure_fin_matin: item.heure_fin_matin,
        heure_debut_soir: item.heure_debut_soir,
        heure_fin_soir: item.heure_fin_soir,
        heure_debut_nuit: item.heure_debut_nuit,
        heure_fin_nuit: item.heure_fin_nuit,
        pause: item.pause,
        adresse: item.adresse,
        code_postal: item.code_postal,
        ville: item.ville,
        telephone: item.telephone,
        commentaire: item.commentaire,
      }))

      const { body: html } = buildPlanningCandidatEmail({
        prenom: prenom || "Bonjour",
        weekNumber,
        mondayISO,
        items: finalItems,
        customMessage: generalComment.trim(),
        senderPrenom: senderPrenom || "",
      })

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          html,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Erreur lors de l'envoi")

      setSuccess(true)
      onSent?.()
      setTimeout(() => onOpenChange(false), 900)
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'envoi")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] max-w-[900px] h-[88vh] max-h-[88vh] p-0 overflow-hidden bg-white">
        <div className="h-full grid grid-rows-[1fr_auto] overflow-hidden">
          {/* ZONE SCROLLABLE UNIQUE */}
          <div className="min-h-0 overflow-auto">
            <div className="p-6">
              {/* Bandeau titre */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#8a0000] flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Envoi planning candidat
                  </DialogTitle>
                  <div className="text-[#8a0000] font-semibold truncate">{candidatNom}</div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Bloc mail */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-[12px] font-medium text-gray-600">Destinataire</div>
                    <Input
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="email@exemple.com"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[12px] font-medium text-gray-600">Objet</div>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-1">
                  <div className="text-[12px] font-medium text-gray-600">Commentaire</div>
                  <Textarea
                    value={generalComment}
                    onChange={(e) => setGeneralComment(e.target.value)}
                    className="min-h-[90px] text-sm resize-none"
                    placeholder=""
                  />
                  <div className="text-[12px] text-gray-500 italic">
                    Taper votre texte pour ajouter un message
                  </div>
                </div>
              </div>

              {/* Contenu du mail */}
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/40">
                <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-xl">
                  <div className="text-[14px] font-semibold text-gray-900">
                    Contenu du mail — Semaine {weekNumber}
                  </div>
                </div>

                <div className="p-4">
                  <div className="space-y-4">
                    {weekDays.map((day) => {
                      const dayItems = itemsByDate.get(day.dateISO) || []
                      const hasMissions = dayItems.length > 0

                      return (
                        <div
                          key={day.dateISO}
                          className="rounded-lg border border-gray-200 bg-white overflow-hidden"
                        >
                          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                            <div className="text-[14px] font-semibold text-gray-900">{day.dayTitle}</div>
                            <div className="text-[12px] text-gray-500">
                              {hasMissions ? `${dayItems.length} mission${dayItems.length > 1 ? "s" : ""}` : "Pas de mission"}
                            </div>
                          </div>

                          <div className="p-4">
                            {!hasMissions ? (
                              <div className="text-[14px] text-gray-500">Pas de mission</div>
                            ) : (
                              <div className="space-y-3">
                                {dayItems.map((item, itemIndex) => {
                                  const globalIndex = editableItems.findIndex(
                                    (i) =>
                                      i.dateISO === day.dateISO &&
                                      i.clientNom === item.clientNom &&
                                      i.secteur === item.secteur &&
                                      (i.service || "") === (item.service || "")
                                  )
                                  if (globalIndex === -1) return null

                                  const clientLine = joinClientLine(item.clientNom || "", item.secteur || "", item.service)

                                  const hasMatin = !!(item.heure_debut_matin || item.heure_fin_matin)
                                  const hasSoir = !!(item.heure_debut_soir || item.heure_fin_soir)
                                  const hasNuit = !!(item.heure_debut_nuit || item.heure_fin_nuit)

                                  return (
                                    <div key={`${day.dateISO}-${itemIndex}-${clientLine}`} className="space-y-2">
                                      <div className="text-[15px] font-semibold text-gray-900">{clientLine}</div>

                                      <div className="flex flex-wrap items-center gap-3 text-[14px] text-gray-700">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-gray-800">Horaires</span>

                                          {hasMatin && (
                                            <span className="inline-flex items-center gap-1">
                                              <InlineInput
                                                value={item.heure_debut_matin || ""}
                                                onChange={(v) => updateItem(globalIndex, { heure_debut_matin: v })}
                                                placeholder="09:00"
                                                className="w-[78px] text-center"
                                                maxLength={5}
                                              />
                                              <span className="text-gray-400">-</span>
                                              <InlineInput
                                                value={item.heure_fin_matin || ""}
                                                onChange={(v) => updateItem(globalIndex, { heure_fin_matin: v })}
                                                placeholder="13:00"
                                                className="w-[78px] text-center"
                                                maxLength={5}
                                              />
                                            </span>
                                          )}

                                          {hasSoir && (
                                            <span className="inline-flex items-center gap-1">
                                              <span className="text-gray-400">/</span>
                                              <InlineInput
                                                value={item.heure_debut_soir || ""}
                                                onChange={(v) => updateItem(globalIndex, { heure_debut_soir: v })}
                                                placeholder="18:00"
                                                className="w-[78px] text-center"
                                                maxLength={5}
                                              />
                                              <span className="text-gray-400">-</span>
                                              <InlineInput
                                                value={item.heure_fin_soir || ""}
                                                onChange={(v) => updateItem(globalIndex, { heure_fin_soir: v })}
                                                placeholder="23:00"
                                                className="w-[78px] text-center"
                                                maxLength={5}
                                              />
                                            </span>
                                          )}

                                          {hasNuit && (
                                            <span className="inline-flex items-center gap-1">
                                              <span className="text-gray-400">/</span>
                                              <InlineInput
                                                value={item.heure_debut_nuit || ""}
                                                onChange={(v) => updateItem(globalIndex, { heure_debut_nuit: v })}
                                                placeholder="23:00"
                                                className="w-[78px] text-center"
                                                maxLength={5}
                                              />
                                              <span className="text-gray-400">-</span>
                                              <InlineInput
                                                value={item.heure_fin_nuit || ""}
                                                onChange={(v) => updateItem(globalIndex, { heure_fin_nuit: v })}
                                                placeholder="07:00"
                                                className="w-[78px] text-center"
                                                maxLength={5}
                                              />
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-gray-800">Pause</span>
                                          <InlineInput
                                            value={item.pause || ""}
                                            onChange={(v) => updateItem(globalIndex, { pause: v })}
                                            placeholder="ex: 30 min"
                                            className="w-[140px]"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2 text-[14px] text-gray-700">
                                        <span className="font-semibold text-gray-800">Adresse</span>
                                        <InlineInput
                                          value={item.adresse || ""}
                                          onChange={(v) => updateItem(globalIndex, { adresse: v })}
                                          placeholder="Rue / numéro"
                                          className="w-[380px]"
                                        />
                                        <InlineInput
                                          value={item.code_postal || ""}
                                          onChange={(v) => updateItem(globalIndex, { code_postal: v })}
                                          placeholder="CP"
                                          className="w-[80px]"
                                          maxLength={5}
                                        />
                                        <InlineInput
                                          value={item.ville || ""}
                                          onChange={(v) => updateItem(globalIndex, { ville: v })}
                                          placeholder="Ville"
                                          className="w-[190px]"
                                        />
                                      </div>

                                      <div className="flex items-start gap-2 text-[14px] text-gray-700">
                                        <span className="font-semibold text-gray-800 mt-[6px]">Commentaire</span>
                                        <div className="flex-1">
                                          <InlineTextarea
                                            value={item.commentaire || ""}
                                            onChange={(v) => updateItem(globalIndex, { commentaire: v })}
                                            placeholder="Ajouter une information"
                                            minH="min-h-[44px]"
                                          />
                                        </div>
                                      </div>

                                      {itemIndex < dayItems.length - 1 && <Separator className="opacity-60" />}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="h-4" />
            </div>
          </div>

          {/* FOOTER FIXE */}
          <div className="px-6 py-4 border-t border-gray-200 bg-white">
            {(error || success) && (
              <div className="mb-3">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
                {success && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700">✅ Email envoyé avec succès</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose} disabled={sending} className="h-9 px-5 text-sm">
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>

              <Button
                onClick={handleSend}
                disabled={!canSend || sending}
                className="h-9 px-5 text-sm bg-[#8a0000] hover:bg-[#7a0000]"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
