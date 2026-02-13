import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Loader2,
  Send,
  X,
  MessageSquare,
  Building2,
  Clock,
  Coffee,
  UtensilsCrossed,
  MapPin,
  Route,
  Shirt,
  PhoneCall,
  MessageCircle,
} from "lucide-react"
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
  repas_fournis?: boolean | null
  tenue_description?: string | null
  itineraire?: string | null

  // ✅ TCL
  client_id?: string | null
  itinerary_url?: string | null
}

type ClientAccesTCRow = {
  client_id: string
  stops: any
  itinerary_url: string | null
}

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function fmtDayTitle(date: Date) {
  return cap(format(date, "EEEE d MMMM", { locale: fr }))
}

function formatTimeInput(value: string | null | undefined): string {
  if (!value) return ""
  return String(value).split(":").slice(0, 2).join(":")
}

function normalizePauseToHHMM(raw: any): string {
  if (!raw) return ""
  const s = String(raw)
  const parts = s.split(":")
  if (parts.length < 2) return ""
  const hh = String(parts[0]).padStart(2, "0")
  const mm = String(parts[1]).padStart(2, "0")
  return `${hh}:${mm}`
}

/** 0700 -> 07:00 ; 7:0 -> 07:00 ; 07:00 ok */
function normalizeHHMMLoose(input: string): string {
  const s = (input || "").trim()
  if (!s) return ""

  const only = s.replace(/[^\d:]/g, "")
  const digits = only.replace(/:/g, "")

  // si déjà au format HH:MM propre
  if (/^\d{2}:\d{2}$/.test(only)) return only

  // 3-4 digits => HHMM
  if (/^\d{3,4}$/.test(digits)) {
    const d = digits.padStart(4, "0")
    const hh = d.slice(0, 2)
    const mm = d.slice(2, 4)
    return `${hh}:${mm}`
  }

  // formats type H:M ou HH:M ou H:MM
  const m = only.match(/^(\d{1,2}):(\d{1,2})$/)
  if (m) {
    const hh = String(m[1]).padStart(2, "0")
    const mm = String(m[2]).padStart(2, "0")
    return `${hh}:${mm}`
  }

  // sinon on garde "soft" mais propre (max 5)
  return only.slice(0, 5)
}

/** Filtre de saisie temps : chiffres + ":" uniquement, longueur 5 max */
function sanitizeTimeKeystroke(v: string): string {
  const out = (v || "").replace(/[^\d:]/g, "")
  return out.slice(0, 5)
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

    const fallback = email.split("@")[0] || ""
    return fallback ? fallback.charAt(0).toUpperCase() + fallback.slice(1) : ""
  } catch {
    return ""
  }
}

/** ✅ Construit un texte "Accès TCL" simple à partir de stops */
function buildAccesTcText(stops: any): string {
  if (!Array.isArray(stops) || stops.length === 0) return ""

  const s0 = stops[0] || {}
  const stopName = String(s0.stop_name || "").trim()
  const routes = Array.isArray(s0.routes) ? s0.routes : []

  const rank = (t: any) => {
    const type = Number(t)
    if (type === 1) return 0 // Métro
    if (type === 0) return 1 // Tram
    if (type === 3 || type === 11) return 2 // Bus
    return 9
  }

  const picked = [...routes]
    .sort((a, b) => rank(a?.type) - rank(b?.type))
    .slice(0, 3)
    .map((r) => {
      const type = Number(r?.type)
      const short = String(r?.short || "").trim()
      if (!short) return ""
      if (type === 1) return `Métro ${short}`
      if (type === 0) return `Tram ${short}`
      if (type === 3 || type === 11) return `Bus ${short}`
      return short
    })
    .filter(Boolean)

  if (!stopName && !picked.length) return ""
  if (!picked.length) return stopName
  return `${stopName} — ${picked.join(" • ")}`
}

/** Tag secteur/service plus gros */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[13px] font-semibold text-gray-900">
      {children}
    </span>
  )
}

/** Titre de bloc : pro, pas “bourrin” */
function FieldTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-700">
      <Icon className="h-4 w-4 text-[#8a0000]" />
      <span>{title}</span>
    </div>
  )
}

/** Input “valeur” : si vide => affichage Non précisé en overlay (sans polluer la valeur) */
function InlineInputSmart({
  value,
  onChange,
  emptyLabel = "Non précisé",
  className = "",
  maxLength,
  inputMode,
  textCenter = false,
  onBlur,
}: {
  value: string
  onChange: (v: string) => void
  emptyLabel?: string
  className?: string
  maxLength?: number
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  textCenter?: boolean
  onBlur?: () => void
}) {
  const showEmpty = !value?.trim()
  return (
    <div className={["relative", className].join(" ")}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        maxLength={maxLength}
        inputMode={inputMode}
        className={[
          "h-10 px-3 text-[14px]",
          "bg-gray-50 border border-gray-200",
          "hover:bg-white hover:border-gray-300",
          "focus-visible:bg-white focus-visible:border-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0",
          "rounded-xl",
          textCenter ? "text-center tabular-nums" : "",
        ].join(" ")}
      />
      {showEmpty && (
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[14px] text-gray-400">
          {emptyLabel}
        </div>
      )}
    </div>
  )
}

function InlineTextareaSmart({
  value,
  onChange,
  emptyLabel = "Non précisé",
  minH = "min-h-[60px]",
  className = "",
}: {
  value: string
  onChange: (v: string) => void
  emptyLabel?: string
  minH?: string
  className?: string
}) {
  const showEmpty = !value?.trim()
  return (
    <div className={["relative", className].join(" ")}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "text-[14px] leading-snug",
          "bg-gray-50 border border-gray-200",
          "hover:bg-white hover:border-gray-300",
          "focus-visible:bg-white focus-visible:border-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0",
          "rounded-xl resize-none",
          minH,
          "py-2 px-3",
        ].join(" ")}
      />
      {showEmpty && (
        <div className="pointer-events-none absolute left-3 top-2 text-[14px] text-gray-400">
          {emptyLabel}
        </div>
      )}
    </div>
  )
}

/** Repas : 3 boutons blancs + contour ; sélection = fond marque + texte blanc */
function SegmentedTriStateBrand({
  value,
  onChange,
}: {
  value: boolean | null
  onChange: (v: boolean | null) => void
}) {
  const base = "h-10 flex-1 rounded-xl text-[13px] font-semibold border transition-colors px-3 text-center"

  const mk = (label: string, active: boolean, onClick: () => void) => {
    const cls = active
      ? "bg-[#8a0000] text-white border-[#8a0000]"
      : "bg-white text-[#8a0000] border-[#8a0000]/25 hover:border-[#8a0000]/45 hover:bg-[#8a0000]/5"
    return (
      <button type="button" className={`${base} ${cls}`} onClick={onClick}>
        {label}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 w-full">
      {mk("Oui", value === true, () => onChange(true))}
      {mk("Non", value === false, () => onChange(false))}
      {mk("Non précisé", value === null, () => onChange(null))}
    </div>
  )
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
        return String(timeA).localeCompare(String(timeB))
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
      let initialEditableItems: EditableItem[] = (items as any[]).map((item: any) => ({
        ...item,
        commentaire: item.commentaire || "",
        heure_debut_matin: formatTimeInput(item.heure_debut_matin),
        heure_fin_matin: formatTimeInput(item.heure_fin_matin),
        heure_debut_soir: formatTimeInput(item.heure_debut_soir),
        heure_fin_soir: formatTimeInput(item.heure_fin_soir),
        heure_debut_nuit: formatTimeInput(item.heure_debut_nuit),
        heure_fin_nuit: formatTimeInput(item.heure_fin_nuit),

        pause: normalizePauseToHHMM(item.pause),
        repas_fournis: typeof item.repas_fournis === "boolean" ? item.repas_fournis : null,
        tenue_description: (item.tenue_description || "").trim(),
        itineraire: (item.itineraire || "").trim(),

        // ✅ pour cache TCL
        client_id: (item.client_id || item.clientId || item.clientID || null) as any,
        itinerary_url: (item.itinerary_url || item.itineraryUrl || null) as any,
      }))

      setEditableItems(initialEditableItems)

      // ✅ Ajout TCL : enrichit itineraire + itinerary_url depuis clients_acces_tc
      ;(async () => {
        try {
          const clientIds = Array.from(
            new Set(
              initialEditableItems
                .map((it: any) => it?.client_id)
                .filter((v: any) => !!v)
                .map((v: any) => String(v))
            )
          )

          if (!clientIds.length) return

          // ✅ cast any pour bypass types TS (table non dans Database types)
          const sb: any = supabase as any

          const { data } = await sb
            .from("clients_acces_tc")
            .select("client_id, stops, itinerary_url")
            .in("client_id", clientIds)

          if (!Array.isArray(data)) return

          const map = new Map<string, ClientAccesTCRow>()
          data.forEach((row: ClientAccesTCRow) => {
            if (!row?.client_id) return
            map.set(String(row.client_id), row)
          })

          setEditableItems((prev) =>
            prev.map((it) => {
              const cid = it?.client_id ? String(it.client_id) : ""
              if (!cid) return it

              const row = map.get(cid)
              if (!row) return it

              const tclText = buildAccesTcText(row.stops)
              const current = String((it as any).itineraire || "").trim()

              return {
                ...it,
                // si l'user a déjà rempli un texte => on ne l'écrase pas
                itineraire: current ? current : tclText,
                itinerary_url: (it as any).itinerary_url ?? row.itinerary_url ?? null,
              }
            })
          )
        } catch {
          // silent: non bloquant
        }
      })()
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

        repas_fournis: (item as any).repas_fournis,
        tenue_description: (item as any).tenue_description,
        itineraire: (item as any).itineraire,
        itinerary_url: (item as any).itinerary_url,
      } as any))

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
      <DialogContent className="w-[920px] max-w-[920px] h-[88vh] max-h-[88vh] p-0 overflow-hidden bg-white">
        <div className="h-full grid grid-rows-[1fr_auto] overflow-hidden">
          <div className="min-h-0 overflow-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#8a0000] flex items-center justify-center shadow-sm">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-extrabold text-gray-900">Envoi planning candidat</DialogTitle>
                  <div className="text-[#8a0000] font-semibold truncate">{candidatNom}</div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Bloc mail */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-[12px] font-semibold text-gray-600">Destinataire</div>
                    <Input value={to} onChange={(e) => setTo(e.target.value)} className="h-10 text-sm rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[12px] font-semibold text-gray-600">Objet</div>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-1">
                  <div className="text-[12px] font-semibold text-gray-600">Message</div>
                  <Textarea
                    value={generalComment}
                    onChange={(e) => setGeneralComment(e.target.value)}
                    className="min-h-[96px] text-sm resize-none rounded-xl"
                  />
                </div>
              </div>

              {/* Contenu */}
              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 bg-white">
                  <div className="text-[14px] font-extrabold text-gray-900">Contrôle avant envoi — Semaine {weekNumber}</div>
                </div>

                <div className="p-5 space-y-4">
                  {weekDays.map((day) => {
                    const dayItems = itemsByDate.get(day.dateISO) || []
                    const hasMissions = dayItems.length > 0

                    return (
                      <div key={day.dateISO} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                        {/* Bandeau jour */}
                        <div className="px-5 py-3 bg-[#8a0000] text-white flex items-center justify-between">
                          <div className="font-extrabold text-[14px]">{day.dayTitle}</div>
                          <div className="text-[12px] font-semibold opacity-90">
                            {hasMissions ? `${dayItems.length} mission${dayItems.length > 1 ? "s" : ""}` : "Aucune mission"}
                          </div>
                        </div>

                        <div className="p-5">
                          {!hasMissions ? (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-600 italic">
                              Aucune mission programmée
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {dayItems.map((item, itemIndex) => {
                                const globalIndex = editableItems.findIndex(
                                  (i) =>
                                    i.dateISO === day.dateISO &&
                                    i.clientNom === item.clientNom &&
                                    i.secteur === item.secteur &&
                                    (i.service || "") === (item.service || "")
                                )
                                if (globalIndex === -1) return null

                                const etab = (item.clientNom || "").trim() || "Établissement"
                                const secteur = (item.secteur || "").trim()
                                const service = (item.service || "").trim()

                                const hasMatin = !!(item.heure_debut_matin || item.heure_fin_matin)
                                const hasSoir = !!(item.heure_debut_soir || item.heure_fin_soir)
                                const hasNuit = !!(item.heure_debut_nuit || item.heure_fin_nuit)

                                const onBlurTime = (field: keyof EditableItem) => {
                                  const raw = String((editableItems[globalIndex] as any)?.[field] || "")
                                  const norm = normalizeHHMMLoose(raw)
                                  updateItem(globalIndex, { [field]: norm } as any)
                                }

                                const onChangeTime = (field: keyof EditableItem, v: string) => {
                                  const s = sanitizeTimeKeystroke(v)
                                  // si 4 digits => on format direct
                                  const digits = s.replace(/:/g, "")
                                  if (/^\d{4}$/.test(digits)) {
                                    updateItem(globalIndex, { [field]: normalizeHHMMLoose(digits) } as any)
                                  } else {
                                    updateItem(globalIndex, { [field]: s } as any)
                                  }
                                }

                                return (
                                  <div
                                    key={`${day.dateISO}-${itemIndex}-${etab}-${secteur}-${service}`}
                                    className="rounded-2xl border border-gray-200 bg-white p-5"
                                  >
                                    {/* Ligne établissement + tags */}
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-700">
                                          <Building2 className="h-4 w-4 text-[#8a0000]" />
                                          <span className="text-gray-700">Établissement</span>
                                        </div>
                                        <div className="mt-1 text-[16px] font-extrabold text-gray-900 truncate">{etab}</div>
                                      </div>

                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {secteur ? <Tag>{secteur}</Tag> : <Tag>Non précisé</Tag>}
                                        {/* service uniquement si présent */}
                                        {service ? <Tag>{service}</Tag> : null}
                                      </div>
                                    </div>

                                    <div className="mt-5 space-y-5">
                                      {/* Horaires / Pause / Repas : harmonieux */}
                                      <div className="grid grid-cols-[1.15fr_0.55fr_1fr] gap-4 items-start">
                                        <div className="space-y-2">
                                          <FieldTitle icon={Clock} title="Horaires" />
                                          <div className="flex flex-wrap items-center gap-2">
                                            {hasMatin && (
                                              <div className="flex items-center gap-2">
                                                <InlineInputSmart
                                                  value={String(item.heure_debut_matin || "")}
                                                  onChange={(v) => onChangeTime("heure_debut_matin", v)}
                                                  onBlur={() => onBlurTime("heure_debut_matin")}
                                                  emptyLabel="--:--"
                                                  className="w-[86px]"
                                                  maxLength={5}
                                                  inputMode="numeric"
                                                  textCenter
                                                />
                                                <span className="text-gray-400 font-bold">-</span>
                                                <InlineInputSmart
                                                  value={String(item.heure_fin_matin || "")}
                                                  onChange={(v) => onChangeTime("heure_fin_matin", v)}
                                                  onBlur={() => onBlurTime("heure_fin_matin")}
                                                  emptyLabel="--:--"
                                                  className="w-[86px]"
                                                  maxLength={5}
                                                  inputMode="numeric"
                                                  textCenter
                                                />
                                              </div>
                                            )}

                                            {hasSoir && (
                                              <div className="flex items-center gap-2">
                                                <span className="text-gray-300 font-extrabold">/</span>
                                                <InlineInputSmart
                                                  value={String(item.heure_debut_soir || "")}
                                                  onChange={(v) => onChangeTime("heure_debut_soir", v)}
                                                  onBlur={() => onBlurTime("heure_debut_soir")}
                                                  emptyLabel="--:--"
                                                  className="w-[86px]"
                                                  maxLength={5}
                                                  inputMode="numeric"
                                                  textCenter
                                                />
                                                <span className="text-gray-400 font-bold">-</span>
                                                <InlineInputSmart
                                                  value={String(item.heure_fin_soir || "")}
                                                  onChange={(v) => onChangeTime("heure_fin_soir", v)}
                                                  onBlur={() => onBlurTime("heure_fin_soir")}
                                                  emptyLabel="--:--"
                                                  className="w-[86px]"
                                                  maxLength={5}
                                                  inputMode="numeric"
                                                  textCenter
                                                />
                                              </div>
                                            )}

                                            {hasNuit && (
                                              <div className="flex items-center gap-2">
                                                <span className="text-gray-300 font-extrabold">/</span>
                                                <InlineInputSmart
                                                  value={String(item.heure_debut_nuit || "")}
                                                  onChange={(v) => onChangeTime("heure_debut_nuit", v)}
                                                  onBlur={() => onBlurTime("heure_debut_nuit")}
                                                  emptyLabel="--:--"
                                                  className="w-[86px]"
                                                  maxLength={5}
                                                  inputMode="numeric"
                                                  textCenter
                                                />
                                                <span className="text-gray-400 font-bold">-</span>
                                                <InlineInputSmart
                                                  value={String(item.heure_fin_nuit || "")}
                                                  onChange={(v) => onChangeTime("heure_fin_nuit", v)}
                                                  onBlur={() => onBlurTime("heure_fin_nuit")}
                                                  emptyLabel="--:--"
                                                  className="w-[86px]"
                                                  maxLength={5}
                                                  inputMode="numeric"
                                                  textCenter
                                                />
                                              </div>
                                            )}

                                            {!hasMatin && !hasSoir && !hasNuit && (
                                              <div className="text-sm text-gray-500 italic">Non précisé</div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="space-y-2">
                                          <FieldTitle icon={Coffee} title="Pause" />
                                          <InlineInputSmart
                                            value={String(item.pause || "")}
                                            onChange={(v) => onChangeTime("pause" as any, v)}
                                            onBlur={() => onBlurTime("pause" as any)}
                                            emptyLabel="--:--"
                                            className="w-[110px]"
                                            maxLength={5}
                                            inputMode="numeric"
                                            textCenter
                                          />
                                        </div>

                                        <div className="space-y-2">
                                          <FieldTitle icon={UtensilsCrossed} title="Repas" />
                                          <SegmentedTriStateBrand
                                            value={(item as any).repas_fournis ?? null}
                                            onChange={(v) => updateItem(globalIndex, { repas_fournis: v })}
                                          />
                                        </div>
                                      </div>

                                      {/* Adresse */}
                                      <div className="space-y-2">
                                        <FieldTitle icon={MapPin} title="Adresse" />
                                        <div className="grid grid-cols-[1fr_110px_220px] gap-3">
                                          <InlineInputSmart
                                            value={String(item.adresse || "")}
                                            onChange={(v) => updateItem(globalIndex, { adresse: v })}
                                            emptyLabel="Non précisé"
                                          />
                                          <InlineInputSmart
                                            value={String(item.code_postal || "")}
                                            onChange={(v) => updateItem(globalIndex, { code_postal: v })}
                                            emptyLabel="CP"
                                            maxLength={5}
                                            inputMode="numeric"
                                            textCenter
                                          />
                                          <InlineInputSmart
                                            value={String(item.ville || "")}
                                            onChange={(v) => updateItem(globalIndex, { ville: v })}
                                            emptyLabel="Ville"
                                          />
                                        </div>
                                      </div>

                                      {/* Itinéraire / Accès TCL */}
                                      <div className="space-y-2">
                                        <FieldTitle icon={Route} title="Itinéraire / Accès TCL" />
                                        <InlineTextareaSmart
                                          value={String((item as any).itineraire || "")}
                                          onChange={(v) => updateItem(globalIndex, { itineraire: v })}
                                          emptyLabel="Non précisé (Accès TCL si disponible)"
                                          minH="min-h-[60px]"
                                        />
                                      </div>

                                      {/* Tenue + Contact mêmes hauteurs */}
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <FieldTitle icon={Shirt} title="Tenue" />
                                          <InlineTextareaSmart
                                            value={String((item as any).tenue_description || "")}
                                            onChange={(v) => updateItem(globalIndex, { tenue_description: v })}
                                            emptyLabel="Non précisé"
                                            minH="min-h-[60px]"
                                          />
                                        </div>

                                        <div className="space-y-2">
                                          <FieldTitle icon={PhoneCall} title="Contact" />
                                          {/* textarea pour égaliser la hauteur */}
                                          <InlineTextareaSmart
                                            value={String(item.telephone || "")}
                                            onChange={(v) => updateItem(globalIndex, { telephone: v })}
                                            emptyLabel="Non précisé"
                                            minH="min-h-[60px]"
                                          />
                                        </div>
                                      </div>

                                      {/* Commentaire */}
                                      <div className="space-y-2">
                                        <FieldTitle icon={MessageCircle} title="Commentaire" />
                                        <InlineTextareaSmart
                                          value={String(item.commentaire || "")}
                                          onChange={(v) => updateItem(globalIndex, { commentaire: v })}
                                          emptyLabel="Non précisé"
                                          minH="min-h-[76px]"
                                        />
                                      </div>
                                    </div>
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

              <div className="h-4" />
            </div>
          </div>

          {/* Footer fixe */}
          <div className="px-6 py-4 border-t border-gray-200 bg-white">
            {(error || success) && (
              <div className="mb-3">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-semibold text-red-700">{error}</p>
                  </div>
                )}
                {success && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-sm font-semibold text-green-700">✅ Email envoyé avec succès</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose} disabled={sending} className="h-10 px-5 rounded-xl text-sm">
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>

              <Button
                onClick={handleSend}
                disabled={!canSend || sending}
                className="h-10 px-5 rounded-xl text-sm bg-[#8a0000] hover:bg-[#7a0000]"
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
