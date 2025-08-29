import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns"
import { statutColors, disponibiliteColors } from "@/lib/colors"
import { supabase } from "@/lib/supabase"
import type { JourPlanningCandidat, CommandeFull } from "@/types/types-front"
import { ColonneCandidate } from "@/components/Planning/ColonneCandidate"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CandidateJourneeDialog } from "@/components/Planning/CandidateJourneeDialog"

const HALF_H = 48
const GAP = 6
const FULL_H_ETAGES = 56
const ROW_H_OTHERS = HALF_H * 2 + GAP

const compactClient = (raw?: string) => {
  if (!raw) return "Client ?"
  const words = raw.trim().split(/\s+/)
  if (words.length <= 3) return raw
  return words.slice(0, 3).join(" ") + " ..."
}
const fmt = (h?: string | null) => (h && h.length >= 5 ? h.slice(0, 5) : "")

export function PlanningCandidateTable({
  planning,
  selectedSecteurs,
  selectedSemaine,
  onRefresh,
}: {
  planning: Record<string, JourPlanningCandidat[]>
  selectedSecteurs: string[]
  selectedSemaine: string
  onRefresh: () => void
}) {
  const [heuresParCandidat, setHeuresParCandidat] = useState<Record<string, string>>({})

  const [dispoDialog, setDispoDialog] = useState<{
    open: boolean
    date: string | null
    secteur: string
    candidatId: string
    service: string
    disponibilite: any
    candidatNomPrenom: string
    creneauVerrouille: "matin" | "soir"
  }>({
    open: false,
    date: null,
    secteur: "",
    candidatId: "",
    service: "",
    disponibilite: null,
    candidatNomPrenom: "",
    creneauVerrouille: "matin",
  })

  const openDispo = (args: Omit<typeof dispoDialog, "open">) =>
    setDispoDialog({ ...args, open: true })
  const closeDispo = () => setDispoDialog((d) => ({ ...d, open: false }))

  const onDialogSuccess = () => {
    try {
      if (dispoDialog.candidatId && dispoDialog.date) {
        window.dispatchEvent(
          new CustomEvent("dispos:updated", {
            detail: { candidatId: dispoDialog.candidatId, date: dispoDialog.date },
          })
        )
      }
    } catch {}
    onRefresh()
    closeDispo()
  }

  useEffect(() => {
    const handler = () => onRefresh()
    window.addEventListener("dispos:updated", handler as EventListener)
    window.addEventListener("planif:updated", handler as EventListener)
    return () => {
      window.removeEventListener("dispos:updated", handler as EventListener)
      window.removeEventListener("planif:updated", handler as EventListener)
    }
  }, [onRefresh])

  useEffect(() => {
    const fetchHeures = async () => {
      const currentDate = new Date()
      const lundiSemaine = startOfWeek(currentDate, { weekStartsOn: 1 })
      let lundiTarget = lundiSemaine

      if (selectedSemaine !== "Toutes") {
        const numSemaineCible = parseInt(selectedSemaine)
        const numSemaineActuelle = parseInt(format(currentDate, "I"))
        const diff = numSemaineCible - numSemaineActuelle
        lundiTarget = addWeeks(lundiSemaine, diff)
      }

      const dimancheTarget = endOfWeek(lundiTarget, { weekStartsOn: 1 })
      const heures: Record<string, string> = {}

      for (const candidatNom of Object.keys(planning)) {
        let candidatId: string | null = null
        for (const jour of planning[candidatNom]) {
          candidatId = jour.disponibilite?.candidat_id || jour.commande?.candidat_id
          if (candidatId) break
        }
        if (!candidatId) {
          heures[candidatNom] = "00:00"
          continue
        }

        const { data, error } = await supabase
          .from("commandes")
          .select("*")
          .in("statut", ["Validé", "Planifié", "À valider"])
          .eq("candidat_id", candidatId)
          .gte("date", lundiTarget.toISOString().slice(0, 10))
          .lte("date", dimancheTarget.toISOString().slice(0, 10))

        if (error) {
          console.error("Erreur récupération heures:", error)
          heures[candidatNom] = "00:00"
          continue
        }

        let totalMinutes = 0
        data?.forEach((cmd) => {
          if (cmd.heure_debut_matin && cmd.heure_fin_matin) {
            const [h1, m1] = cmd.heure_debut_matin.split(":").map(Number)
            const [h2, m2] = cmd.heure_fin_matin.split(":").map(Number)
            totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1)
          }
          if (cmd.heure_debut_soir && cmd.heure_fin_soir) {
            const [h1, m1] = cmd.heure_debut_soir.split(":").map(Number)
            const [h2, m2] = cmd.heure_fin_soir.split(":").map(Number)
            totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1)
          }
          if (cmd.heure_debut_nuit && cmd.heure_fin_nuit) {
            const [h1, m1] = cmd.heure_debut_nuit.split(":").map(Number)
            const [h2, m2] = cmd.heure_fin_nuit.split(":").map(Number)
            totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1)
          }
        })

        const heuresTotal = Math.floor(totalMinutes / 60)
        const minutesTotal = totalMinutes % 60
        heures[candidatNom] = `${heuresTotal.toString().padStart(2, "0")}:${minutesTotal.toString().padStart(2, "0")}`
      }

      setHeuresParCandidat(heures)
    }

    fetchHeures()
  }, [planning, selectedSemaine])

  const groupesParSemaine: Record<string, Record<string, Record<string, JourPlanningCandidat[]>>> = {}

  Object.entries(planning).forEach(([candidat, jours]) => {
    jours.forEach((jour) => {
      const dateObj = new Date(jour.date)
      const lundiSemaine = startOfWeek(dateObj, { weekStartsOn: 1 })
      const numeroSemaine = format(lundiSemaine, "I")
      const secteur = jour.secteur || "Inconnu"
      const keySemaineSecteur = selectedSecteurs.length === 5 ? `${numeroSemaine}_${secteur}` : numeroSemaine

      if (!groupesParSemaine[keySemaineSecteur]) groupesParSemaine[keySemaineSecteur] = {}
      if (!groupesParSemaine[keySemaineSecteur][candidat]) groupesParSemaine[keySemaineSecteur][candidat] = {}

      // ⚠️ clé de regroupement : on ne passe plus par toISOString() (UTC)
      const dateKey = String(jour.date).slice(0, 10)
      if (!groupesParSemaine[keySemaineSecteur][candidat][dateKey]) {
        groupesParSemaine[keySemaineSecteur][candidat][dateKey] = []
      }
      groupesParSemaine[keySemaineSecteur][candidat][dateKey].push(jour)
    })
  })

  const VignettePlanifiee = ({ client, hours }: { client: string; hours: string }) => (
    <div
      className="w-full h-full rounded-md px-2 pt-1.5 pb-2 flex flex-col items-start justify-center gap-1 overflow-hidden shadow-sm"
      style={{
        backgroundColor: statutColors["Validé"]?.bg,
        color: statutColors["Validé"]?.text,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
      }}
    >
      <div className="w-full min-w-0 font-bold text-[12px] leading-[1.15] truncate" title={client}>
        {compactClient(client)}
      </div>
      <div className="text-[12px] font-semibold opacity-95 leading-none">
        {hours}
      </div>
    </div>
  )

  const VignetteColor = ({ color }: { color: string }) => (
    <div
      className="w-full h-full rounded-md shadow-sm"
      style={{
        backgroundColor: color,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
      }}
    />
  )

  const VignetteEmpty = ({ onAdd }: { onAdd: () => void }) => (
    <button
      type="button"
      className="w-full h-full rounded-md relative shadow-[inset_0_0_0_1px_rgba(203,213,225,0.9)] hover:shadow-md transition"
      style={{
        backgroundColor: "#ffffff",
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0, rgba(0,0,0,0.03) 10px, transparent 10px, transparent 20px)",
      }}
      title="Ajouter une disponibilité"
      onClick={onAdd}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Plus className="w-4 h-4 text-gray-500" />
      </div>
    </button>
  )

  return (
    <>
      {dispoDialog.open && dispoDialog.date && (
        <CandidateJourneeDialog
          open={dispoDialog.open}
          onClose={closeDispo}
          date={dispoDialog.date}
          secteur={dispoDialog.secteur}
          candidatId={dispoDialog.candidatId}
          service={dispoDialog.service}
          disponibilite={dispoDialog.disponibilite}
          onSuccess={onDialogSuccess}
          candidatNomPrenom={dispoDialog.candidatNomPrenom}
          creneauVerrouille={dispoDialog.creneauVerrouille}
        />
      )}

      <TooltipProvider delayDuration={150}>
        <div className="space-y-8 mt-8 p-1 rounded-md bg-[#e5e7eb]">
          {Object.entries(groupesParSemaine).map(([keySemaineSecteur, groupes]) => {
            const [semaineStr, secteurStr] = keySemaineSecteur.split("_")
            const baseDate = startOfWeek(new Date(), { weekStartsOn: 1 })
            const diff = parseInt(semaineStr) - parseInt(format(baseDate, "I"))
            const lundiCible = addWeeks(baseDate, diff)

            // ⚠️ dateStr local, pas toISOString()
            const jours = Array.from({ length: 7 }, (_, i) => {
              const jour = new Date(lundiCible)
              jour.setDate(jour.getDate() + i)
              const dateStr = format(jour, "yyyy-MM-dd")
              return {
                date: jour,
                dateStr,
                label: jour.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "Europe/Paris",
                }),
              }
            })

            const secteurHeader =
              selectedSecteurs.length === 1
                ? selectedSecteurs[0]
                : (secteurStr && selectedSecteurs.length === 5 ? secteurStr : "")

            return (
              <div key={keySemaineSecteur} className="border rounded-lg overflow-hidden shadow-sm bg-transparent">
                <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white">
                  <div className="p-4 border-r flex flex-col items-center justify-center min-h-[64px]">
                    <div>{`Semaine ${semaineStr}`}</div>
                    {secteurHeader ? (
                      <div className="text-xs mt-1 italic">{secteurHeader}</div>
                    ) : null}
                  </div>
                  {jours.map((jour, index) => (
                    <div key={index} className="p-4 border-r text-center relative min-h-[64px]">
                      <div>{jour.label.split(" ")[0]}</div>
                      <div>{jour.label.split(" ").slice(1).join(" ")}</div>
                    </div>
                  ))}
                </div>

                <div className="p-2 space-y-2">
                  {Object.entries(groupes)
                    .sort(([a], [b]) => a.localeCompare(b, "fr", { sensitivity: "base" }))
                    .map(([key, jourMap]) => {
                      const ligne = jours.map((j) => jourMap[j.dateStr]?.[0] ?? null)
                      const disponibilites = ligne.map((j) => j?.disponibilite?.statut)
                      const hasDispo = disponibilites.includes("Dispo")

                      const premierJour = ligne.find((j) => j)
                      const secteur = premierJour?.secteur || ""
                      const candidatId =
                        premierJour?.disponibilite?.candidat_id || premierJour?.commande?.candidat_id || ""
                      const nomPrenom =
                        premierJour?.disponibilite?.candidat
                          ? `${premierJour.disponibilite.candidat.nom} ${premierJour.disponibilite.candidat.prenom}`
                          : premierJour?.commande?.candidat
                          ? `${premierJour.commande.candidat.nom} ${premierJour.commande.candidat.prenom}`
                          : key

                      const totalHeures = heuresParCandidat[key] || "00:00"
                      const isEtagesRow = secteur === "Étages"
                      const minH = isEtagesRow ? FULL_H_ETAGES : ROW_H_OTHERS

                      return (
                        <div key={key} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition">
                          <div className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] text-sm">
                            <ColonneCandidate
                              nomComplet={nomPrenom}
                              secteur={secteur}
                              semaine={semaineStr}
                              statutGlobal={hasDispo ? "Dispo" : "Non Dispo"}
                              candidatId={candidatId}
                              totalHeures={totalHeures}
                            />

                            {jours.map((jour, index) => {
                              const jourCells = jourMap[jour.dateStr] || []
                              const byId = new Map<string, CommandeFull>()

                              const rawCmds: CommandeFull[] = [
                                ...jourCells.map((j) => j.commande).filter((c): c is CommandeFull => !!c),
                                ...jourCells.flatMap((j) => (j.autresCommandes || []) as CommandeFull[]).filter(Boolean),
                              ]
                              for (const c of rawCmds) { if (c?.id) byId.set(c.id, c) }
                              const commandes: CommandeFull[] = Array.from(byId.values())

                              const valides = commandes.filter((c) => c.statut === "Validé")
                              const missionMatin = valides.find((c) => !!c.heure_debut_matin && !!c.heure_fin_matin)
                              const missionSoir  = valides.find((c) => !!c.heure_debut_soir  && !!c.heure_fin_soir)

                              const dispo = jourCells[0]?.disponibilite
                              const service = jourCells[0]?.service || ""
                              const colorDispo = disponibiliteColors["Dispo"]?.bg || "#d1d5db"
                              const colorNonDispo = disponibiliteColors["Non Dispo"]?.bg || "#6b7280"

                              // Détection Étages par cellule (sécurise le cas de ligne mal initialisée)
                              const secteurCell = jourCells[0]?.secteur || secteur
                              const isEtagesCell = secteurCell === "Étages"

                              return (
                                <div
                                  key={`${jour.dateStr}-${index}`}
                                  className="border-r p-2"
                                  style={{ minHeight: minH }}
                                >
                                  {isEtagesCell ? (
                                    <div className="w-full h-full">
                                      {missionMatin || missionSoir ? (
                                        <VignettePlanifiee
                                          client={(missionMatin || missionSoir)!.client?.nom || "Client ?"}
                                          hours={[
                                            missionMatin ? `${fmt(missionMatin.heure_debut_matin)} ${fmt(missionMatin.heure_fin_matin)}` : "",
                                            missionSoir  ? `${fmt(missionSoir.heure_debut_soir)} ${fmt(missionSoir.heure_fin_soir)}`   : ""
                                          ].filter(Boolean).join(" / ")}
                                        />
                                      ) : dispo?.matin === true ? (
                                        <VignetteColor color={colorDispo} />
                                      ) : dispo?.matin === false ? (
                                        <VignetteColor color={colorNonDispo} />
                                      ) : (
                                        <VignetteEmpty
                                          onAdd={() =>
                                            openDispo({
                                              date: jour.dateStr,
                                              secteur: secteurCell,
                                              candidatId,
                                              service,
                                              disponibilite: dispo || null,
                                              candidatNomPrenom: nomPrenom,
                                              creneauVerrouille: "matin",
                                            })
                                          }
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    <div
                                      className="grid h-full gap-[6px]"
                                      style={{ gridTemplateRows: `repeat(2, minmax(${HALF_H}px, ${HALF_H}px))` }}
                                    >
                                      {/* Matin */}
                                      <div className="w-full h-full">
                                        {missionMatin ? (
                                          <VignettePlanifiee
                                            client={missionMatin.client?.nom || "Client ?"}
                                            hours={`${fmt(missionMatin.heure_debut_matin)} ${fmt(missionMatin.heure_fin_matin)}`}
                                          />
                                        ) : dispo?.matin === true ? (
                                          <VignetteColor color={colorDispo} />
                                        ) : dispo?.matin === false ? (
                                          <VignetteColor color={colorNonDispo} />
                                        ) : (
                                          <VignetteEmpty
                                            onAdd={() =>
                                              openDispo({
                                                date: jour.dateStr,
                                                secteur: secteurCell,
                                                candidatId,
                                                service,
                                                disponibilite: dispo || null,
                                                candidatNomPrenom: nomPrenom,
                                                creneauVerrouille: "matin",
                                              })
                                            }
                                          />
                                        )}
                                      </div>

                                      {/* Soir */}
                                      <div className="w-full h-full">
                                        {missionSoir ? (
                                          <VignettePlanifiee
                                            client={missionSoir.client?.nom || "Client ?"}
                                            hours={`${fmt(missionSoir.heure_debut_soir)} ${fmt(missionSoir.heure_fin_soir)}`}
                                          />
                                        ) : dispo?.soir === true ? (
                                          <VignetteColor color={colorDispo} />
                                        ) : dispo?.soir === false ? (
                                          <VignetteColor color={colorNonDispo} />
                                        ) : (
                                          <VignetteEmpty
                                            onAdd={() =>
                                              openDispo({
                                                date: jour.dateStr,
                                                secteur: secteurCell,
                                                candidatId,
                                                service,
                                                disponibilite: dispo || null,
                                                candidatNomPrenom: nomPrenom,
                                                creneauVerrouille: "soir",
                                              })
                                            }
                                          />
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )
          })}
        </div>
      </TooltipProvider>
    </>
  )
}
