import { Clock, Check } from "lucide-react"
import { secteursList } from "@/lib/secteurs"
import { useEffect, useMemo, useState } from "react"
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
 *  Helpers heures (inchangé)
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

function normalizeTotalHeures(val: string): string {
  const clean = (val || "").trim()

  const single = /^-?\d{1,2}:\d{2}$/.exec(clean)
  if (single) {
    const negative = clean.startsWith("-")
    const [H, M] = clean.replace("-", "").split(":").map(Number)
    if (!negative) return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`
    const min = Math.max(0, H * 60 + M)
    return formatHM(min)
  }

  const times = clean.match(/\b\d{1,2}:\d{2}\b/g)
  if (times && times.length >= 2) {
    let total = 0
    for (let i = 0; i + 1 < times.length; i += 2) {
      total += diffMinutes(times[i], times[i + 1])
    }
    return formatHM(total)
  }

  return clean
}

/** ----------------------------------------------------------------
 *  Résolution d'ID par nom (nouveau)
 *  - essaie "Prénom Nom" ET "Nom Prénom"
 *  - utilise ILIKE partiel sur nom/prenom
 *  - retourne le 1er match
 * ----------------------------------------------------------------*/
function buildOrFilter(nom: string, prenom: string) {
  const p = (s: string) => `%${s.replace(/\s+/g, " ").trim()}%`
  // and(nom.ilike.%NOM%,prenom.ilike.%PRENOM%)
  return `and(nom.ilike.${p(nom)},prenom.ilike.${p(prenom)})`
}

async function resolveCandidatIdByName(nomComplet: string): Promise<{ id: string; nom: string; prenom: string } | null> {
  const parts = nomComplet.trim().replace(/\s+/g, " ").split(" ")
  if (parts.length < 2) return null

  const first = parts[0]
  const last = parts.slice(1).join(" ")

  // variantes : "Prénom Nom" et "Nom Prénom"
  const or = [
    buildOrFilter(last, first),
    buildOrFilter(first, last),
  ].join(",")

  const { data, error } = await supabase
    .from("candidats")
    .select("id, nom, prenom")
    .or(or)
    .limit(1)

  if (error || !data || !data[0]) return null
  const row = data[0]
  return { id: row.id, nom: row.nom, prenom: row.prenom }
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

  // ⬇️ nouvel état : ID effectif à passer aux dialogs (résolu si besoin)
  const [resolvedId, setResolvedId] = useState<string>(candidatId || "")
  const [resolving, setResolving] = useState(false)

  // dialogs
  const [open, setOpen] = useState(false)
  const [openHistorique, setOpenHistorique] = useState(false)

  // affichage header historique
  const [nomPrenom, setNomPrenom] = useState("")

  const totalHeuresAffiche = normalizeTotalHeures(totalHeures)

  // ✅ affichage propre du numéro de semaine, même si on reçoit "2025-49"
  const displayWeek = useMemo(() => {
    if (!semaine) return ""
    const parts = String(semaine).split("-")
    const raw = parts[parts.length - 1] // dernière partie = numéro de semaine
    const num = parseInt(raw, 10)
    return Number.isNaN(num) ? raw : String(num)
  }, [semaine])

  // garde l'état en phase si le parent nous donne un nouvel ID
  useEffect(() => {
    setResolvedId(candidatId || "")
  }, [candidatId])

  // quand l'historique s'ouvre, on récupère le nom/prénom pour l'entête (inchangé)
  useEffect(() => {
    const fetchNomPrenom = async (id: string) => {
      const { data } = await supabase
        .from("candidats")
        .select("nom, prenom")
        .eq("id", id)
        .single()
      if (data) setNomPrenom(`${data.nom} ${data.prenom || ""}`.trim())
    }

    if (openHistorique && resolvedId) {
      fetchNomPrenom(resolvedId)
    }
  }, [openHistorique, resolvedId])

  // 🔑 ouvre la fiche mémo en garantissant un ID
  const openFiche = async () => {
    if (resolvedId) {
      setOpen(true)
      return
    }
    // pas d'ID -> on tente résolution par nom
    if (resolving) return
    setResolving(true)
    try {
      const found = await resolveCandidatIdByName(nomComplet)
      if (found?.id) {
        setResolvedId(found.id)
        setOpen(true) // n’ouvre qu’une fois l’ID connu
      } else {
        // rien trouvé : on n’ouvre pas une fiche “vide”
        // (option : toast ici si vous voulez)
      }
    } finally {
      setResolving(false)
    }
  }

  // 🔎 ouvre l’historique en garantissant un ID
  const openHistory = async () => {
    if (resolvedId) {
      setOpenHistorique(true)
      return
    }
    if (resolving) return
    setResolving(true)
    try {
      const found = await resolveCandidatIdByName(nomComplet)
      if (found?.id) {
        setResolvedId(found.id)
        setOpenHistorique(true)
      }
    } finally {
      setResolving(false)
    }
  }

  return (
    <>
      <div className="p-3 border-r bg-gray-50 h-full flex flex-col justify-between text-sm leading-tight relative">
        {/* Ligne 1 : Nom candidat + pastille statut */}
        <div className="flex justify-between items-center mb-1">
          <span
            onClick={openFiche}
            className="font-bold text-[14px] leading-snug break-words cursor-pointer hover:underline"
            title={resolvedId ? undefined : "Clique pour ouvrir (résolution du candidat en cours si nécessaire)"}
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
            <div className="text-[13px] font-medium px-2 py-[2px] rounded bg-gray-200 text-gray-800 flex items-center gap-1 border">
              <span>{secteurInfo.emoji}</span>
              {secteurInfo.label}
            </div>
          )}
        </div>

        {/* Ligne 3 : loupe + semaine + total heures */}
        <div className="flex items-center gap-2 text-[13px] text-gray-600">
          <button onClick={openHistory} title={resolvedId ? "Historique" : "Résolution du candidat par nom si nécessaire"}>
            <Icon
              icon="fluent:search-square-20-regular"
              width={25}
              height={25}
              className="text-gray-700"
            />
          </button>

          <div className="h-5 w-5 rounded bg-gray-900 text-white text-xs flex items-center justify-center font-semibold">
            {displayWeek}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{totalHeuresAffiche}</span>
          </div>
        </div>
      </div>

      {/* ⚠️ on passe toujours l’ID effectif (résolu si besoin) */}
      <FicheMemoCandidat
        open={open}
        onOpenChange={setOpen}
        candidatId={resolvedId}
      />

      <HistoriqueCandidatDialog
        open={openHistorique}
        onOpenChange={setOpenHistorique}
        candidatId={resolvedId}
        nomPrenom={nomPrenom || nomComplet}
      />
    </>
  )
}
