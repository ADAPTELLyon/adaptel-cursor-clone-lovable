// src/components/clients/ClientPostesTypesTab.tsx
import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"
import {
  Client,
  PosteBase,
  PosteType,
  PosteTypeInsert,
  Parametrage,
} from "@/types/types-front"
import { secteursList } from "@/lib/secteurs"

const normalize = (str: string) =>
  str.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

type Props = {
  client: Client
}

export function ClientPostesTypesTab({ client }: Props) {
  const [postesBases, setPostesBases] = useState<PosteBase[]>([])
  const [postesTypes, setPostesTypes] = useState<PosteType[]>([])
  const [tenues, setTenues] = useState<Parametrage[]>([])
  const [selectedTenues, setSelectedTenues] = useState<Record<string, Parametrage | null>>({})
  const [editingPosteType, setEditingPosteType] = useState<PosteType | null>(null)
  const [newPosteType, setNewPosteType] = useState<Partial<PosteTypeInsert>>({})
  const [posteBaseIdForTenue, setPosteBaseIdForTenue] = useState<string | null>(null)
  const [dialogSecteur, setDialogSecteur] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    fetchPostesBases()
    fetchPostesTypes()
    fetchTenues()
    fetchPostesBasesClients()
  }, [refresh])

  const fetchPostesBases = async () => {
    const { data } = await supabase.from("postes_bases").select("*")
    if (data) setPostesBases(data.map((p) => ({ ...p, actif: true })))
  }

  const fetchPostesTypes = async () => {
    const { data } = await supabase
      .from("postes_types_clients")
      .select("*")
      .eq("client_id", client.id)
    if (data) setPostesTypes(data)
  }

  const fetchTenues = async () => {
    const { data } = await supabase
      .from("parametrages")
      .select("*")
      .eq("categorie", "tenue")
    if (data) setTenues(data)
  }

  const fetchPostesBasesClients = async () => {
    const { data } = await supabase
      .from("postes_bases_clients")
      .select("poste_base_id, tenue_id, parametrages!tenue_id (id, valeur, description)")
      .eq("client_id", client.id)
    if (data) {
      const tenuesMapping: Record<string, Parametrage | null> = {}
      const postesActifs: string[] = []
      data.forEach((row: any) => {
        postesActifs.push(row.poste_base_id)
        tenuesMapping[row.poste_base_id] = row.parametrages
          ? {
              id: row.parametrages.id,
              valeur: row.parametrages.valeur,
              description: row.parametrages.description,
              categorie: "tenue",
              created_at: "",
              updated_at: "",
            }
          : null
      })
      setSelectedTenues(tenuesMapping)
      client.postes_bases_actifs = postesActifs
    }
  }

  const isPosteBaseActif = (posteId: string) =>
    client.postes_bases_actifs?.includes(posteId)

  const handleTogglePosteBase = async (posteId: string, activate: boolean) => {
    const actuels = client.postes_bases_actifs ?? []
    const updated = activate
      ? [...new Set([...actuels, posteId])]
      : actuels.filter((id) => id !== posteId)

    const { error: errClient } = await supabase
      .from("clients")
      .update({ postes_bases_actifs: updated })
      .eq("id", client.id)

    const { error: errBase } = activate
      ? await supabase.from("postes_bases_clients").upsert({ client_id: client.id, poste_base_id: posteId })
      : await supabase.from("postes_bases_clients").delete().eq("client_id", client.id).eq("poste_base_id", posteId)

    if (!errClient && !errBase) {
      client.postes_bases_actifs = updated
      toast({ title: "Poste mis à jour" })
      setRefresh((r) => r + 1)
    }
  }

  const handleSaveTenue = async (posteBaseId: string, tenue: Parametrage) => {
    const { error } = await supabase
      .from("postes_bases_clients")
      .upsert({ client_id: client.id, poste_base_id: posteBaseId, tenue_id: tenue.id })
    if (!error) {
      toast({ title: "Tenue assignée" })
      setPosteBaseIdForTenue(null)
      setRefresh((r) => r + 1)
    }
  }

  const handleSavePosteType = async () => {
    if (!editingPosteType || !newPosteType.nom) return
    const hasCreneau =
      newPosteType.heure_debut_matin ||
      newPosteType.heure_fin_matin ||
      newPosteType.heure_debut_soir ||
      newPosteType.heure_fin_soir

    if (!hasCreneau) {
      toast({ title: "Veuillez renseigner au moins un créneau" })
      return
    }

    const data: PosteTypeInsert = {
      client_id: client.id,
      poste_base_id: editingPosteType.poste_base_id,
      nom: newPosteType.nom,
      heure_debut_matin: newPosteType.heure_debut_matin ?? null,
      heure_fin_matin: newPosteType.heure_fin_matin ?? null,
      heure_debut_soir: newPosteType.heure_debut_soir ?? null,
      heure_fin_soir: newPosteType.heure_fin_soir ?? null,
      repas_fournis: newPosteType.repas_fournis ?? false,
      temps_pause_minutes: newPosteType.temps_pause_minutes || null,
    }

    const res = editingPosteType.id
      ? await supabase.from("postes_types_clients").update(data).eq("id", editingPosteType.id)
      : await supabase.from("postes_types_clients").insert([data])

    if (!res.error) {
      toast({ title: "Poste type enregistré" })
      setEditingPosteType(null)
      setNewPosteType({})
      setRefresh((r) => r + 1)
    }
  }

  const postesParSecteur = (secteur: string) =>
    postesBases.filter((pb) => normalize(pb.secteur) === normalize(secteur))

  const postesTypesParPosteBase = (posteBaseId: string) =>
    postesTypes.filter((pt) => pt.poste_base_id === posteBaseId)

  return (
    <>
      {/* Vignettes secteurs avec bouton gérer */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {client.secteurs.map((secteur) => {
          const info = secteursList.find((s) => s.value === secteur)
          const postesActifs = postesParSecteur(secteur).filter((p) => isPosteBaseActif(p.id))
          return (
            <Card key={secteur}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {info?.icon && <info.icon className="w-5 h-5" />}
                  {info?.label ?? secteur}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {postesActifs.map((p) => (
                  <div key={p.id} className="text-sm text-muted-foreground">{p.nom}</div>
                ))}
                <Button onClick={() => setDialogSecteur(secteur)} className="bg-[#840404] text-white">
                  Gérer
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Dialog de gestion des postes */}
      <Dialog open={!!dialogSecteur} onOpenChange={() => setDialogSecteur(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gérer les postes – {dialogSecteur}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {postesParSecteur(dialogSecteur || "").map((poste) => {
              const isActive = isPosteBaseActif(poste.id)
              const types = postesTypesParPosteBase(poste.id)
              const tenue = selectedTenues[poste.id]

              return (
                <div key={poste.id} className="border p-4 rounded space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>{poste.nom}</Label>
                    <Switch checked={isActive} onCheckedChange={(v) => handleTogglePosteBase(poste.id, v)} />
                  </div>

                  {isActive && (
                    <>
                      <div>
                        <Label className="block mb-2">Tenue</Label>
                        {tenue ? (
                          <div className="bg-gray-50 p-2 rounded mb-2">
                            <p className="font-medium">{tenue.valeur}</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {tenue.description}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm italic text-muted-foreground mb-2">
                            Aucune tenue sélectionnée.
                          </p>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPosteBaseIdForTenue(poste.id)}
                        >
                          {tenue ? "Modifier la tenue" : "Ajouter une tenue"}
                        </Button>
                      </div>

                      {types.map((pt) => (
                        <div key={pt.id} className="flex justify-between items-center p-2 border rounded bg-white">
                          <div>
                            <span className="text-sm font-medium">{pt.nom}</span>
                            <div className="text-xs text-muted-foreground mt-1">
                              {pt.heure_debut_matin?.slice(0, 5)} – {pt.heure_fin_matin?.slice(0, 5)}
                              {pt.heure_debut_soir && ` | ${pt.heure_debut_soir.slice(0, 5)} – ${pt.heure_fin_soir?.slice(0, 5)}`}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingPosteType(pt)
                                setNewPosteType(pt)
                              }}
                            >
                              Modifier
                            </Button>
                          </div>
                        </div>
                      ))}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingPosteType({ poste_base_id: poste.id, client_id: client.id } as PosteType)
                          setNewPosteType({})
                        }}
                      >
                        ➕ Ajouter un poste type
                      </Button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog sélection tenue */}
      <Dialog open={!!posteBaseIdForTenue} onOpenChange={() => setPosteBaseIdForTenue(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choisir une tenue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {tenues.map((tenue) => (
              <div key={tenue.id} className="border p-3 rounded flex justify-between items-center">
                <div className="flex-1 pr-4">
                  <p className="font-medium">{tenue.valeur}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tenue.description}</p>
                </div>
                <Button size="sm" onClick={() => handleSaveTenue(posteBaseIdForTenue!, tenue)}>Sélectionner</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog création/modification poste type */}
      <Dialog open={!!editingPosteType} onOpenChange={() => setEditingPosteType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPosteType?.id ? "Modifier" : "Créer"} un poste type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nom du poste type"
              value={newPosteType.nom || ""}
              onChange={(e) => setNewPosteType((prev) => ({ ...prev, nom: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input type="time" value={newPosteType.heure_debut_matin || ""} onChange={(e) => setNewPosteType((prev) => ({ ...prev, heure_debut_matin: e.target.value }))} />
              <Input type="time" value={newPosteType.heure_fin_matin || ""} onChange={(e) => setNewPosteType((prev) => ({ ...prev, heure_fin_matin: e.target.value }))} />
              <Input type="time" value={newPosteType.heure_debut_soir || ""} onChange={(e) => setNewPosteType((prev) => ({ ...prev, heure_debut_soir: e.target.value }))} />
              <Input type="time" value={newPosteType.heure_fin_soir || ""} onChange={(e) => setNewPosteType((prev) => ({ ...prev, heure_fin_soir: e.target.value }))} />
            </div>
            <Input
              type="time"
              placeholder="Temps de pause"
              value={newPosteType.temps_pause_minutes || ""}
              onChange={(e) => setNewPosteType((prev) => ({ ...prev, temps_pause_minutes: e.target.value }))}
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={newPosteType.repas_fournis ?? false}
                onCheckedChange={(v) => setNewPosteType((prev) => ({ ...prev, repas_fournis: v }))}
              />
              <Label>Repas fournis</Label>
            </div>
            <Button onClick={handleSavePosteType}>Valider</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
