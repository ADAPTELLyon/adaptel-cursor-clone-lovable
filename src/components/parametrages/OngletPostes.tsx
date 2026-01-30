import React, { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import * as z from "zod";
import { secteursList } from "@/lib/secteurs";

const posteSchema = z.object({
  nom: z.string().min(1, "Le nom du poste est obligatoire"),
});

export default function OngletPostes() {
  const [postes, setPostes] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [currentSecteur, setCurrentSecteur] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPostes();
  }, []);

  const fetchPostes = async () => {
    const { data, error } = await supabase.from('postes_bases').select('*');
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de récupérer les postes",
        variant: "destructive",
      });
      return;
    }
    setPostes(data || []);
  };

  const addPoste = async (values) => {
    const { error } = await supabase
      .from('postes_bases')
      .insert([{ nom: values.nom, secteur: currentSecteur }]);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le poste",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Succès", description: "Poste ajouté avec succès" });
    fetchPostes();
    setOpenDialog(false);
  };

  const updatePoste = async (values) => {
    const { error } = await supabase
      .from('postes_bases')
      .update({ nom: values.nom, updated_at: new Date().toISOString() })
      .eq('id', editingItem.id);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le poste",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Succès", description: "Poste mis à jour avec succès" });
    fetchPostes();
    setOpenDialog(false);
    setEditingItem(null);
  };

  const deletePoste = async (id) => {
    const { error } = await supabase.from('postes_bases').delete().eq('id', id);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le poste",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Succès", description: "Poste supprimé avec succès" });
    fetchPostes();
  };

  const PosteDialog = () => {
    const form = useForm({
      resolver: zodResolver(posteSchema),
      defaultValues: editingItem ? { nom: editingItem.nom } : { nom: "" }
    });

    useEffect(() => {
      if (openDialog) {
        form.reset(editingItem ? { nom: editingItem.nom } : { nom: "" });
      }
    }, [openDialog, editingItem, form]);

    const onSubmit = (values) => {
      if (editingItem) {
        updatePoste(values);
      } else {
        addPoste(values);
      }
    };

    return (
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Modifier un poste" : `Ajouter un poste (${currentSecteur})`}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du poste</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Chef de rang" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end pt-4">
                <Button type="submit">{editingItem ? "Enregistrer" : "Ajouter"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        {secteursList.map((secteur) => {
          const postesDuSecteur = postes.filter((p) => p.secteur === secteur.value);

          return (
            <Card key={secteur.value}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <secteur.icon className="w-5 h-5 text-gray-500" />
                  <CardTitle className="text-lg">{secteur.label}</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingItem(null);
                    setCurrentSecteur(secteur.value);
                    setOpenDialog(true);
                  }}
                >
                  + Ajouter
                </Button>
              </CardHeader>
              <CardContent>
                {postesDuSecteur.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun poste pour ce secteur.</p>
                ) : (
                  postesDuSecteur.map((poste) => (
                    <div
                      key={poste.id}
                      className="flex justify-between items-center py-2 border-b last:border-none"
                    >
                      <span>{poste.nom}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingItem(poste);
                            setCurrentSecteur(secteur.value);
                            setOpenDialog(true);
                          }}
                        >
                          Modifier
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-400 border-red-400 hover:bg-red-50"
                            >
                              Supprimer
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action supprimera définitivement ce poste.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deletePoste(poste.id)}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <PosteDialog />
    </div>
  );
}
