import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import {
  Client,
  PosteBase,
  PosteType,
  PosteTypeInsert,
  Parametrage,
} from "@/types/types-front"
import { secteursList } from "@/lib/secteurs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import {
  PlusCircle,
  Edit2,
  Trash2,
  Check,
  Layers,
  Info,
  List,
  FileText,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const normalize = (str: string) =>
  (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

type Props = {
  client: Client
  onDirtyChange?: (dirty: boolean) => void
}

const sbAny = supabase as any

type ClientSecteurParamsRow = {
  id: string
  client_id: string
  secteur: string
  tenue_id: string | null
  temps_pause: string | null
  repas_fournis: boolean | null
  parametrages?: { id: string; valeur: string; description: string | null } | null
}

type SectorParamsState = {
  id?: string
  tenue: Parametrage | null
  temps_pause: string
  repas_fournis: boolean | null
}

function fmtTimeHHMM(value: string | null | undefined) {
  if (!value) return ""
  return String(value).slice(0, 5)
}

function intervalToHHMM(value: string | null | undefined) {
  if (!value) return ""
  const s = String(value)
  const parts = s.split(":")
  if (parts.length < 2) return ""
  const hh = String(parts[0]).padStart(2, "0")
  const mm = String(parts[1]).padStart(2, "0")
  return `${hh}:${mm}`
}

function hhmmToInterval(hhmm: string | null | undefined) {
  const v = (hhmm || "").trim()
  if (!v) return null
  const parts = v.split(":")
  if (parts.length < 2) return null
  const hh = String(parts[0]).padStart(2, "0")
  const mm = String(parts[1]).padStart(2, "0")
  return `${hh}:${mm}:00`
}

function uiFromBoolNullable(v: boolean | null | undefined): string {
  if (v === true) return "true"
  if (v === false) return "false"
  return "null"
}
function safeBoolNullableFromUi(v: string): boolean | null {
  if (v === "true") return true
  if (v === "false") return false
  return null
}

function getSecteurInfo(secteurValue: string) {
  const s = secteursList.find((x) => normalize(x.value) === normalize(secteurValue))
  return {
    label: s?.label ?? secteurValue,
    Icon: (s?.icon as any) || Layers,
  }
}

/**
 * ✅ Ajustement demandé : bandeau secteur identique pour toutes les vignettes
 * -> Gris foncé
 */
function getSecteurHeaderTone(_secteurValue: string) {
  return "bg-gray-800 text-white"
}

export type ClientPostesTypesTabRef = {
  hasUnsavedChanges: () => boolean
  save: () => Promise<boolean>
  reset: () => Promise<void>
}

export const ClientPostesTypesTab = forwardRef<ClientPostesTypesTabRef, Props>(
  function ClientPostesTypesTab({ client, onDirtyChange }, ref) {
    const [postesBases, setPostesBases] = useState<PosteBase[]>([])
    const [postesTypes, setPostesTypes] = useState<PosteType[]>([])
    const [loading, setLoading] = useState(false)

    const [tenues, setTenues] = useState<Parametrage[]>([])
    const [postesActifs, setPostesActifs] = useState<string[]>([])

    const [sectorParams, setSectorParams] = useState<Record<string, SectorParamsState>>({})

    // Dirty tracking (UNIQUEMENT Infos générales)
    const [dirtySecteurs, setDirtySecteurs] = useState<Set<string>>(new Set())

    // Dialog Poste type
    const [currentPosteBaseId, setCurrentPosteBaseId] = useState<string | null>(null)
    const [currentPosteTypeEdit, setCurrentPosteTypeEdit] = useState<PosteType | null>(null)
    const [newPosteTypeData, setNewPosteTypeData] = useState<Partial<PosteTypeInsert>>({})

    useEffect(() => {
      const fetchData = async () => {
        await fetchPostesBases()
        await fetchPostesTypes()
        await fetchTenues()
        await fetchPostesBasesClients()
        await fetchClientsSecteursParams()
        setDirtySecteurs(new Set())
        onDirtyChange?.(false)
      }
      fetchData()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client.id])

    const fetchPostesBases = async () => {
      const { data } = await supabase.from("postes_bases").select("*")
      if (data) {
        setPostesBases(
          data.map((item: any) => ({
            id: item.id,
            nom: item.nom,
            secteur: item.secteur,
            created_at: item.created_at,
            actif: true,
          }))
        )
      }
    }

    const fetchPostesTypes = async () => {
      if (!client.id) return
      const { data } = await supabase
        .from("postes_types_clients")
        .select("*")
        .eq("client_id", client.id)
      if (data) setPostesTypes(data as any)
    }

    const fetchTenues = async () => {
      const { data } = await supabase
        .from("parametrages")
        .select("*")
        .eq("categorie", "tenue")
      if (data) setTenues(data as any)
    }

    const fetchPostesBasesClients = async () => {
      if (!client.id) return
      const { data } = await supabase
        .from("postes_bases_clients")
        .select("poste_base_id, tenue_id")
        .eq("client_id", client.id)

      if (data) setPostesActifs((data as any[]).map((x) => x.poste_base_id))
    }

    const fetchClientsSecteursParams = async () => {
      if (!client.id) return
      try {
        const { data, error } = await sbAny
          .from("clients_secteurs_params")
          .select(
            "id, client_id, secteur, tenue_id, temps_pause, repas_fournis, parametrages!tenue_id (id, valeur, description)"
          )
          .eq("client_id", client.id)

        if (error) return

        const next: Record<string, SectorParamsState> = {}
        ;((data || []) as ClientSecteurParamsRow[]).forEach((row) => {
          next[row.secteur] = {
            id: row.id,
            tenue: row.parametrages
              ? {
                  id: row.parametrages.id,
                  valeur: row.parametrages.valeur,
                  description: row.parametrages.description,
                  categorie: "tenue",
                }
              : null,
            temps_pause: intervalToHHMM(row.temps_pause),
            repas_fournis: row.repas_fournis ?? null,
          }
        })
        setSectorParams(next)
      } catch {
        // no-op
      }
    }

    const postesParSecteur = (secteur: string) =>
      postesBases.filter((pb) => normalize(pb.secteur) === normalize(secteur))

    const postesTypesParPosteBase = (posteBaseId: string) =>
      postesTypes.filter((pt: any) => pt.poste_base_id === posteBaseId)

    const posteBaseById = useMemo(() => {
      const map = new Map<string, PosteBase>()
      postesBases.forEach((pb) => map.set(pb.id, pb))
      return map
    }, [postesBases])

    const tenueById = useMemo(() => {
      const map = new Map<string, Parametrage>()
      tenues.forEach((t) => map.set(t.id, t))
      return map
    }, [tenues])

    const markDirty = (secteur: string) => {
      setDirtySecteurs((prev) => {
        const next = new Set(prev)
        next.add(secteur)
        return next
      })
      onDirtyChange?.(true)
    }

    const hasUnsavedChanges = () => dirtySecteurs.size > 0

    const saveInfosGenerales = async (): Promise<boolean> => {
      if (!client.id) return true
      if (dirtySecteurs.size === 0) return true

      setLoading(true)
      try {
        const secteursToSave = Array.from(dirtySecteurs)
        const ops = secteursToSave.map((secteur) => {
          const p = sectorParams[secteur] || { tenue: null, temps_pause: "", repas_fournis: null }
          const payload = {
            client_id: client.id,
            secteur,
            tenue_id: p.tenue?.id ?? null,
            temps_pause: hhmmToInterval(p.temps_pause),
            repas_fournis: p.repas_fournis ?? null,
            updated_at: new Date().toISOString(),
          }
          return sbAny.from("clients_secteurs_params").upsert(payload, { onConflict: "client_id,secteur" })
        })

        const results = await Promise.all(ops)
        const anyError = results.some((r: any) => r?.error)
        if (anyError) {
          toast({
            title: "Erreur",
            description: "Impossible d'enregistrer les infos générales.",
            variant: "destructive",
          })
          return false
        }

        toast({ title: "Succès", description: "Infos générales enregistrées." })
        setDirtySecteurs(new Set())
        onDirtyChange?.(false)
        await fetchClientsSecteursParams()
        return true
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible d'enregistrer les infos générales.",
          variant: "destructive",
        })
        return false
      } finally {
        setLoading(false)
      }
    }

    const reset = async () => {
      await fetchClientsSecteursParams()
      setDirtySecteurs(new Set())
      onDirtyChange?.(false)
    }

    useImperativeHandle(
      ref,
      () => ({
        hasUnsavedChanges,
        save: saveInfosGenerales,
        reset,
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [dirtySecteurs, sectorParams, client.id]
    )

    const handleTogglePosteBase = async (posteBaseId: string, isActive: boolean) => {
      if (!client.id) return
      setLoading(true)
      try {
        if (isActive) {
          const { error } = await supabase.from("postes_bases_clients").upsert({
            client_id: client.id,
            poste_base_id: posteBaseId,
            tenue_id: null,
          })
          if (!error) {
            setPostesActifs((prev) => [...prev, posteBaseId])
            toast({ title: "Succès", description: "Poste activé." })
            await fetchPostesBasesClients()
          }
        } else {
          await supabase
            .from("postes_types_clients")
            .delete()
            .eq("client_id", client.id)
            .eq("poste_base_id", posteBaseId)

          const { error } = await supabase
            .from("postes_bases_clients")
            .delete()
            .eq("client_id", client.id)
            .eq("poste_base_id", posteBaseId)

          if (!error) {
            setPostesActifs((prev) => prev.filter((id) => id !== posteBaseId))
            toast({ title: "Succès", description: "Poste désactivé." })
            await fetchPostesTypes()
            await fetchPostesBasesClients()
          }
        }
      } catch {
        toast({ title: "Erreur", description: "Une erreur est survenue", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }

    const openCreatePosteType = (posteBaseId: string) => {
      setCurrentPosteBaseId(posteBaseId)
      setCurrentPosteTypeEdit({ poste_base_id: posteBaseId, client_id: client.id } as PosteType)
      setNewPosteTypeData({
        nom: "",
        heure_debut_matin: "",
        heure_fin_matin: "",
        heure_debut_soir: "",
        heure_fin_soir: "",
        temps_pause_minutes: "",
        repas_fournis: null,
      } as any)
    }

    const openEditPosteType = (pt: PosteType) => {
      const pbId = (pt as any).poste_base_id as string
      setCurrentPosteBaseId(pbId)
      setCurrentPosteTypeEdit(pt)
      setNewPosteTypeData({
        ...pt,
        heure_debut_matin: fmtTimeHHMM((pt as any).heure_debut_matin),
        heure_fin_matin: fmtTimeHHMM((pt as any).heure_fin_matin),
        heure_debut_soir: fmtTimeHHMM((pt as any).heure_debut_soir),
        heure_fin_soir: fmtTimeHHMM((pt as any).heure_fin_soir),
        temps_pause_minutes: fmtTimeHHMM((pt as any).temps_pause_minutes),
        repas_fournis: (pt as any).repas_fournis ?? null,
      } as any)
    }

    const handleSavePosteType = async () => {
      if (!client.id || !currentPosteBaseId || !newPosteTypeData.nom?.trim()) {
        toast({ title: "Erreur", description: "Le nom du poste est requis", variant: "destructive" })
        return
      }

      const pb = posteBaseById.get(currentPosteBaseId)
      const isEtages = normalize(pb?.secteur || "") === normalize("Étages")

      setLoading(true)
      try {
        let tempsPauseFormatted: string | null = null
        if (newPosteTypeData.temps_pause_minutes) {
          const v = String(newPosteTypeData.temps_pause_minutes)
          const parts = v.split(":")
          if (parts.length >= 2) {
            const hh = String(parts[0]).padStart(2, "0")
            const mm = String(parts[1]).padStart(2, "0")
            tempsPauseFormatted = `${hh}:${mm}:00`
          }
        }

        const dataToSave: PosteTypeInsert = {
          client_id: client.id,
          poste_base_id: currentPosteBaseId,
          nom: String(newPosteTypeData.nom).trim(),
          heure_debut_matin: (newPosteTypeData.heure_debut_matin as any) || null,
          heure_fin_matin: (newPosteTypeData.heure_fin_matin as any) || null,
          heure_debut_soir: isEtages ? null : ((newPosteTypeData.heure_debut_soir as any) || null),
          heure_fin_soir: isEtages ? null : ((newPosteTypeData.heure_fin_soir as any) || null),
          repas_fournis: (newPosteTypeData.repas_fournis as any) ?? null,
          temps_pause_minutes: tempsPauseFormatted as any,
        } as any

        if (currentPosteTypeEdit?.id) {
          await supabase.from("postes_types_clients").update(dataToSave as any).eq("id", currentPosteTypeEdit.id)
        } else {
          await supabase.from("postes_types_clients").insert([dataToSave as any])
        }

        toast({ title: "Succès", description: "Poste type enregistré." })
        setCurrentPosteTypeEdit(null)
        setNewPosteTypeData({})
        await fetchPostesTypes()
      } catch {
        toast({ title: "Erreur", description: "Une erreur est survenue", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }

    const handleDeletePosteType = async (posteTypeId: string) => {
      setLoading(true)
      try {
        const { error } = await supabase.from("postes_types_clients").delete().eq("id", posteTypeId)
        if (!error) {
          toast({ title: "Supprimé", description: "Poste type supprimé." })
          await fetchPostesTypes()
        }
      } catch {
        toast({ title: "Erreur", description: "Une erreur est survenue", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }

    if (!client.secteurs?.length) {
      return <p className="text-sm italic text-muted-foreground">Aucun secteur n'est défini pour ce client.</p>
    }

    return (
      <div className="space-y-4">
        {client.secteurs.map((secteurClient) => {
          const { label, Icon } = getSecteurInfo(secteurClient)
          const headerTone = getSecteurHeaderTone(secteurClient)

          const postesDuSecteur = postesParSecteur(secteurClient)
          const params = sectorParams[secteurClient] || { tenue: null, temps_pause: "", repas_fournis: null }
          const isEtages = normalize(secteurClient) === normalize("Étages")

          return (
            <Card key={secteurClient} className="overflow-hidden border-2 border-muted-foreground/20 shadow-sm">
              {/* ✅ Bandeau secteur uniforme gris foncé */}
              <div className={`px-4 py-3 border-b ${headerTone}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-5 h-5 shrink-0" />
                    <div className="font-semibold truncate">{label}</div>
                  </div>

                  <Badge variant="outline" className="bg-white/10 border-white/20 text-white">
                    {postesDuSecteur.length} poste{postesDuSecteur.length > 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>

              <CardContent className="space-y-6 p-4">
                {/* INFOS GÉNÉRALES */}
                <div className="rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-white shadow-sm">
                  <div className="bg-gray-100 border-b px-4 py-3 rounded-t-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 bg-[#840404] rounded-full"></div>
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-gray-600" />
                        <span className="font-semibold text-gray-800">Infos générales</span>
                      </div>
                      {dirtySecteurs.has(secteurClient) && (
                        <span className="ml-2 text-xs font-medium text-orange-700 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded">
                          Modifié
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Tenue</Label>
                        <select
                          className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                          value={params.tenue?.id || ""}
                          onChange={(e) => {
                            const id = e.target.value || ""
                            const tenue = id ? tenueById.get(id) || null : null
                            setSectorParams((prev) => ({
                              ...prev,
                              [secteurClient]: { ...params, tenue },
                            }))
                            markDirty(secteurClient)
                          }}
                          disabled={loading}
                        >
                          <option value="">— Non précisé —</option>
                          {tenues.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.valeur}
                            </option>
                          ))}
                        </select>
                        {params.tenue?.description ? (
                          <div className="text-xs text-gray-500 mt-1">{params.tenue.description}</div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Pause (durée)</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="HH:MM"
                          value={params.temps_pause || ""}
                          onChange={(e) => {
                            setSectorParams((prev) => ({
                              ...prev,
                              [secteurClient]: { ...params, temps_pause: e.target.value },
                            }))
                            markDirty(secteurClient)
                          }}
                          disabled={loading}
                          className="h-10"
                        />
                        <div className="text-xs text-gray-500">Format: HH:MM (ex: 00:30)</div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Repas</Label>
                        <select
                          className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                          value={uiFromBoolNullable(params.repas_fournis)}
                          onChange={(e) => {
                            setSectorParams((prev) => ({
                              ...prev,
                              [secteurClient]: {
                                ...params,
                                repas_fournis: safeBoolNullableFromUi(e.target.value),
                              },
                            }))
                            markDirty(secteurClient)
                          }}
                          disabled={loading}
                        >
                          <option value="null">Non précisé</option>
                          <option value="true">Oui</option>
                          <option value="false">Non</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="my-2" />

                {/* POSTES DE BASE */}
                <div className="rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-white shadow-sm">
                  <div className="bg-gray-100 border-b px-4 py-3 rounded-t-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 bg-[#840404] rounded-full"></div>
                      <div className="flex items-center gap-2">
                        <List className="h-4 w-4 text-gray-600" />
                        <span className="font-semibold text-gray-800">Postes de base</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {postesDuSecteur.length === 0 ? (
                      <p className="text-sm text-gray-500 italic py-4 text-center">Aucun poste disponible</p>
                    ) : (
                      <div className="space-y-3">
                        {postesDuSecteur.map((poste) => {
                          const active = postesActifs.includes(poste.id)
                          return (
                            <div
                              key={poste.id}
                              className="rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 flex-1">
                                  <Switch
                                    checked={active}
                                    onCheckedChange={(checked) => handleTogglePosteBase(poste.id, checked)}
                                    disabled={loading}
                                    className="data-[state=checked]:bg-[#840404]"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-medium text-gray-900 truncate">{poste.nom}</div>

                                    {/* ✅ Ajustement demandé : badges moins arrondis */}
                                    <div className="text-xs text-gray-500 mt-1">
                                      {active ? (
                                        <Badge className="bg-green-100 text-green-800 border-green-200 rounded-md px-2 py-0.5">
                                          Actif
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-gray-500 rounded-md px-2 py-0.5">
                                          Inactif
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <Separator className="my-2" />

                {/* POSTES TYPES */}
                <div className="rounded-lg border border-gray-200 bg-gradient-to-r from-gray-50 to-white shadow-sm">
                  <div className="bg-gray-100 border-b px-4 py-3 rounded-t-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 bg-[#840404] rounded-full"></div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-600" />
                        <span className="font-semibold text-gray-800">Postes types</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="max-h-[320px] overflow-y-auto pr-2 space-y-4">
                      {postesDuSecteur
                        .filter((pb) => postesActifs.includes(pb.id))
                        .map((pb) => {
                          const pts = postesTypesParPosteBase(pb.id)

                          return (
                            <div key={pb.id} className="rounded-lg border border-gray-200 bg-white p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div>
                                  <div className="font-semibold text-gray-900">{pb.nom}</div>
                                  <div className="text-xs text-gray-500">
                                    {pts.length} poste{pts.length > 1 ? "s" : ""} type{pts.length > 1 ? "s" : ""}
                                  </div>
                                </div>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2 border-[#840404] text-[#840404] hover:bg-[#840404]/10"
                                  onClick={() => openCreatePosteType(pb.id)}
                                  disabled={loading}
                                >
                                  <PlusCircle className="h-4 w-4" />
                                  Ajouter
                                </Button>
                              </div>

                              {pts.length === 0 ? (
                                <div className="text-sm text-gray-500 italic py-3 text-center border border-dashed border-gray-300 rounded-lg">
                                  Aucun poste type défini
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {pts.map((pt: any) => (
                                    <div key={pt.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-gray-900 mb-2">{pt.nom}</div>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                            <div className="bg-white p-2 rounded border">
                                              <div className="text-gray-500">Matin</div>
                                              <div className="font-medium">
                                                {fmtTimeHHMM(pt.heure_debut_matin) || "--:--"} -{" "}
                                                {fmtTimeHHMM(pt.heure_fin_matin) || "--:--"}
                                              </div>
                                            </div>

                                            {!isEtages ? (
                                              <div className="bg-white p-2 rounded border">
                                                <div className="text-gray-500">Soir</div>
                                                <div className="font-medium">
                                                  {fmtTimeHHMM(pt.heure_debut_soir) || "--:--"} -{" "}
                                                  {fmtTimeHHMM(pt.heure_fin_soir) || "--:--"}
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="bg-white p-2 rounded border">
                                                <div className="text-gray-500">Soir</div>
                                                <div className="font-medium">—</div>
                                              </div>
                                            )}

                                            <div className="bg-white p-2 rounded border">
                                              <div className="text-gray-500">Pause</div>
                                              <div className="font-medium">{fmtTimeHHMM(pt.temps_pause_minutes) || "—"}</div>
                                            </div>

                                            <div className="bg-white p-2 rounded border">
                                              <div className="text-gray-500">Repas</div>
                                              <div className="font-medium">
                                                {pt.repas_fournis === true
                                                  ? "Oui"
                                                  : pt.repas_fournis === false
                                                  ? "Non"
                                                  : "Non précisé"}
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex gap-1 shrink-0">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 text-gray-600 hover:text-[#840404]"
                                            onClick={() => openEditPosteType(pt)}
                                            disabled={loading}
                                          >
                                            <Edit2 className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 text-gray-600 hover:text-red-600"
                                            onClick={() => handleDeletePosteType(pt.id)}
                                            disabled={loading}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}

                      {postesDuSecteur.filter((pb) => postesActifs.includes(pb.id)).length === 0 ? (
                        <div className="text-sm text-gray-500 italic py-4 text-center border border-dashed border-gray-300 rounded-lg">
                          Active au moins un poste de base pour gérer les postes types.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardHeader className="hidden">
                <CardTitle />
              </CardHeader>
            </Card>
          )
        })}

        {currentPosteTypeEdit && currentPosteBaseId && (
          <Dialog open={!!currentPosteTypeEdit} onOpenChange={(open) => !open && setCurrentPosteTypeEdit(null)}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{currentPosteTypeEdit.id ? "Modifier le poste type" : "Créer un poste type"}</DialogTitle>
              </DialogHeader>

              {(() => {
                const pb = posteBaseById.get(currentPosteBaseId)
                const etages = normalize(pb?.secteur || "") === normalize("Étages")

                return (
                  <div className="space-y-4">
                    <div>
                      <Label>Nom du poste *</Label>
                      <Input
                        value={(newPosteTypeData.nom as any) || ""}
                        onChange={(e) => setNewPosteTypeData({ ...newPosteTypeData, nom: e.target.value } as any)}
                        placeholder="Ex: Chef de partie"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Heure début matin</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="--:--"
                          value={(newPosteTypeData.heure_debut_matin as any) || ""}
                          onChange={(e) =>
                            setNewPosteTypeData({ ...newPosteTypeData, heure_debut_matin: e.target.value } as any)
                          }
                        />
                      </div>
                      <div>
                        <Label>Heure fin matin</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="--:--"
                          value={(newPosteTypeData.heure_fin_matin as any) || ""}
                          onChange={(e) =>
                            setNewPosteTypeData({ ...newPosteTypeData, heure_fin_matin: e.target.value } as any)
                          }
                        />
                      </div>
                    </div>

                    {!etages && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Heure début soir</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="--:--"
                            value={(newPosteTypeData.heure_debut_soir as any) || ""}
                            onChange={(e) =>
                              setNewPosteTypeData({ ...newPosteTypeData, heure_debut_soir: e.target.value } as any)
                            }
                          />
                        </div>
                        <div>
                          <Label>Heure fin soir</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="--:--"
                            value={(newPosteTypeData.heure_fin_soir as any) || ""}
                            onChange={(e) =>
                              setNewPosteTypeData({ ...newPosteTypeData, heure_fin_soir: e.target.value } as any)
                            }
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Temps de pause</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="--:--"
                          value={(newPosteTypeData.temps_pause_minutes as any) || ""}
                          onChange={(e) =>
                            setNewPosteTypeData({ ...newPosteTypeData, temps_pause_minutes: e.target.value } as any)
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <Label>Repas</Label>
                        <select
                          className="w-full h-10 rounded-md border border-gray-300 bg-white px-2 text-sm"
                          value={uiFromBoolNullable(newPosteTypeData.repas_fournis as any)}
                          onChange={(e) =>
                            setNewPosteTypeData({
                              ...newPosteTypeData,
                              repas_fournis: safeBoolNullableFromUi(e.target.value),
                            } as any)
                          }
                        >
                          <option value="null">Non précisé</option>
                          <option value="true">Oui</option>
                          <option value="false">Non</option>
                        </select>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="outline" onClick={() => setCurrentPosteTypeEdit(null)} disabled={loading}>
                        Annuler
                      </Button>
                      <Button onClick={handleSavePosteType} disabled={loading} className="gap-2 bg-[#840404] hover:bg-[#6a0303]">
                        <Check className="h-4 w-4" />
                        {loading ? "Enregistrement..." : "Enregistrer"}
                      </Button>
                    </div>
                  </div>
                )
              })()}
            </DialogContent>
          </Dialog>
        )}
      </div>
    )
  }
)
