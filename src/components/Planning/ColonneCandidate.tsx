import { Clock, Check } from "lucide-react"
import { secteursList } from "@/lib/secteurs"
import { useEffect, useState } from "react"
import FicheMemoCandidat from "@/components/commandes/Fiche-Memo-Candidat"
import { Icon } from "@iconify/react"
import { HistoriqueCandidatDialog } from "@/components/Planning/HistoriqueCandidateDialog"
import { supabase } from "@/lib/supabase"

export interface ColonneCandidateProps {
  nomComplet: string
  secteur: string
  semaine: string
  statutGlobal: string
  candidatId: string
  totalHeures: string
}

/** ----------------------------------------------------------------
 *  Helpers pour corriger/normaliser le total d'heures affiché
 *  - Gère les créneaux qui passent minuit (ex: 18:00 -> 02:00)
 *  - Si totalHeures est déjà un "HH:MM", on le laisse tel quel
 *  - Si totalHeures contient une liste de créneaux (ex: "lun 10:00 18:00 - mar 18:00 02:00"),
 *    on recalcule le total en minutes puis on retourne "HH:MM"
 * ----------------------------------------------------------------*/
function toMinutes(hhmm?: string | null) {
  if (!hhmm) return 0
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return 0
  const h = Number(m[1])
  const mi = Number(m[2])
  if (Number.isNaN(h) || Number.isNaN(mi)) return 0
  return h * 60 + mi
}

function diffMinutes(start?: string | null, end?: string | null) {
  if (!start || !end) return 0
  const s = toMinutes(start)
  let e = toMinutes(end)
  if (e <= s) e += 24 * 60 // passe minuit
  return Math.max(0, e - s)
}

function formatHM(totalMin: number) {
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Normalise/Calcule le total à afficher :
 * - Si `val` ressemble déjà à "HH:MM" (positif), on renvoie tel quel.
 * - Si `val` contient plusieurs créneaux "HH:MM HH:MM", on les additionne avec gestion minuit.
 * - Si `val` est un "HH:MM" mais négatif (ex: "-16:00"), on convertit en positif modulo 24h * nombre de créneaux détectables.
 *   -> Par défaut, on le remet en positif simple (valeur absolue) pour éviter l'affichage négatif.
 */
function normalizeTotalHeures(val: string): string {
  const clean = (val || "").trim()

  // 1) Cas simple : "HH:MM"
  const single = /^-?\d{1,2}:\d{2}$/.exec(clean)
  if (single) {
    // Si négatif (ex: "-16:00"), on affiche l'absolu pour éviter "-HH:MM"
    const negative = clean.startsWith("-")
    const [H, M] = clean.replace("-", "").split(":").map(Number)
    if (!negative) return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`
    const min = Math.max(0, H * 60 + M)
    return formatHM(min)
  }

  // 2) Cas "liste de créneaux" -> on récupère toutes les paires HH:MM HH:MM
  //    Exemple pris en charge: "lundi 10:00 18:00 - mardi 18:00 02:00 - jeudi 10:00 18:00"
  const times = clean.match(/\b\d{1,2}:\d{2}\b/g)
  if (times && times.length >= 2) {
    let total = 0
    for (let i = 0; i + 1 < times.length; i += 2) {
      total += diffMinutes(times[i], times[i + 1])
    }
    return formatHM(total)
  }

  // 3) Sinon on renvoie la valeur telle quelle (fallback)
  return clean
}

export function ColonneCandidate({
  nomComplet,
  secteur,
  semaine,
  statutGlobal,
  candidatId,
  totalHeures,
}: ColonneCandidateProps) {
  const secteurInfo = secteursList.find((s) => s.value === secteur)
  const [open, setOpen] = useState(false)
  const [openHistorique, setOpenHistorique] = useState(false)
  const [nomPrenom, setNomPrenom] = useState("")
  const totalHeuresAffiche = normalizeTotalHeures(totalHeures)

  useEffect(() => {
    const fetchNomPrenom = async () => {
      const { data } = await supabase
        .from("candidats")
        .select("nom, prenom")
        .eq("id", candidatId)
        .single()
      if (data) {
        setNomPrenom(`${data.nom} ${data.prenom || ""}`.trim())
      }
    }

    if (openHistorique) {
      fetchNomPrenom()
    }
  }, [openHistorique, candidatId])

  return (
    <>
      <div className="p-3 border-r bg-gray-50 h-full flex flex-col justify-between text-sm leading-tight relative">
        {/* Ligne 1 : Nom candidat + pastille statut */}
        <div className="flex justify-between items-center mb-1">
          <span
            onClick={() => setOpen(true)}
            className="font-bold text-[14px] leading-snug break-words cursor-pointer hover:underline"
          >
            {nomComplet}
          </span>
          <div
            className="h-5 w-5 rounded-full flex items-center justify-center text-white text-xs font-bold shadow"
            style={{ backgroundColor: statutGlobal === "Dispo" ? "#8ea9db" : "#4b5563" }}
          >
            {statutGlobal === "Dispo" ? <Check className="w-3 h-3" /> : "–"}
          </div>
        </div>

        {/* Ligne 2 : étiquette secteur */}
        <div className="flex flex-wrap gap-1 items-center mb-2">
          {secteurInfo && (
            <div
              className="text-[13px] font-medium px-2 py-[2px] rounded bg-gray-200 text-gray-800 flex items-center gap-1 border"
            >
              <span>{secteurInfo.emoji}</span>
              {secteurInfo.label}
            </div>
          )}
        </div>

        {/* Ligne 3 : loupe + semaine + total heures */}
        <div className="flex items-center gap-2 text-[13px] text-gray-600">
          <button onClick={() => setOpenHistorique(true)}>
            <Icon
              icon="fluent:search-square-20-regular"
              width={25}
              height={25}
              className="text-gray-700"
            />
          </button>

          <div className="h-5 w-5 rounded bg-gray-900 text-white text-xs flex items-center justify-center font-semibold">
            {semaine}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{totalHeuresAffiche}</span>
          </div>
        </div>
      </div>

      <FicheMemoCandidat
        open={open}
        onOpenChange={setOpen}
        candidatId={candidatId}
      />

      <HistoriqueCandidatDialog
        open={openHistorique}
        onOpenChange={setOpenHistorique}
        candidatId={candidatId}
        nomPrenom={nomPrenom}
      />
    </>
  )
}
