import React, { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import * as z from "zod";

const tenueSchema = z.object({
  valeur: z.string().min(1, "La valeur est obligatoire"),
  description: z.string().min(1, "La description est obligatoire"),
});

export default function OngletTenues() {
  const [tenues, setTenues] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTenues();
  }, []);

  const fetchTenues = async () => {
    const { data, error } = await supabase
      .from('parametrages')
      .select('*')
      .eq('categorie', 'tenue');
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de récupérer les tenues",
        variant: "destructive",
      });
      return;
    }
    setTenues(data || []);
  };

  const addTenue = async (values) => {
    const { error } = await supabase
      .from('parametrages')
      .insert([{ valeur: values.valeur, description: values.description, categorie: 'tenue' }]);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la tenue",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Succès", description: "Tenue ajoutée avec succès" });
    fetchTenues();
    setOpenDialog(false);
  };

  const updateTenue = async (values) => {
    const { error } = await supabase
      .from('parametrages')
      .update({
        valeur: values.valeur,
        description: values.description,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingItem.id);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la tenue",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Succès", description: "Tenue mise à jour avec succès" });
    fetchTenues();
    setOpenDialog(false);
    setEditingItem(null);
  };

  const deleteTenue = async (id) => {
    const { error } = await supabase
      .from('parametrages')
      .delete()
      .eq('id', id);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la tenue",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Succès", description: "Tenue supprimée avec succès" });
    fetchTenues();
  };

  const TenueDialog = () => {
    const form = useForm({
      resolver: zodResolver(tenueSchema),
      defaultValues: editingItem
        ? { valeur: editingItem.valeur, description: editingItem.description || "" }
        : { valeur: "", description: "" }
    });

    useEffect(() => {
      if (openDialog) {
        form.reset(
          editingItem
            ? { valeur: editingItem.valeur, description: editingItem.description || "" }
            : { valeur: "", description: "" }
        );
      }
    }, [openDialog, editingItem, form]);

    const onSubmit = (values) => {
      if (editingItem) {
        updateTenue(values);
      } else {
        addTenue(values);
      }
    };

    return (
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Modifier une tenue" : "Ajouter une tenue"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="valeur"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valeur</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom de la tenue" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Description de la tenue" {...field} />
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditingItem(null);
            setOpenDialog(true);
          }}
        >
          Ajouter une tenue
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {tenues.map((tenue) => (
          <Card key={tenue.id}>
            <CardHeader>
              <CardTitle>{tenue.valeur}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">{tenue.description}</p>
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingItem(tenue);
                    setOpenDialog(true);
                  }}
                >
                  Modifier
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-red-400 border-red-400 hover:bg-red-50">
                      Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action ne peut pas être annulée. Cela supprimera définitivement cette tenue.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteTenue(tenue.id)}>
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <TenueDialog />
    </div>
  );
}
