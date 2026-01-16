// src/components/commandes/PlanningClientPdfPortraitDoc.tsx

import { useMemo } from "react"
import { addDays, format } from "date-fns"
import { fr } from "date-fns/locale"
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"
import { statutColors } from "@/lib/colors"
import type { JourPlanning } from "@/types/types-front"

const BRAND = "#8a0000"

// A4 portrait (points)
const PAGE_W = 595
const PAGE_H = 842

const PADDING = 14
const CONTENT_W = PAGE_W - PADDING * 2

// Hauteurs fixes (pour garantir 1 page)
const HEADER_H = 92
const FOOTER_H = 44
const TABLE_HEADER_H = 34

// Le tableau doit occuper tout l’espace restant
const TABLE_H = PAGE_H - (PADDING * 2) - HEADER_H - FOOTER_H
const ROW_H = (TABLE_H - TABLE_HEADER_H) / 15

// Largeurs colonnes (1ère colonne plus petite / jours plus larges)
const FIRST_COL_W = 132
const DAY_COL_W = (CONTENT_W - FIRST_COL_W) / 7

const styles = StyleSheet.create({
  page: {
    padding: PADDING,
    fontFamily: "Helvetica",
    color: "#0b1220",
    fontSize: 8,
  },

  /* ================= HEADER ================= */
  header: {
    height: HEADER_H,
    borderWidth: 1,
    borderColor: "#e6e8ee",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    flexDirection: "row",
  },

  headerAccent: {
    width: 6,
    backgroundColor: "#840404",
  },

  headerLeft: {
    width: 120,
    paddingLeft: 10,
    paddingRight: 6,
    alignItems: "flex-start",
    justifyContent: "center",
  },

  logo: {
    width: 108,
    height: 58,
    objectFit: "contain",
  },

  headerCenter: {
    flex: 1,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: 14.2,
    fontWeight: "bold",
    letterSpacing: 0.35,
    textAlign: "center",
    marginBottom: 2,
  },

  clientName: {
    fontSize: 14.2,
    fontWeight: "bold",
    letterSpacing: 0.9,
    textAlign: "center",
    marginBottom: 5,
  },

  headerChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  chipSecteur: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: BRAND,
    borderRadius: 4,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },

  chipSecteurText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.25,
  },

  chipService: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },

  chipServiceText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#111827",
    textTransform: "uppercase",
    letterSpacing: 0.25,
  },

  headerRight: {
    width: 170,
    padding: 10,
    justifyContent: "center",
    alignItems: "flex-end",
  },

  weekCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e6e8ee",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },

  weekBanner: {
    height: 24,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
  },

  weekBannerText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },

  weekBody: {
    paddingTop: 7,
    paddingBottom: 7,
    paddingHorizontal: 10,
  },

  metaBlock: {
    flexDirection: "column",
    gap: 5,
  },

  metaLine: {
    flexDirection: "column",
    gap: 1,
  },

  metaLabel: {
    fontSize: 8.3,
    fontWeight: "bold",
    color: "#0b1220",
  },

  metaValue: {
    fontSize: 8.3,
    color: "#0b1220",
  },

  metaMuted: {
    color: "#6b7280",
  },

  /* ================= TABLE ================= */
  tableWrap: {
    marginTop: 10,
    height: TABLE_H,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },

  tableHeader: {
    height: TABLE_HEADER_H,
    flexDirection: "row",
    backgroundColor: "#111827",
    borderBottomWidth: 2,
    borderBottomColor: "#374151",
  },

  thFirst: {
    width: FIRST_COL_W,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },

  thFirstText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ffffff",
    textTransform: "uppercase",
    textAlign: "center",
  },

  thDay: {
    width: DAY_COL_W,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },

  thDayLast: {
    width: DAY_COL_W,
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
  },

  thDayText: {
    fontSize: 8.6,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 1,
  },

  thMonthText: {
    fontSize: 8.2,
    fontWeight: "bold",
    color: "#d1d5db",
    textAlign: "center",
  },

  tableRow: {
    flexDirection: "row",
    height: ROW_H,
    backgroundColor: "#ffffff",
  },

  /* ----- first col cells ----- */
  cellFirst: {
    width: FIRST_COL_W,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 6,
    paddingRight: 6,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    justifyContent: "center",
  },

  cellFirstLast: {
    borderBottomWidth: 0,
  },

  firstTopBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: BRAND,
    borderRadius: 3,
    marginBottom: 6,
  },

  firstTopBadgeText: {
    fontSize: 8.2,
    fontWeight: "bold",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },

  firstName: {
    fontSize: 9.2,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },

  firstBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  firstPhone: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#6b7280",
  },

  firstTotal: {
    fontSize: 7.2,
    fontWeight: "bold",
    color: "#6b7280",
  },

  /* ----- day cells ----- */
  cellDay: {
    width: DAY_COL_W,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },

  cellDayLast: {
    width: DAY_COL_W,
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },

  cellDayLastRow: {
    borderBottomWidth: 0,
  },

  /* vignette */
  vignetteOuter: {
    height: ROW_H - 8,
    borderRadius: 8,
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
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 8,
    paddingRight: 8,
    justifyContent: "center",
  },

  vignetteNom: {
    fontSize: 8.3,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 2,
  },

  vignettePrenom: {
    fontSize: 7.6,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 4,
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  timeText: {
    fontSize: 7.4,
    fontWeight: "bold",
    color: "#111827",
  },

  timeEmpty: {
    fontSize: 7.4,
    fontWeight: "bold",
    color: "#9ca3af",
  },

  /* empty cell (rayé moderne comme paysage) */
  emptyBox: {
    height: ROW_H - 8,
    borderRadius: 8,
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
    width: 12,
    height: 140,
    backgroundColor: "#e5e7eb",
    opacity: 0.35,
    transform: "rotate(35deg)",
  },

  /* ================= FOOTER ================= */
  footer: {
    marginTop: 10,
    height: FOOTER_H,
    flexDirection: "row",
    alignItems: "center",
  },

  footerWeek: {
    width: 170,
    height: 26,
    backgroundColor: BRAND,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  footerWeekText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },

  footerSpacer: {
    width: 16,
  },

  footerItem: {
    flex: 1,
    height: 26,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: BRAND,
    paddingLeft: 8,
    paddingRight: 8,
    minWidth: 0,
  },

  footerLabel: {
    fontSize: 8.3,
    fontWeight: "bold",
    color: "#6b7280",
    marginBottom: 1,
  },

  footerValue: {
    fontSize: 9.0,
    fontWeight: "bold",
    color: "#111827",
  },

  footerCol: {
    flexDirection: "column",
    justifyContent: "center",
  },
})

function formatHeure(h?: any): string {
  if (!h) return ""
  return String(h).slice(0, 5)
}

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
  const stripes = Array.from({ length: 11 }, (_, i) => i)
  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptyStripesLayer}>
        {stripes.map((i) => (
          <View
            key={i}
            style={[
              styles.emptyStripe,
              {
                left: i * 24,
              },
            ]}
          />
        ))}
      </View>
    </View>
  )
}

export function PlanningClientPdfPortraitDoc({
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

  const dayKeys = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = addDays(lundi, i)
        const dayFull = format(d, "EEEE dd", { locale: fr })
        const monthFull = format(d, "MMMM", { locale: fr })
        const monthFormatted = monthFull.charAt(0).toUpperCase() + monthFull.slice(1)

        return {
          key: format(d, "yyyy-MM-dd"),
          dayName: dayFull,
          monthName: monthFormatted,
        }
      }),
    [lundi]
  )

  const headerServices = useMemo(() => {
    if (service && String(service).trim()) return [String(service)]
    const set = new Set<string>()
    for (const j of jours || []) {
      for (const c of (j as any)?.commandes || []) {
        const s = String((c as any)?.service || "").trim()
        if (s) set.add(s)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [jours, service])

  // Construction des lignes
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

  while (rows.length < 15) {
    rows.push({
      nom: "",
      prenom: "",
      telephone: "",
      secteur: "",
      service: "",
      statut: "",
      missions: {},
    })
  }
  rows = rows.slice(0, 15)

  const generatedDate = format(new Date(), "EEEE d MMMM - HH:mm", { locale: fr })
  const userName = userDisplayName || "—"

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page}>
        {/* ================= HEADER ================= */}
        <View style={styles.header}>
          <View style={styles.headerAccent} />

          <View style={styles.headerLeft}>
            <Image src="/logo-adaptel2.png" style={styles.logo} />
          </View>

          <View style={styles.headerCenter}>
            {/* * demandé pour validation */}
            <Text style={styles.title} wrap={false}>
              PLANNING DE CONFIRMATION ADAPTEL LYON *
            </Text>
            <Text style={styles.clientName} wrap={false}>
              {String(clientNom || "").toUpperCase()}
            </Text>

            <View style={styles.headerChipsRow}>
              <View style={styles.chipSecteur}>
                <Text style={styles.chipSecteurText} wrap={false}>
                  {String(secteur || "").toUpperCase()}
                </Text>
              </View>

              {headerServices.map((s) => (
                <View key={s} style={styles.chipService}>
                  <Text style={styles.chipServiceText} wrap={false}>
                    {String(s || "").toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.weekCard}>
              <View style={styles.weekBanner}>
                <Text style={styles.weekBannerText} wrap={false}>
                  SEMAINE {weekNum}
                </Text>
              </View>

              <View style={styles.weekBody}>
                <View style={styles.metaBlock}>
                  <View style={styles.metaLine}>
                    <Text style={styles.metaLabel}>Version du :</Text>
                    <Text style={[styles.metaValue, styles.metaMuted]}>{generatedDate}</Text>
                  </View>

                  <View style={styles.metaLine}>
                    <Text style={styles.metaLabel}>Envoyé par :</Text>
                    <Text style={styles.metaValue}>{userName}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ================= TABLE ================= */}
        <View style={styles.tableWrap}>
          <View style={styles.tableHeader}>
            <View style={styles.thFirst}>
              <Text style={styles.thFirstText} wrap={false}>
                {(secteur || "").toUpperCase()}
              </Text>
              <Text style={styles.thFirstText} wrap={false}>
                SEMAINE {weekNum}
              </Text>
            </View>

            {dayKeys.map((day, i) => (
              <View key={day.key} style={i === 6 ? styles.thDayLast : styles.thDay}>
                <Text style={styles.thDayText}>{day.dayName}</Text>
                <Text style={styles.thMonthText}>{day.monthName}</Text>
              </View>
            ))}
          </View>

          {rows.map((row, rowIndex) => {
            const missions = Object.values(row.missions || {})
            const hasMissions = missions.length > 0
            const isTrulyEmpty = !row.nom && !row.statut && !hasMissions
            const isLastRow = rowIndex === rows.length - 1

            const total = !isTrulyEmpty ? calcTotal(missions as any[]) : ""

            // Badge gauche : "SECTEUR | SERVICE"
            const leftBadgeText = (() => {
              const sec = (row.secteur || secteur || "").toUpperCase()
              const srv = String(row.service || "").trim()
              if (srv) return `${sec} | ${srv.toUpperCase()}`
              return sec
            })()

            return (
              <View key={rowIndex} style={styles.tableRow}>
                <View style={[styles.cellFirst, isLastRow && styles.cellFirstLast]}>
                  {!isTrulyEmpty && (
                    <>
                      <View style={styles.firstTopBadge}>
                        <Text style={styles.firstTopBadgeText} wrap={false}>
                          {leftBadgeText}
                        </Text>
                      </View>

                      {row.nom ? (
                        <Text style={styles.firstName} wrap={false}>
                          {String(row.nom || "").toUpperCase()} {row.prenom || ""}
                        </Text>
                      ) : (
                        // Ligne "statut" si pas de candidat
                        <Text style={styles.firstName} wrap={false}>
                          {String(row.statut || "En recherche").toUpperCase()}
                        </Text>
                      )}

                      <View style={styles.firstBottomRow}>
                        <Text style={styles.firstPhone} wrap={false}>
                          {row.telephone || ""}
                        </Text>
                        <Text style={styles.firstTotal} wrap={false}>
                          {total}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {dayKeys.map((day, dayIndex) => {
                  const mission = row.missions[day.key]
                  const baseCellStyle = dayIndex === 6 ? styles.cellDayLast : styles.cellDay
                  const cellStyle = [baseCellStyle, isLastRow && styles.cellDayLastRow]

                  if (!mission) {
                    return (
                      <View key={day.key} style={cellStyle as any}>
                        <EmptyCell />
                      </View>
                    )
                  }

                  const statut = (mission.statut || "") as string
                  const isValide = statut === "Validé" || statut === "Absence"
                  const statusColor = statutColors[statut as keyof typeof statutColors]?.bg || "#e5e7eb"

                  const nomLine = isValide ? formatNomPdf(mission.candidat?.nom || "") : statut.toUpperCase()
                  const prenomLine = isValide ? (mission.candidat?.prenom || "") : ""

                  const dm = formatHeure(mission.heure_debut_matin)
                  const fm = formatHeure(mission.heure_fin_matin)
                  const ds = formatHeure(mission.heure_debut_soir)
                  const fs = formatHeure(mission.heure_fin_soir)

                  const matinOk = !!(dm && fm)
                  const soirOk = !!(ds && fs)

                  return (
                    <View key={day.key} style={cellStyle as any}>
                      <View style={styles.vignetteOuter}>
                        <View style={[styles.vignetteLeftBar, { backgroundColor: statusColor }]} />

                        <View style={styles.vignetteMain}>
                          <Text style={styles.vignetteNom} wrap={false}>
                            {nomLine}
                          </Text>
                          {!!prenomLine && (
                            <Text style={styles.vignettePrenom} wrap={false}>
                              {prenomLine}
                            </Text>
                          )}

                          <View style={styles.timeRow}>
                            <Text style={matinOk ? styles.timeText : styles.timeEmpty} wrap={false}>
                              {matinOk ? `${dm} - ${fm}` : "—  —"}
                            </Text>
                          </View>

                          <View style={styles.timeRow}>
                            <Text style={soirOk ? styles.timeText : styles.timeEmpty} wrap={false}>
                              {soirOk ? `${ds} - ${fs}` : "—  —"}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>

        {/* ================= FOOTER ================= */}
        <View style={styles.footer}>
          <View style={styles.footerWeek}>
            <Text style={styles.footerWeekText} wrap={false}>
              SEMAINE {weekNum}
            </Text>
          </View>

          <View style={styles.footerSpacer} />

          <View style={styles.footerItem}>
            <View style={styles.footerCol}>
              <Text style={styles.footerLabel}>Tel :</Text>
              <Text style={styles.footerValue} wrap={false}>
                04 37 65 25 90
              </Text>
            </View>
          </View>

          <View style={styles.footerSpacer} />

          <View style={styles.footerItem}>
            <View style={styles.footerCol}>
              <Text style={styles.footerLabel}>Mail :</Text>
              <Text style={styles.footerValue} wrap={false}>
                commandes@adaptel-lyon.fr
              </Text>
            </View>
          </View>

          <View style={styles.footerSpacer} />

          <View style={styles.footerItem}>
            <View style={styles.footerCol}>
              <Text style={styles.footerLabel}>SMS :</Text>
              <Text style={styles.footerValue} wrap={false}>
                06 09 22 00 80
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
