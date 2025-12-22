import { useMemo } from "react"
import { format, startOfWeek, addDays, getWeek, getWeekYear } from "date-fns"
import { fr } from "date-fns/locale"

import type { CommandeWithCandidat, JourPlanning } from "@/types/types-front"
import { indicateurColors } from "@/lib/colors"
import { secteursList } from "@/lib/secteurs"
import { Clock, Check } from "lucide-react"

/**
 * Version PREVIEW CLIENT :
 * - Visuel identique à PlanningClientTable (grille, headers, heights)
 * - 1 ligne = 1 candidat ✅ (par service)
 * - Absence / Annule Client restent SUR la ligne du candidat ✅
 * - En recherche + Non pourvue = lignes sans candidat en bas du service ✅
 */

interface Props {
  planning: Record<string, JourPlanning[]>
  selectedSecteurs: string[]
  selectedSemaine: string
}

const norm = (s: string = "") =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()

const sortYearWeekAsc = (a: string, b: string) => {
  const [ay, aw] = a.split("-W")
  const [by, bw] = b.split("-W")
  const ya = parseInt(ay, 10)
  const yb = parseInt(by, 10)
  if (ya !== yb) return ya - yb
  return (parseInt(aw, 10) || 0) - (parseInt(bw, 10) || 0)
}

const mondayFromGroup = (secteurs: Record<string, Record<string, JourPlanning[]>>) => {
  for (const lignes of Object.values(secteurs)) {
    for (const ligne of Object.values(lignes)) {
      const ref = ligne[0]?.date
      if (ref) return startOfWeek(new Date(ref), { weekStartsOn: 1 })
    }
  }
  return startOfWeek(new Date(), { weekStartsOn: 1 })
}

function diffMinutes(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return 0

  const s = sh * 60 + sm
  let e = eh * 60 + em
  if (e <= s) e += 24 * 60
  return Math.max(0, e - s)
}

function calculerHeuresTotales(commandes: CommandeWithCandidat[]) {
  let totalMinutes = 0

  for (const cmd of commandes) {
    if (cmd.statut === "Validé" || cmd.statut === "En recherche") {
      totalMinutes += diffMinutes((cmd as any).heure_debut_matin, (cmd as any).heure_fin_matin)
      totalMinutes += diffMinutes((cmd as any).heure_debut_soir, (cmd as any).heure_fin_soir)
      if ("heure_debut_nuit" in (cmd as any) || "heure_fin_nuit" in (cmd as any)) {
        totalMinutes += diffMinutes((cmd as any).heure_debut_nuit, (cmd as any).heure_fin_nuit)
      }
    }
  }

  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

function CellulePlanningPreview({
  commande,
  secteur,
}: {
  commande?: CommandeWithCandidat
  secteur: string
}) {
  if (!commande) {
    return (
      <div
        className="h-full rounded relative shadow-[inset_0_0_0_1px_rgba(203,213,225,0.9)] overflow-hidden flex items-center justify-center"
        style={{
          backgroundColor: "#ffffff",
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0, rgba(0,0,0,0.03) 10px, transparent 10px, transparent 20px)",
        }}
      />
    )
  }
  return <CellulePlanningPreviewInner commande={commande} secteur={secteur} />
}

// --- import statuts
import { statutColors, statutBorders } from "@/lib/colors"

function CellulePlanningPreviewInner({
  commande,
  secteur,
}: {
  commande: CommandeWithCandidat
  secteur: string
}) {
  const isEtages = secteur === "Étages"
  const statutColor = (statutColors as any)[commande.statut] || { bg: "#e5e7eb", text: "#000000" }
  const borderColor = (statutBorders as any)[commande.statut] || "#d1d5db"

  const candidatToShow = (commande as any).candidat || null

  return (
    <div
      className="h-full rounded p-2 text-xs flex flex-col justify-start gap-1 border relative"
      style={{
        backgroundColor: statutColor.bg,
        color: statutColor.text,
        borderLeft: `5px solid ${borderColor}`,
      }}
      data-commande-id={commande.id}
    >
      <div className="min-h-[2.5rem] leading-tight font-semibold">
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

      <div className="text-[13px] font-semibold mt-1 space-y-1">
        {["matin", ...(isEtages ? [] : ["soir"])].map((creneau) => {
          const heureDebut = (commande as any)[`heure_debut_${creneau}`] ?? ""
          const heureFin = (commande as any)[`heure_fin_${creneau}`] ?? ""

          return (
            <div key={creneau} className="flex gap-1 items-center">
              <span>{String(heureDebut).slice(0, 5) || "–"}</span>
              <span>{String(heureFin).slice(0, 5) || "–"}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ColonneCandidatPreview({
  candidatNom,
  candidatPrenom,
  telephone,
  secteur,
  service,
  nbEnRecherche,
  commandes,
}: {
  candidatNom: string
  candidatPrenom: string
  telephone?: string | null
  secteur: string
  service?: string
  nbEnRecherche: number
  commandes: CommandeWithCandidat[]
}) {
  const secteurInfo = secteursList.find((s) => s.value === secteur)
  const totalHeures = calculerHeuresTotales(commandes)

  const nomUpper = (candidatNom || "–").toUpperCase()
  const prenom = candidatPrenom || "–"

  return (
    <div className="p-3 border-r bg-white h-full flex flex-col justify-between text-sm leading-tight relative">
      <div
        className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center text-white text-xs font-bold shadow"
        style={{ backgroundColor: nbEnRecherche > 0 ? "#fdba74" : "#a9d08e" }}
      >
        {nbEnRecherche > 0 ? "!" : <Check className="w-3 h-3" />}
      </div>

      <div className="flex flex-wrap gap-1 items-center mb-2 pr-8">
        {secteurInfo && (
          <div className="text-[13px] font-medium px-2 py-[2px] rounded bg-gray-100 text-gray-800 flex items-center gap-1 border">
            <span>{secteurInfo.emoji}</span>
            {secteurInfo.label}
          </div>
        )}
        {service && (
          <div className="text-[13px] px-2 py-[2px] rounded bg-gray-100 text-gray-700 border">
            {service}
          </div>
        )}
      </div>

      <div className="mb-2 pr-8">
        <div className="text-[14px] font-bold leading-snug break-words">
          {nomUpper} {prenom}
        </div>
      </div>

      <div className="flex items-center justify-between text-[13px] text-gray-600 pr-8">
        <div className="truncate">{telephone ? telephone : "—"}</div>

        <div className="flex items-center gap-1 shrink-0">
          <Clock className="w-4 h-4" />
          <span>{totalHeures}</span>
        </div>
      </div>
    </div>
  )
}

/** ordre des blocs dans un service : candidats -> En recherche -> Non pourvue -> autres */
const kindOrder = (kind: string) => {
  if (kind === "cand") return 0
  if (kind === "recherche") return 1
  if (kind === "nonpourvue") return 2
  return 3
}

function parseGroupKey(groupKey: string) {
  const p = groupKey.split("||")
  const head = p[0]

  if (head === "__RECHERCHE__") {
    return {
      kind: "recherche" as const,
      candidatNom: "En recherche",
      candidatPrenom: "",
      telephone: "",
      service: p[4] || "",
      slot: parseInt(p[5] || "0", 10) || 0,
      nomTri: "zzzz_en_recherche",
      prenomTri: "",
    }
  }

  if (head === "__NONPOURVUE__") {
    return {
      kind: "nonpourvue" as const,
      candidatNom: "Non pourvue",
      candidatPrenom: "",
      telephone: "",
      service: p[4] || "",
      slot: parseInt(p[5] || "0", 10) || 0,
      nomTri: "zzzz_non_pourvue",
      prenomTri: "",
    }
  }

  if (head === "__STATUT__") {
    const statut = p[1] || "—"
    return {
      kind: "statut" as const,
      candidatNom: statut,
      candidatPrenom: "",
      telephone: "",
      service: p[4] || "",
      slot: parseInt(p[5] || "0", 10) || 0,
      nomTri: "zzzz_" + statut,
      prenomTri: "",
    }
  }

  // candidatKey||nom||prenom||telephone||service
  return {
    kind: "cand" as const,
    candidatNom: p[1] || "",
    candidatPrenom: p[2] || "",
    telephone: p[3] || "",
    service: p[4] || "",
    slot: 0,
    nomTri: p[1] || "",
    prenomTri: p[2] || "",
  }
}

export function PlanningClientTableClientPreview({
  planning,
  selectedSecteurs,
  selectedSemaine,
}: Props) {
  const groupesParSemaineEtSecteur = useMemo(() => {
    const groupes: Record<string, Record<string, Record<string, JourPlanning[]>>> = {}

    Object.entries(planning).forEach(([, jours]) => {
      jours.forEach((jour) => {
        jour.commandes.forEach((commande) => {
          if (selectedSecteurs.length > 0 && !selectedSecteurs.includes(jour.secteur)) return

          const d = new Date(jour.date)
          const week = getWeek(d, { weekStartsOn: 1 })
          const weekYear = getWeekYear(d, { weekStartsOn: 1 })
          const semaineKey = `${weekYear}-W${String(week).padStart(2, "0")}`

          const secteur = jour.secteur
          const service = (commande.service as any) || ""
          const missionSlot = (commande as any).mission_slot ?? 0

          const cand = (commande as any).candidat
          const candidatId = (commande as any).candidat_id || ""
          const candidatNom = cand?.nom || ""
          const candidatPrenom = cand?.prenom || ""
          const telephone = cand?.telephone || ""

          /**
           * ✅ Regroupement :
           * - VALIDÉ + ABSENCE + ANNULE CLIENT = sur la ligne candidat (candidat + service, sans slot)
           * - EN RECHERCHE = ligne sans candidat en bas du service (par slot)
           * - NON POURVUE = ligne sans candidat en bas du service (par slot)
           */
          const statut = commande.statut

          const hasCandidat = Boolean(candidatId || candidatNom || candidatPrenom)
          const isCandidatLineStatut = statut === "Validé" || statut === "Absence" || statut === "Annule Client"

          let groupKey = ""

          if (hasCandidat && isCandidatLineStatut) {
            const candidatKey = candidatId || `${candidatNom}__${candidatPrenom}`
            groupKey = `${candidatKey}||${candidatNom}||${candidatPrenom}||${telephone}||${service}`
          } else if (statut === "En recherche") {
            groupKey = `__RECHERCHE__||En recherche|| || ||${service}||${missionSlot}`
          } else if (statut === "Non pourvue") {
            groupKey = `__NONPOURVUE__||Non pourvue|| || ||${service}||${missionSlot}`
          } else {
            // fallback (au cas où) : reste visible mais séparé, sans polluer les lignes candidats
            groupKey = `__STATUT__||${statut}|| || ||${service}||${missionSlot}`
          }

          if (!groupes[semaineKey]) groupes[semaineKey] = {}
          if (!groupes[semaineKey][secteur]) groupes[semaineKey][secteur] = {}
          if (!groupes[semaineKey][secteur][groupKey]) groupes[semaineKey][secteur][groupKey] = []

          const arr = groupes[semaineKey][secteur][groupKey]

          const existing = arr.find(
            (j) =>
              j.date === jour.date &&
              j.secteur === jour.secteur &&
              ((j.service ?? "") === (jour.service ?? ""))
          )

          if (existing) {
            existing.commandes.push(commande)
          } else {
            arr.push({
              ...jour,
              commandes: [commande],
            })
          }
        })
      })
    })

    return groupes
  }, [planning, selectedSecteurs])

  return (
    <div className="space-y-8 mt-8">
      {Object.entries(groupesParSemaineEtSecteur)
        .sort(([a], [b]) => sortYearWeekAsc(a, b))
        .map(([semaineKey, secteurs]) => {
          const [yearStr, wStr] = semaineKey.split("-W")
          const year = parseInt(yearStr, 10)
          const weekNum = parseInt(wStr, 10)

          const lundiSemaine = mondayFromGroup(secteurs)

          const jours = Array.from({ length: 7 }, (_, i) => {
            const jour = addDays(lundiSemaine, i)
            return {
              date: jour,
              dateStr: format(jour, "yyyy-MM-dd"),
              label: format(jour, "eeee dd MMMM", { locale: fr }),
            }
          })

          return Object.entries(secteurs).map(([secteur, groupes]) => {
            const semaineTexte = `Semaine ${String(weekNum)} • ${secteur} • ${year}`

            return (
              <div
                key={`${semaineKey}-${secteur}`}
                className="border rounded-lg overflow-hidden shadow-sm"
              >
                {/* En-tête */}
                <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white sticky z-[10]">
                  <div className="p-4 border-r flex items-center justify-center min-h-[64px]">
                    {semaineTexte}
                  </div>

                  {jours.map((jour, index) => {
                    let totalMissions = 0
                    let nbEnRecherche = 0
                    let nbValides = 0

                    Object.values(groupes).forEach((ligne) => {
                      const jourCell = ligne.find(
                        (j) => format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr
                      )
                      if (jourCell) {
                        totalMissions += jourCell.commandes.length
                        nbEnRecherche += jourCell.commandes.filter((cmd) => cmd.statut === "En recherche").length
                        nbValides += jourCell.commandes.filter((cmd) => cmd.statut === "Validé").length
                      }
                    })

                    return (
                      <div
                        key={index}
                        className="p-4 border-r text-center relative leading-tight min-h-[64px]"
                      >
                        <div className="text-sm font-semibold leading-tight">
                          {jour.label.split(" ")[0]}
                        </div>
                        <div className="text-sm leading-tight">
                          {jour.label.split(" ").slice(1).join(" ")}
                        </div>

                        {totalMissions === 0 ? (
                          <div className="absolute top-1 right-1">
                            <div className="h-5 w-5 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">
                              –
                            </div>
                          </div>
                        ) : nbEnRecherche > 0 ? (
                          <div
                            className="absolute top-1 right-1 h-5 w-5 text-xs rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: indicateurColors["En recherche"],
                              color: "#1f2937",
                            }}
                          >
                            {nbEnRecherche}
                          </div>
                        ) : (
                          <div className="absolute top-1 right-1">
                            <div className="h-5 w-5 rounded-full bg-[#a9d08e] text-xs flex items-center justify-center text-gray-800">
                              {nbValides}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Lignes */}
                {Object.entries(groupes)
                  .sort(([aKey], [bKey]) => {
                    const a = parseGroupKey(aKey)
                    const b = parseGroupKey(bKey)

                    // 1) par service
                    const cmpService = norm(a.service).localeCompare(norm(b.service))
                    if (cmpService !== 0) return cmpService

                    // 2) ordre : candidats -> En recherche -> Non pourvue -> autres
                    const ko = kindOrder(a.kind) - kindOrder(b.kind)
                    if (ko !== 0) return ko

                    // 3) candidats : nom/prénom
                    if (a.kind === "cand" && b.kind === "cand") {
                      const cmpNom = norm(a.nomTri).localeCompare(norm(b.nomTri))
                      if (cmpNom !== 0) return cmpNom
                      const cmpPrenom = norm(a.prenomTri).localeCompare(norm(b.prenomTri))
                      if (cmpPrenom !== 0) return cmpPrenom
                      return 0
                    }

                    // 4) recherche / non pourvue : slot
                    return (a.slot || 0) - (b.slot || 0)
                  })
                  .map(([groupKey, ligne]) => {
                    const info = parseGroupKey(groupKey)

                    const nbEnRecherche = ligne
                      .flatMap((j) => j.commandes)
                      .filter((cmd) => cmd.statut === "En recherche").length

                    const toutesCommandes = ligne.flatMap((j) => j.commandes)

                    return (
                      <div
                        key={groupKey}
                        className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-white text-sm font-medium text-gray-800 border-b"
                      >
                        <ColonneCandidatPreview
                          candidatNom={info.candidatNom}
                          candidatPrenom={info.candidatPrenom}
                          telephone={info.telephone}
                          secteur={secteur}
                          service={info.service}
                          nbEnRecherche={nbEnRecherche}
                          commandes={toutesCommandes}
                        />

                        {jours.map((jour, index) => {
                          const jourCell = ligne.find(
                            (j) => format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr
                          )
                          const commande = jourCell?.commandes[0]

                          return (
                            <div key={index} className="border-r p-2 h-28 relative">
                              <CellulePlanningPreview commande={commande} secteur={secteur} />
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
              </div>
            )
          })
        })}
    </div>
  )
}
