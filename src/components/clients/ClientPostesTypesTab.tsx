import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Client,
  PosteBase,
  PosteType,
  PosteTypeInsert,
  Parametrage,
} from "@/types/types-front";
import { secteursList } from "@/lib/secteurs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

// Fonction pour comparer proprement (sans accents + lowercase)
const normalize = (str: string) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

type Props = {
  client: Client;
};

export function ClientPostesTypesTab({ client }: Props) {
  const [postesBases, setPostesBases] = useState<PosteBase[]>([]);
  const [postesTypes, setPostesTypes] = useState<PosteType[]>([]);
  const [editingPosteType, setEditingPosteType] = useState<PosteType | null>(null);
  const [newPosteType, setNewPosteType] = useState<Partial<PosteTypeInsert>>({});
  const [loading, setLoading] = useState(false);
  const [tenues, setTenues] = useState<Parametrage[]>([]);
  const [posteBaseIdForTenue, setPosteBaseIdForTenue] = useState<string | null>(null);
  const [selectedTenues, setSelectedTenues] = useState<Record<string, Parametrage | null>>({});

  useEffect(() => {
    fetchPostesBases();
    fetchPostesTypes();
    fetchTenues();
    fetchPostesBasesClients();
  }, []);

  const fetchPostesBases = async () => {
    const { data } = await supabase.from("postes_bases").select("*");
    if (data) setPostesBases(data);
  };

  const fetchPostesTypes = async () => {
    if (!client.id) return;
    const { data } = await supabase
      .from("postes_types_clients")
      .select("*")
      .eq("client_id", client.id);
    if (data) setPostesTypes(data);
  };

  const fetchTenues = async () => {
    const { data } = await supabase
      .from("parametrages")
      .select("*")
      .eq("categorie", "tenue");
    if (data) setTenues(data);
  };

  const fetchPostesBasesClients = async () => {
    if (!client.id) return;
    const { data } = await supabase
      .from("postes_bases_clients")
      .select("poste_base_id, tenue_id, tenue (id, valeur, description)")
      .eq("client_id", client.id);
    if (data) {
      const mapping: Record<string, Parametrage | null> = {};
      data.forEach((row: any) => {
        mapping[row.poste_base_id] = row.tenue
          ? {
              id: row.tenue.id,
              valeur: row.tenue.valeur,
              description: row.tenue.description,
              categorie: "tenue",
              created_at: "",
              updated_at: "",
            }
          : null;
      });
      setSelectedTenues(mapping);
    }
  };

  const handleTogglePosteBase = async (posteBaseId: string, isActive: boolean) => {
    if (!client.id) return;
    setLoading(true);
    const postesActuels = client.postes_bases_actifs ?? [];
    const nouveauxPostes = isActive
      ? [...postesActuels, posteBaseId]
      : postesActuels.filter((id) => id !== posteBaseId);

    const { error } = await supabase
      .from("clients")
      .update({ postes_bases_actifs: nouveauxPostes })
      .eq("id", client.id);

    if (!error) {
      toast({ title: "Succès", description: "Poste mis à jour." });
      client.postes_bases_actifs = nouveauxPostes;
    }
    setLoading(false);
  };

  const handleSaveTenue = async (posteBaseId: string, tenue: Parametrage) => {
    if (!client.id) return;
    const { error } = await supabase
      .from("postes_bases_clients")
      .upsert({
        client_id: client.id,
        poste_base_id: posteBaseId,
        tenue_id: tenue.id,
      });
    if (!error) {
      toast({ title: "Succès", description: "Tenue assignée." });
      setSelectedTenues((prev) => ({ ...prev, [posteBaseId]: tenue }));
      setPosteBaseIdForTenue(null);
    }
  };

  const handleSavePosteType = async () => {
    if (!client.id || !editingPosteType) return;

    const dataToSave = {
      ...newPosteType,
      client_id: client.id,
      poste_base_id: editingPosteType.poste_base_id,
    };

    let res;
    if (editingPosteType.id) {
      res = await supabase
        .from("postes_types_clients")
        .update(dataToSave)
        .eq("id", editingPosteType.id);
    } else {
      res = await supabase.from("postes_types_clients").insert([dataToSave]);
    }

    if (!res.error) {
      toast({ title: "Succès", description: "Poste type enregistré." });
      setEditingPosteType(null);
      setNewPosteType({});
      fetchPostesTypes();
    } else {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue.",
        variant: "destructive",
      });
    }
  };

  const handleDeletePosteType = async (posteTypeId: string) => {
    const { error } = await supabase
      .from("postes_types_clients")
      .delete()
      .eq("id", posteTypeId);

    if (!error) {
      toast({ title: "Supprimé", description: "Poste type supprimé." });
      fetchPostesTypes();
    }
  };

  const postesParSecteur = (secteur: string) =>
    postesBases.filter((pb) => normalize(pb.secteur) === normalize(secteur));

  const postesTypesParPosteBase = (posteBaseId: string) =>
    postesTypes.filter((pt) => pt.poste_base_id === posteBaseId);

  if (!client.secteurs || client.secteurs.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        Aucun secteur n'est défini pour ce client.
      </p>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {client.secteurs.map((secteurClient) => {
        const secteurInfo = secteursList.find(
          (s) => normalize(s.value) === normalize(secteurClient)
        );
        const postesDuSecteur = postesParSecteur(secteurClient);

        return (
          <Card key={secteurClient} className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {secteurInfo ? (
                  <>
                    <secteurInfo.icon className="w-5 h-5" />
                    <span>{secteurInfo.label}</span>
                  </>
                ) : (
                  <span>{secteurClient}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {postesDuSecteur.length > 0
                    ? `${postesDuSecteur.length} poste(s) disponible(s)`
                    : "Aucun poste disponible"}
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Gérer
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>
                        Gérer les postes - {secteurInfo?.label ?? secteurClient}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      {postesDuSecteur.map((poste) => {
                        const isActive = client.postes_bases_actifs?.includes(
                          poste.id
                        );
                        const postesTypesExistants =
                          postesTypesParPosteBase(poste.id);
                        const tenue = selectedTenues[poste.id];

                        return (
                          <div
                            key={poste.id}
                            className="border p-4 rounded space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <Label>{poste.nom}</Label>
                              <Switch
                                checked={isActive}
                                onCheckedChange={(checked) =>
                                  handleTogglePosteBase(poste.id, checked)
                                }
                                disabled={loading}
                              />
                            </div>

                            {isActive && (
                              <div className="mt-4 space-y-3">
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

                                {postesTypesExistants.map((pt) => (
                                  <div
                                    key={pt.id}
                                    className="flex justify-between items-center p-2 border rounded bg-white"
                                  >
                                    <div>
                                      <span className="text-sm font-medium">
                                        {pt.nom}
                                      </span>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {pt.heure_debut_matin?.slice(0, 5)} -{" "}
                                        {pt.heure_fin_matin?.slice(0, 5)}{" "}
                                        {pt.heure_debut_soir &&
                                          `| ${pt.heure_debut_soir.slice(0, 5)} - ${pt.heure_fin_soir?.slice(0, 5)}`}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditingPosteType(pt);
                                          setNewPosteType(pt);
                                        }}
                                      >
                                        Modifier
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-red-500 border-red-500"
                                        onClick={() =>
                                          handleDeletePosteType(pt.id)
                                        }
                                      >
                                        Supprimer
                                      </Button>
                                    </div>
                                  </div>
                                ))}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setEditingPosteType({
                                      poste_base_id: poste.id,
                                      client_id: client.id,
                                    } as PosteType)
                                  }
                                >
                                  ➕ Ajouter un poste type
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog pour choisir une tenue */}
      <Dialog
        open={!!posteBaseIdForTenue}
        onOpenChange={() => setPosteBaseIdForTenue(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choisir une tenue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {tenues.map((tenue) => (
              <div
                key={tenue.id}
                className="border p-3 rounded flex justify-between items-center"
              >
                <div className="flex-1 pr-4">
                  <p className="font-medium">{tenue.valeur}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                    {tenue.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    handleSaveTenue(posteBaseIdForTenue!, tenue)
                  }
                >
                  Sélectionner
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pop-up créer/modifier poste type */}
      <Dialog
        open={!!editingPosteType}
        onOpenChange={() => setEditingPosteType(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPosteType?.id
                ? "Modifier le poste type"
                : "Créer un poste type"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nom du poste type"
              value={newPosteType.nom || ""}
              onChange={(e) =>
                setNewPosteType((prev) => ({
                  ...prev,
                  nom: e.target.value,
                }))
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="time"
                placeholder="Début Matin"
                value={newPosteType.heure_debut_matin || ""}
                onChange={(e) =>
                  setNewPosteType((prev) => ({
                    ...prev,
                    heure_debut_matin: e.target.value,
                  }))
                }
              />
              <Input
                type="time"
                placeholder="Fin Matin"
                value={newPosteType.heure_fin_matin || ""}
                onChange={(e) =>
                  setNewPosteType((prev) => ({
                    ...prev,
                    heure_fin_matin: e.target.value,
                  }))
                }
              />
              <Input
                type="time"
                placeholder="Début Soir"
                value={newPosteType.heure_debut_soir || ""}
                onChange={(e) =>
                  setNewPosteType((prev) => ({
                    ...prev,
                    heure_debut_soir: e.target.value,
                  }))
                }
              />
              <Input
                type="time"
                placeholder="Fin Soir"
                value={newPosteType.heure_fin_soir || ""}
                onChange={(e) =>
                  setNewPosteType((prev) => ({
                    ...prev,
                    heure_fin_soir: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Temps de pause</Label>
              <Input
                type="time"
                step="60"
                value={newPosteType.temps_pause_minutes || ""}
                onChange={(e) =>
                  setNewPosteType((prev) => ({
                    ...prev,
                    temps_pause_minutes: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={newPosteType.repas_fournis ?? false}
                onCheckedChange={(checked) =>
                  setNewPosteType((prev) => ({
                    ...prev,
                    repas_fournis: checked,
                  }))
                }
              />
              <Label>Repas fournis</Label>
            </div>
            <Button onClick={handleSavePosteType}>Valider</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
