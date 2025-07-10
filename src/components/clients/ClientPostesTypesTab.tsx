import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/integrations/supabase/client"
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
  Clock,
  Utensils,
  Shirt
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const normalize = (str: string) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

type Props = {
  client: Client
}

export function ClientPostesTypesTab({ client }: Props) {
  const [postesBases, setPostesBases] = useState<PosteBase[]>([])
  const [postesTypes, setPostesTypes] = useState<PosteType[]>([])
  const [loading, setLoading] = useState(false)
  const [tenues, setTenues] = useState<Parametrage[]>([])
  const [selectedTenues, setSelectedTenues] = useState<Record<string, Parametrage | null>>({})
  const [postesActifs, setPostesActifs] = useState<string[]>([])
  
  // États pour les dialogues
  const [currentPosteBaseId, setCurrentPosteBaseId] = useState<string | null>(null)
  const [currentTenueDialog, setCurrentTenueDialog] = useState<string | null>(null)
  const [currentPosteTypeEdit, setCurrentPosteTypeEdit] = useState<PosteType | null>(null)
  const [newPosteTypeData, setNewPosteTypeData] = useState<Partial<PosteTypeInsert>>({})

  useEffect(() => {
    const fetchData = async () => {
      await fetchPostesBases()
      await fetchPostesTypes()
      await fetchTenues()
      await fetchPostesBasesClients()
    }
    fetchData()
  }, [client.id])

  const fetchPostesBases = async () => {
    const { data } = await supabase.from("postes_bases").select("*")
    if (data) {
      setPostesBases(data.map(item => ({
        id: item.id,
        nom: item.nom,
        secteur: item.secteur,
        created_at: item.created_at,
        actif: true
      })))
    }
  }

  const fetchPostesTypes = async () => {
    if (!client.id) return
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
    if (!client.id) return
    const { data } = await supabase
      .from("postes_bases_clients")
      .select("poste_base_id, tenue_id, parametrages!tenue_id (id, valeur, description)")
      .eq("client_id", client.id)
    
    if (data) {
      const actifs = data.map(item => item.poste_base_id)
      setPostesActifs(actifs)

      const mapping: Record<string, Parametrage | null> = {}
      data.forEach(row => {
        mapping[row.poste_base_id] = row.parametrages ? {
          id: row.parametrages.id,
          valeur: row.parametrages.valeur,
          description: row.parametrages.description,
          categorie: "tenue",
        } : null
      })
      setSelectedTenues(mapping)
    }
  }

  const handleTogglePosteBase = async (posteBaseId: string, isActive: boolean) => {
    if (!client.id) return
    setLoading(true)

    try {
      if (isActive) {
        const { error } = await supabase
          .from("postes_bases_clients")
          .upsert({
            client_id: client.id,
            poste_base_id: posteBaseId,
            tenue_id: null
          })
        
        if (!error) {
          setPostesActifs(prev => [...prev, posteBaseId])
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
          setPostesActifs(prev => prev.filter(id => id !== posteBaseId))
          setSelectedTenues(prev => {
            const newState = {...prev}
            delete newState[posteBaseId]
            return newState
          })
          toast({ title: "Succès", description: "Poste désactivé." })
          await fetchPostesTypes()
          await fetchPostesBasesClients()
        }
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTenue = async (posteBaseId: string, tenue: Parametrage) => {
    if (!client.id) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from("postes_bases_clients")
        .upsert({
          client_id: client.id,
          poste_base_id: posteBaseId,
          tenue_id: tenue.id,
        })
      if (!error) {
        toast({ title: "Succès", description: "Tenue assignée." })
        setSelectedTenues(prev => ({ ...prev, [posteBaseId]: tenue }))
        setCurrentTenueDialog(null)
        await fetchPostesBasesClients()
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSavePosteType = async () => {
    if (!client.id || !currentPosteBaseId || !newPosteTypeData.nom?.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom du poste est requis",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // Formatage du temps de pause en HH:MM
      let tempsPauseFormatted = null
      if (newPosteTypeData.temps_pause_minutes) {
        const [hours, minutes] = newPosteTypeData.temps_pause_minutes.split(':')
        tempsPauseFormatted = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`
      }

      const dataToSave: PosteTypeInsert = {
        client_id: client.id,
        poste_base_id: currentPosteBaseId,
        nom: newPosteTypeData.nom,
        heure_debut_matin: newPosteTypeData.heure_debut_matin || null,
        heure_fin_matin: newPosteTypeData.heure_fin_matin || null,
        heure_debut_soir: newPosteTypeData.heure_debut_soir || null,
        heure_fin_soir: newPosteTypeData.heure_fin_soir || null,
        repas_fournis: newPosteTypeData.repas_fournis ?? false,
        temps_pause_minutes: tempsPauseFormatted,
      }

      if (currentPosteTypeEdit?.id) {
        await supabase
          .from("postes_types_clients")
          .update(dataToSave)
          .eq("id", currentPosteTypeEdit.id)
      } else {
        await supabase
          .from("postes_types_clients")
          .insert([dataToSave])
      }
      
      toast({ title: "Succès", description: "Poste type enregistré." })
      setCurrentPosteTypeEdit(null)
      setNewPosteTypeData({})
      await fetchPostesTypes()
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePosteType = async (posteTypeId: string) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from("postes_types_clients")
        .delete()
        .eq("id", posteTypeId)

      if (!error) {
        toast({ title: "Supprimé", description: "Poste type supprimé." })
        await fetchPostesTypes()
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const postesParSecteur = (secteur: string) =>
    postesBases.filter(pb => normalize(pb.secteur) === normalize(secteur))

  const postesTypesParPosteBase = (posteBaseId: string) =>
    postesTypes.filter(pt => pt.poste_base_id === posteBaseId)

  if (!client.secteurs?.length) {
    return <p className="text-sm italic text-muted-foreground">Aucun secteur n'est défini pour ce client.</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {client.secteurs.map(secteurClient => {
          const secteurInfo = secteursList.find(s => normalize(s.value) === normalize(secteurClient))
          const postesDuSecteur = postesParSecteur(secteurClient)

          return (
            <Card key={secteurClient}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {secteurInfo && <secteurInfo.icon className="w-5 h-5" />}
                    <span>{secteurInfo?.label ?? secteurClient}</span>
                  </CardTitle>
                  <Badge variant="outline">
                    {postesDuSecteur.length} poste{postesDuSecteur.length > 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {postesDuSecteur.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Aucun poste disponible</p>
                ) : (
                  <div className="space-y-4">
                    {postesDuSecteur.map(poste => (
                      <div key={poste.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={postesActifs.includes(poste.id)}
                              onCheckedChange={checked => handleTogglePosteBase(poste.id, checked)}
                              disabled={loading}
                            />
                            <Label>{poste.nom}</Label>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPosteBaseId(poste.id)}
                            disabled={!postesActifs.includes(poste.id)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Dialogue de gestion du poste */}
      {currentPosteBaseId && (
        <Dialog open={!!currentPosteBaseId} onOpenChange={open => !open && setCurrentPosteBaseId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {postesBases.find(p => p.id === currentPosteBaseId)?.nom || "Gestion du poste"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Section Tenue */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shirt className="h-4 w-4" />
                  <Label>Tenue</Label>
                </div>
                
                {selectedTenues[currentPosteBaseId] ? (
                  <div className="bg-muted/50 p-3 rounded">
                    <p className="font-medium">{selectedTenues[currentPosteBaseId]?.valeur}</p>
                    {selectedTenues[currentPosteBaseId]?.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedTenues[currentPosteBaseId]?.description}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">Aucune tenue sélectionnée</p>
                )}
                
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setCurrentTenueDialog(currentPosteBaseId)}
                >
                  <Edit2 className="h-4 w-4" />
                  {selectedTenues[currentPosteBaseId] ? "Modifier" : "Ajouter"}
                </Button>
              </div>

              <Separator />

              {/* Section Postes Types */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <Label>Postes types</Label>
                </div>
                
                {postesTypesParPosteBase(currentPosteBaseId).length > 0 ? (
                  <div className="space-y-2">
                    {postesTypesParPosteBase(currentPosteBaseId).map(pt => (
                      <div key={pt.id} className="flex items-center justify-between p-3 rounded border">
                        <div className="space-y-1">
                          <p className="font-medium">{pt.nom}</p>
                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            {pt.heure_debut_matin && (
                              <span>Matin: {pt.heure_debut_matin.slice(0, 5)}-{pt.heure_fin_matin?.slice(0, 5)}</span>
                            )}
                            {pt.heure_debut_soir && (
                              <span>Soir: {pt.heure_debut_soir.slice(0, 5)}-{pt.heure_fin_soir?.slice(0, 5)}</span>
                            )}
                            {pt.temps_pause_minutes && (
                              <span>Pause: {pt.temps_pause_minutes.slice(0, 5)}</span>
                            )}
                            {pt.repas_fournis && (
                              <span className="flex items-center gap-1">
                                <Utensils className="h-3 w-3" /> Repas fourni
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCurrentPosteTypeEdit(pt)
                              // Formatage du temps de pause pour l'affichage
                              setNewPosteTypeData({
                                ...pt,
                                temps_pause_minutes: pt.temps_pause_minutes?.slice(0, 5)
                              })
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDeletePosteType(pt.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">Aucun poste type défini</p>
                )}
                
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setCurrentPosteTypeEdit({
                      poste_base_id: currentPosteBaseId,
                      client_id: client.id,
                    } as PosteType)
                    setNewPosteTypeData({})
                  }}
                >
                  <PlusCircle className="h-4 w-4" />
                  Ajouter un poste type
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialogue de sélection de tenue */}
      {currentTenueDialog && (
        <Dialog open={!!currentTenueDialog} onOpenChange={open => !open && setCurrentTenueDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sélectionner une tenue</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {tenues.map(tenue => (
                <div
                  key={tenue.id}
                  className={`p-3 border rounded cursor-pointer hover:bg-muted/50 ${
                    selectedTenues[currentTenueDialog]?.id === tenue.id ? "bg-muted/50 border-primary" : ""
                  }`}
                  onClick={() => handleSaveTenue(currentTenueDialog, tenue)}
                >
                  <div className="flex justify-between items-center">
                    <p className="font-medium">{tenue.valeur}</p>
                    {selectedTenues[currentTenueDialog]?.id === tenue.id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  {tenue.description && (
                    <p className="text-sm text-muted-foreground mt-1">{tenue.description}</p>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialogue d'édition/création de poste type */}
      {currentPosteTypeEdit && (
        <Dialog open={!!currentPosteTypeEdit} onOpenChange={open => !open && setCurrentPosteTypeEdit(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {currentPosteTypeEdit.id ? "Modifier le poste type" : "Créer un poste type"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Nom du poste *</Label>
                <Input
                  value={newPosteTypeData.nom || ""}
                  onChange={e => setNewPosteTypeData({...newPosteTypeData, nom: e.target.value})}
                  placeholder="Ex: Agent de sécurité jour"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Heure début matin</Label>
                  <Input
                    type="time"
                    value={newPosteTypeData.heure_debut_matin || ""}
                    onChange={e => setNewPosteTypeData({...newPosteTypeData, heure_debut_matin: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Heure fin matin</Label>
                  <Input
                    type="time"
                    value={newPosteTypeData.heure_fin_matin || ""}
                    onChange={e => setNewPosteTypeData({...newPosteTypeData, heure_fin_matin: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Heure début soir</Label>
                  <Input
                    type="time"
                    value={newPosteTypeData.heure_debut_soir || ""}
                    onChange={e => setNewPosteTypeData({...newPosteTypeData, heure_debut_soir: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Heure fin soir</Label>
                  <Input
                    type="time"
                    value={newPosteTypeData.heure_fin_soir || ""}
                    onChange={e => setNewPosteTypeData({...newPosteTypeData, heure_fin_soir: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Temps de pause (HH:MM)</Label>
                  <Input
                    type="time"
                    value={newPosteTypeData.temps_pause_minutes || ""}
                    onChange={e => setNewPosteTypeData({...newPosteTypeData, temps_pause_minutes: e.target.value})}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="repas-fournis"
                    checked={newPosteTypeData.repas_fournis || false}
                    onCheckedChange={checked => setNewPosteTypeData({...newPosteTypeData, repas_fournis: checked})}
                  />
                  <Label htmlFor="repas-fournis">Repas fournis</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setCurrentPosteTypeEdit(null)}>
                  Annuler
                </Button>
                <Button onClick={handleSavePosteType} disabled={loading}>
                  {loading ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}