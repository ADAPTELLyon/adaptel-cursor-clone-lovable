// src/components/commandes/PlanningClientPreviewDialog.tsx

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { addDays, format, getWeek, startOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar, FileDown } from "lucide-react"

import { PlanningClientTableClientPreview } from "@/components/commandes/PlanningClientTableClientPreview"
import type { JourPlanning } from "@/types/types-front"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"
import { statutColors } from "@/lib/colors"

const BRAND = "#8a0000"

// ✅ largeur exacte du tableau : 170 + (7*90) = 800
const TABLE_WIDTH = 800

const styles = StyleSheet.create({
  page: {
    padding: 14,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#0b1220",
  },

  /* ---------------- HEADER ---------------- */
  headerWrapper: {
    marginBottom: 8,
  },

  headerCard: {
    position: "relative",
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 12,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: "#e6e8ee",
    borderRadius: 10,
    backgroundColor: "#fbfcfe",
  },

  headerAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: "#840404",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  logoSection: {
    width: 205,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingRight: 8,
    marginLeft: 0,
  },
  logoImage: {
    width: 195,
    height: 68,
    objectFit: "contain",
  },

  centerSection: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 6,
    alignItems: "center",
  },

  headerCenterTitle: {
    fontSize: 14.0,
    fontWeight: "bold",
    color: "#0b1220",
    letterSpacing: 0.4,
    textAlign: "center",
    marginBottom: 3,
  },

  headerCenterClient: {
    fontSize: 16.6,
    fontWeight: "bold",
    color: "#0b1220",
    letterSpacing: 1.0,
    textAlign: "center",
    marginBottom: 4,
  },

  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
  },

  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#f1f3f7",
    borderWidth: 1,
    borderColor: "#e6e8ee",
  },
  chipText: {
    fontSize: 9.6,
    fontWeight: "bold",
    color: "#111827",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  rightSection: {
    width: 210,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingLeft: 8,
  },

  weekMetaCard: {
    width: 186,
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftColor: "#e6e8ee",
    borderRightColor: "#e6e8ee",
    borderBottomColor: "#e6e8ee",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  weekMetaBanner: {
    height: 22,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  weekMetaBannerText: {
    fontSize: 9.6,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  weekMetaBody: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    backgroundColor: "#ffffff",
  },

  metaLineStack: {
    flexDirection: "column",
    gap: 3,
  },

  metaLineRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },

  metaLabel: {
    fontSize: 8.8,
    fontWeight: "bold",
    color: "#0b1220",
    letterSpacing: 0.15,
  },
  metaValue: {
    fontSize: 8.8,
    fontWeight: "normal",
    color: "#0b1220",
  },

  /* ---------------- PLANNING TABLE ---------------- */
  // ✅ Cadre complet fermé (gauche/haut/droite/bas) + ✅ largeur FIXE
  tableContainer: {
    width: TABLE_WIDTH,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },

  tableHeader: {
    width: TABLE_WIDTH,
    flexDirection: "row",
    backgroundColor: "#111827",
    borderBottomWidth: 2,
    borderBottomColor: "#374151",
  },

  thFirst: {
    width: 170,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },

  thDay: {
    width: 90,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },

  thDayLast: {
    width: 90,
    padding: 8,
    borderRightWidth: 0,
    justifyContent: "center",
    alignItems: "center",
  },

  thText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    textTransform: "uppercase",
  },

  thDayText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 2,
  },

  thMonthText: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#d1d5db",
    textAlign: "center",
  },

  tableRow: {
    width: TABLE_WIDTH,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    height: 56,
    backgroundColor: "#ffffff",
  },

  tableRowLast: {
    borderBottomWidth: 0,
  },

  cellFirst: {
    width: 170,
    height: 56,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    justifyContent: "center",
  },

  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    gap: 4,
  },

  // ✅ largeur fixe (RECEPTION) + plus haut
  chipSecteur: {
    width: 78,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: BRAND,
    alignItems: "center",
  },

  chipSecteurText: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },

  // ✅ largeur fixe (RESTAURANT) + même largeur que secteur + plus haut
  chipService: {
    width: 78,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
  },

  chipServiceText: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#000000",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },

  // ✅ un peu moins d'écart avec les étiquettes
  firstColInfoBlock: {
    marginTop: 4,
  },

  candidatNom: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 3,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  candidatPhone: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#6b7280",
  },

  candidatTotal: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#111827",
  },

  cellDay: {
    width: 90,
    height: 56,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },

  cellDayLast: {
    width: 90,
    height: 56,
    padding: 4,
    borderRightWidth: 0,
    backgroundColor: "#ffffff",
  },

  vignetteOuter: {
    height: 48,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
  },

  vignetteLeftBar: {
    width: 7,
  },

  vignetteMain: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 6,
    paddingRight: 6,
    justifyContent: "center",
  },

  vignetteNom: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 2,
  },

  vignettePrenom: {
    fontSize: 7.4,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 3,
  },

  vignetteHoraire: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 1,
  },

  vignetteHoraireEmpty: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#9ca3af",
    marginBottom: 1,
  },

  emptyBox: {
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    overflow: "hidden",
    position: "relative",
  },
  emptyStripesLayer: {
    position: "absolute",
    left: -30,
    top: -30,
    right: -30,
    bottom: -30,
  },
  emptyStripe: {
    position: "absolute",
    width: 10,
    height: 120,
    backgroundColor: "#e5e7eb",
    opacity: 0.35,
    transform: "rotate(35deg)",
  },

  /* ---------------- FOOTER ---------------- */
  footerWrapper: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  footerWeekBadge: {
    width: 150,
    height: 24,
    borderRadius: 4,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  footerWeekBadgeText: {
    fontSize: 9.6,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },

  footerContactRow: {
    flex: 1,
    marginLeft: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  footerContactPill: {
    flex: 1,
    height: 24,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },

  footerContactAccent: {
    width: 6,
    height: "100%",
    backgroundColor: BRAND,
  },

  footerContactInner: {
    flex: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },

  footerLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0b1220",
  },

  footerValue: {
    fontSize: 9,
    fontWeight: "normal",
    color: "#0b1220",
  },
})

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  clientId: string
  secteur: string
  service?: string | null
  semaineDate: string
}

function formatHeure(h?: any): string {
  if (!h) return ""
  return String(h).slice(0, 5)
}

// ✅ Total heures basé sur les horaires présents (même si En recherche)
function calcTotal(missions: any[]): string {
  if (!missions || missions.length === 0) return ""
  let totalMin = 0

  for (const m of missions) {
    if (!m) continue
    const dm = m.heure_debut_matin
    const fm = m.heure_fin_matin
    const ds = m.heure_debut_soir
    const fs = m.heure_fin_soir

    if (dm && fm) {
      const [dh, dmi] = dm.split(":").map(Number)
      let [fh, fmi] = fm.split(":").map(Number)
      if (fh === 0 && fmi === 0) fh = 24
      const diff = fh * 60 + fmi - (dh * 60 + dmi)
      if (diff > 0) totalMin += diff
    }

    if (ds && fs) {
      const [dh, dmi] = ds.split(":").map(Number)
      let [fh, fmi] = fs.split(":").map(Number)
      if (fh === 0 && fmi === 0) fh = 24
      const diff = fh * 60 + fmi - (dh * 60 + dmi)
      if (diff > 0) totalMin += diff
    }
  }

  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h${String(m).padStart(2, "0")}`
}

function formatNomPdf(nom: string): string {
  const n = (nom || "").trim()
  if (!n) return ""
  const parts = n.replace(/-/g, " ").split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].toUpperCase()
  const premier = parts[0].toUpperCase()
  const secondInitial = parts[1].charAt(0).toUpperCase()
  return `${premier} ${secondInitial}.`
}

function getStatusOrder(statut: string): number {
  switch (statut) {
    case "Validé":
      return 1
    case "En recherche":
      return 2
    case "Absence":
      return 3
    case "Non pourvue":
      return 4
    default:
      return 5
  }
}

function EmptyCell() {
  const stripes = Array.from({ length: 10 }, (_, i) => i)
  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptyStripesLayer}>
        {stripes.map((i) => (
          <View
            key={i}
            style={[
              styles.emptyStripe,
              {
                left: i * 22,
              },
            ]}
          />
        ))}
      </View>
    </View>
  )
}

function PlanningPdfDoc({
  clientNom,
  secteur,
  service,
  weekNum,
  lundiStr,
  jours,
  userDisplayName,
}: {
  clientNom: string
  secteur: string
  service?: string | null
  weekNum: string
  lundiStr: string
  jours: JourPlanning[]
  userDisplayName: string
}) {
  const lundi = new Date(`${lundiStr}T00:00:00`)
  const dayKeys = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(lundi, i)
    const dayFull = format(d, "EEEE dd", { locale: fr })
    const monthFull = format(d, "MMMM", { locale: fr })
    const monthFormatted = monthFull.charAt(0).toUpperCase() + monthFull.slice(1)

    return {
      key: format(d, "yyyy-MM-dd"),
      dayName: dayFull,
      monthName: monthFormatted,
    }
  })

  const candidatsMap = new Map<string, any>()

  for (const jour of jours) {
    for (const cmd of (jour.commandes || []) as any) {
      const cand = cmd.candidat
      const statut = cmd.statut || ""
      const cid = cmd.candidat_id || `${cand?.nom}_${cand?.prenom}_${statut}`

      if (!candidatsMap.has(cid)) {
        candidatsMap.set(cid, {
          nom: cand?.nom || "",
          prenom: cand?.prenom || "",
          telephone: cand?.telephone || "",
          secteur: cmd.secteur || secteur,
          service: cmd.service || "",
          statut: statut,
          missions: {},
        })
      }

      candidatsMap.get(cid)!.missions[jour.date] = cmd
    }
  }

  let rows = Array.from(candidatsMap.values())

  rows.sort((a, b) => {
    const secteurCmp = (a.secteur || "").localeCompare(b.secteur || "")
    if (secteurCmp !== 0) return secteurCmp

    const serviceCmp = (a.service || "").localeCompare(b.service || "")
    if (serviceCmp !== 0) return serviceCmp

    const statutCmp = getStatusOrder(a.statut) - getStatusOrder(b.statut)
    if (statutCmp !== 0) return statutCmp

    return (a.nom || "").localeCompare(b.nom || "")
  })

  while (rows.length < 7) {
    rows.push({ nom: "", prenom: "", telephone: "", secteur: "", service: "", statut: "", missions: {} })
  }
  rows = rows.slice(0, 7)

  const formattedDate = format(new Date(), "eeee d MMMM - HH:mm", { locale: fr })
  const secteurServiceHeader = `${secteur.toUpperCase()}${service ? ` • ${service.toUpperCase()}` : ""}`

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerWrapper}>
          <View style={styles.headerCard}>
            <View style={styles.headerAccent} />
            <View style={styles.headerRow}>
              <View style={styles.logoSection}>
                <Image src="/logo-adaptel2.png" style={styles.logoImage} />
              </View>

              <View style={styles.centerSection}>
                <Text style={styles.headerCenterTitle} wrap={false}>
                  PLANNING DE CONFIRMATION ADAPTEL LYON
                </Text>

                <Text style={styles.headerCenterClient} wrap={false}>
                  {clientNom}
                </Text>

                <View style={styles.chipRow}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText} wrap={false}>
                      {secteurServiceHeader}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.rightSection}>
                <View style={styles.weekMetaCard}>
                  <View style={styles.weekMetaBanner}>
                    <Text style={styles.weekMetaBannerText}>SEMAINE {weekNum}</Text>
                  </View>

                  <View style={styles.weekMetaBody}>
                    <View style={styles.metaLineStack}>
                      <View style={styles.metaLineRow}>
                        <Text style={styles.metaLabel}>Envoyé par</Text>
                        <Text style={styles.metaValue}>{userDisplayName || "—"}</Text>
                      </View>

                      <View style={styles.metaLineRow}>
                        <Text style={styles.metaLabel}>Version du</Text>
                        <Text style={styles.metaValue}>{formattedDate}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <View style={styles.thFirst}>
              <Text style={styles.thText}>{secteurServiceHeader}</Text>
              <Text style={styles.thText}>SEMAINE {weekNum}</Text>
            </View>

            {dayKeys.map((day, i) => (
              <View key={day.key} style={i === 6 ? styles.thDayLast : styles.thDay}>
                <Text style={styles.thDayText}>{day.dayName}</Text>
                <Text style={styles.thMonthText}>{day.monthName}</Text>
              </View>
            ))}
          </View>

          {rows.map((row, idx) => {
            const missions = Object.values(row.missions || {})
            const hasMissions = missions.length > 0
            const isTrulyEmpty = !row.nom && !row.statut && !hasMissions

            const total = !isTrulyEmpty ? calcTotal(missions as any[]) : ""
            const isLastRow = idx === rows.length - 1

            return (
              <View key={idx} style={[styles.tableRow, isLastRow && styles.tableRowLast]}>
                <View style={styles.cellFirst}>
                  {!isTrulyEmpty && (
                    <>
                      <View style={styles.chipsRow}>
                        <View style={styles.chipSecteur}>
                          <Text style={styles.chipSecteurText} wrap={false}>
                            {(row.secteur || secteur).toUpperCase()}
                          </Text>
                        </View>

                        {(row.service || "").trim() && (
                          <View style={styles.chipService}>
                            <Text style={styles.chipServiceText} wrap={false}>
                              {String(row.service).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.firstColInfoBlock}>
                        {row.nom ? (
                          <Text style={styles.candidatNom}>
                            {row.nom.toUpperCase()} {row.prenom}
                          </Text>
                        ) : (
                          <Text style={styles.candidatNom}>{(row.statut || "EN RECHERCHE").toUpperCase()}</Text>
                        )}

                        <View style={styles.infoRow}>
                          <Text style={styles.candidatPhone}>{row.telephone || ""}</Text>
                          <Text style={styles.candidatTotal}>{total}</Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>

                {dayKeys.map((day, i) => {
                  const mission = row.missions[day.key]
                  const cellStyle = i === 6 ? styles.cellDayLast : styles.cellDay

                  if (!mission) {
                    return (
                      <View key={day.key} style={cellStyle}>
                        <EmptyCell />
                      </View>
                    )
                  }

                  const statut = (mission.statut || "") as string
                  const isValide = statut === "Validé" || statut === "Absence"
                  const statusColor = statutColors[statut as keyof typeof statutColors]?.bg || "#e5e7eb"

                  const nomLine = isValide ? formatNomPdf(mission.candidat?.nom || "") : statut.toUpperCase()
                  const prenomLine = isValide ? (mission.candidat?.prenom || "") : ""

                  const matinOk = !!(mission.heure_debut_matin && mission.heure_fin_matin)
                  const soirOk = !!(mission.heure_debut_soir && mission.heure_fin_soir)

                  return (
                    <View key={day.key} style={cellStyle}>
                      <View style={styles.vignetteOuter}>
                        <View style={[styles.vignetteLeftBar, { backgroundColor: statusColor }]} />

                        <View style={styles.vignetteMain}>
                          <Text style={styles.vignetteNom}>{nomLine}</Text>
                          {!!prenomLine && <Text style={styles.vignettePrenom}>{prenomLine}</Text>}

                          <Text style={matinOk ? styles.vignetteHoraire : styles.vignetteHoraireEmpty}>
                            {matinOk
                              ? `${formatHeure(mission.heure_debut_matin)}  ${formatHeure(mission.heure_fin_matin)}`
                              : "—  —"}
                          </Text>

                          <Text style={soirOk ? styles.vignetteHoraire : styles.vignetteHoraireEmpty}>
                            {soirOk
                              ? `${formatHeure(mission.heure_debut_soir)}  ${formatHeure(mission.heure_fin_soir)}`
                              : "—  —"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>

        {/* ✅ FOOTER */}
        <View style={styles.footerWrapper}>
          <View style={styles.footerWeekBadge}>
            <Text style={styles.footerWeekBadgeText}>SEMAINE {weekNum}</Text>
          </View>

          <View style={styles.footerContactRow}>
            <View style={styles.footerContactPill}>
              <View style={styles.footerContactAccent} />
              <View style={styles.footerContactInner}>
                <Text style={styles.footerLabel}>Tél :</Text>
                <Text style={styles.footerValue}>04 37 65 25 90</Text>
              </View>
            </View>

            <View style={styles.footerContactPill}>
              <View style={styles.footerContactAccent} />
              <View style={styles.footerContactInner}>
                <Text style={styles.footerLabel}>Mail :</Text>
                <Text style={styles.footerValue}>commandes@adaptel-lyon.fr</Text>
              </View>
            </View>

            <View style={styles.footerContactPill}>
              <View style={styles.footerContactAccent} />
              <View style={styles.footerContactInner}>
                <Text style={styles.footerLabel}>SMS :</Text>
                <Text style={styles.footerValue}>06 09 22 00 80</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export default function PlanningClientPreviewDialog({
  open,
  onOpenChange,
  clientId,
  secteur,
  service,
  semaineDate,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [planning, setPlanning] = useState<Record<string, JourPlanning[]>>({})
  const [clientNom, setClientNom] = useState<string>("")
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [generating, setGenerating] = useState(false)

  const { lundiStr, dimancheStr, weekNum } = useMemo(() => {
    const base = new Date(semaineDate)
    const lundi = startOfWeek(base, { weekStartsOn: 1 })
    const dimanche = addDays(lundi, 6)
    return {
      lundiStr: format(lundi, "yyyy-MM-dd"),
      dimancheStr: format(dimanche, "yyyy-MM-dd"),
      weekNum: getWeek(base, { weekStartsOn: 1 }).toString(),
    }
  }, [semaineDate])

  const joursForPdf = useMemo(() => planning[clientNom] || [], [planning, clientNom])

  useEffect(() => {
    if (!open) return

    const fetchPlanning = async () => {
      setLoading(true)
      setErrorMsg("")
      setPlanning({})
      setClientNom("")

      try {
        const { data: client } = await supabase.from("clients").select("id, nom").eq("id", clientId).maybeSingle()
        const nomClient = client?.nom || "Client"
        setClientNom(nomClient)

        let q = supabase
          .from("commandes")
          .select(
            `
            id, date, statut, secteur, service, mission_slot, client_id,
            heure_debut_matin, heure_fin_matin,
            heure_debut_soir, heure_fin_soir,
            heure_debut_nuit, heure_fin_nuit,
            created_at, candidat_id,
            candidats (id, nom, prenom, telephone),
            clients (nom)
          `
          )
          .eq("client_id", clientId)
          .eq("secteur", secteur)
          .gte("date", lundiStr)
          .lte("date", dimancheStr)
          .in("statut", ["Validé", "En recherche", "Non pourvue", "Absence"])
          .order("date", { ascending: true })

        if (service) q = q.eq("service", service)

        const { data, error } = await q
        if (error) throw error

        const map: Record<string, JourPlanning[]> = {}
        map[nomClient] = []

        for (const item of (data || []) as any[]) {
          map[nomClient].push({
            date: item.date,
            secteur: item.secteur,
            service: item.service ?? null,
            mission_slot: item.mission_slot ?? 0,
            commandes: [
              {
                id: item.id,
                date: item.date,
                statut: item.statut,
                secteur: item.secteur,
                service: item.service,
                mission_slot: item.mission_slot,
                client_id: item.client_id,
                created_at: item.created_at,
                heure_debut_matin: item.heure_debut_matin,
                heure_fin_matin: item.heure_fin_matin,
                heure_debut_soir: item.heure_debut_soir,
                heure_fin_soir: item.heure_fin_soir,
                heure_debut_nuit: item.heure_debut_nuit,
                heure_fin_nuit: item.heure_fin_nuit,
                candidat: item.candidats,
                candidat_id: item.candidat_id,
                client: { nom: nomClient },
              },
            ],
          })
        }

        setPlanning(map)
      } catch (e: any) {
        console.error(e)
        setErrorMsg("Erreur chargement planning")
      } finally {
        setLoading(false)
      }
    }

    fetchPlanning()
  }, [open, clientId, secteur, service, lundiStr, dimancheStr])

  const handleGeneratePdf = async () => {
    if (generating || !clientNom) return

    setGenerating(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const md: any = user?.user_metadata || {}
      const email = user?.email || ""

      let prenomDb = ""
      let nomDb = ""

      if (email) {
        const { data: urow } = await supabase.from("utilisateurs").select("prenom, nom").eq("email", email).maybeSingle()

        if (urow) {
          prenomDb = (urow as any).prenom || ""
          nomDb = (urow as any).nom || ""
        }
      }

      const prenomMeta =
        md.prenom || md.first_name || (typeof md.full_name === "string" ? md.full_name.split(/\s+/)[0] : "") || ""

      const nomMeta =
        md.nom ||
        md.last_name ||
        (typeof md.full_name === "string" ? md.full_name.split(/\s+/).slice(1).join(" ") : "") ||
        ""

      const fallback = email ? email.split("@")[0] : "—"
      const userDisplayName = `${prenomDb || prenomMeta} ${nomDb || nomMeta}`.trim() || fallback

      const doc = (
        <PlanningPdfDoc
          clientNom={clientNom}
          secteur={secteur}
          service={service || null}
          weekNum={weekNum}
          lundiStr={lundiStr}
          jours={joursForPdf}
          userDisplayName={userDisplayName}
        />
      )

      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = url
      link.download = `Planning_${clientNom.replace(/\s+/g, "_")}_Sem${weekNum}_${secteur}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e) {
      console.error("PDF error:", e)
      alert("Erreur génération PDF")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-[1600px] max-h-[85vh] overflow-hidden p-0">
        <div className="flex flex-col max-h-[85vh]">
          <DialogHeader className="p-6 pb-3">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#840404]" />
                {clientNom} — {secteur} — Semaine {weekNum}
                {service && ` — ${service}`}
              </DialogTitle>

              <Button
                className="bg-[#840404] hover:bg-[#6f0303] text-white"
                onClick={handleGeneratePdf}
                disabled={loading || !!errorMsg || generating}
              >
                <FileDown className="h-4 w-4 mr-2" />
                {generating ? "Génération…" : "Générer le PDF"}
              </Button>
            </div>
          </DialogHeader>

          <div className="px-6 pb-6 flex-1 min-h-0 overflow-y-auto">
            {errorMsg ? (
              <div className="p-4 text-red-600">{errorMsg}</div>
            ) : loading ? (
              <div className="p-4 text-muted-foreground">Chargement…</div>
            ) : (
              <PlanningClientTableClientPreview planning={planning} selectedSecteurs={[secteur]} selectedSemaine={weekNum} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
