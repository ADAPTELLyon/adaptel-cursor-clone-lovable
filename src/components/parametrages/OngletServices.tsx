import React, { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
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

const serviceSchema = z.object({
  valeur: z.string().min(1, "La valeur est obligatoire"),
});

export default function OngletServices() {
  const [services, setServices] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('parametrages')
      .select('*')
      .eq('categorie', 'service');
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de récupérer les services",
        variant: "destructive",
      });
      return;
    }
    setServices(data || []);
  };

  const addService = async (values) => {
    const { error } = await supabase
      .from('parametrages')
      .insert([{ valeur: values.valeur, categorie: 'service' }]);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le service",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Succès", description: "Service ajouté avec succès" });
    fetchServices();
    setOpenDialog(false);
  };

  const updateService = async (values) => {
    const { error } = await supabase
      .from('parametrages')
      .update({ valeur: values.valeur, updated_at: new Date().toISOString() })
      .eq('id', editingItem.id);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le service",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Succès", description: "Service mis à jour avec succès" });
    fetchServices();
    setOpenDialog(false);
    setEditingItem(null);
  };

  const deleteService = async (id) => {
    const { error } = await supabase
      .from('parametrages')
      .delete()
      .eq('id', id);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le service",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Succès", description: "Service supprimé avec succès" });
    fetchServices();
  };

  const ServiceDialog = () => {
    const form = useForm({
      resolver: zodResolver(serviceSchema),
      defaultValues: editingItem ? { valeur: editingItem.valeur } : { valeur: "" }
    });

    useEffect(() => {
      if (openDialog) {
        form.reset(editingItem ? { valeur: editingItem.valeur } : { valeur: "" });
      }
    }, [openDialog, editingItem, form]);

    const onSubmit = (values) => {
      if (editingItem) {
        updateService(values);
      } else {
        addService(values);
      }
    };

    return (
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Modifier un service" : "Ajouter un service"}</DialogTitle>
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
                      <Input placeholder="Nom du service" {...field} />
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
          Ajouter un service
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {services.map((service) => (
          <Card key={service.id}>
            <CardHeader>
              <CardTitle>{service.valeur}</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingItem(service);
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
                      Cette action ne peut pas être annulée. Cela supprimera définitivement ce service.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteService(service.id)}>
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
      </div>
      <ServiceDialog />
    </div>
  );
}
