import React, { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import * as z from "zod";

const utilisateurSchema = z.object({
  prenom: z.string().min(1, "Le prénom est obligatoire"),
  nom: z.string().min(1, "Le nom est obligatoire"),
  email: z.string().email("Email invalide"),
  actif: z.boolean().default(true),
});

export default function OngletUtilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUtilisateurs();
  }, []);

  const fetchUtilisateurs = async () => {
    const { data, error } = await supabase.from('utilisateurs').select('*');
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de récupérer les utilisateurs",
        variant: "destructive",
      });
      return;
    }
    setUtilisateurs(data || []);
  };

  const addUtilisateur = async (values) => {
    const { error } = await supabase
      .from('utilisateurs')
      .insert([{ prenom: values.prenom, nom: values.nom, email: values.email, actif: values.actif }]);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter l'utilisateur",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Succès", description: "Utilisateur ajouté avec succès" });
    fetchUtilisateurs();
    setOpenDialog(false);
  };

  const updateUtilisateur = async (values) => {
    const { error } = await supabase
      .from('utilisateurs')
      .update({
        prenom: values.prenom,
        nom: values.nom,
        email: values.email,
        actif: values.actif,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingItem.id);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'utilisateur",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Succès", description: "Utilisateur mis à jour avec succès" });
    fetchUtilisateurs();
    setOpenDialog(false);
    setEditingItem(null);
  };

  const deleteUtilisateur = async (id) => {
    const { error } = await supabase
      .from('utilisateurs')
      .delete()
      .eq('id', id);
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'utilisateur",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Succès", description: "Utilisateur supprimé avec succès" });
    fetchUtilisateurs();
  };

  const UtilisateurDialog = () => {
    const form = useForm({
      resolver: zodResolver(utilisateurSchema),
      defaultValues: editingItem
        ? {
            prenom: editingItem.prenom,
            nom: editingItem.nom,
            email: editingItem.email,
            actif: editingItem.actif,
          }
        : {
            prenom: "",
            nom: "",
            email: "",
            actif: true,
          }
    });

    useEffect(() => {
      if (openDialog) {
        form.reset(
          editingItem
            ? {
                prenom: editingItem.prenom,
                nom: editingItem.nom,
                email: editingItem.email,
                actif: editingItem.actif,
              }
            : {
                prenom: "",
                nom: "",
                email: "",
                actif: true,
              }
        );
      }
    }, [openDialog, editingItem, form]);

    const onSubmit = (values) => {
      if (editingItem) {
        updateUtilisateur(values);
      } else {
        addUtilisateur(values);
      }
    };

    return (
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Modifier un utilisateur" : "Ajouter un utilisateur"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="prenom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl>
                      <Input placeholder="Prénom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="actif"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center space-x-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>Actif</FormLabel>
                    </div>
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
          Ajouter un utilisateur
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {utilisateurs.map((utilisateur) => (
          <Card key={utilisateur.id}>
            <CardHeader>
              <CardTitle>{utilisateur.prenom} {utilisateur.nom}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">{utilisateur.email}</p>
              <div className="flex items-center space-x-2">
                <Label>Statut:</Label>
                <span className={`px-2 py-1 text-xs rounded-full ${utilisateur.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {utilisateur.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingItem(utilisateur);
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
                        Cette action ne peut pas être annulée. Cela supprimera définitivement cet utilisateur.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteUtilisateur(utilisateur.id)}>
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
      <UtilisateurDialog />
    </div>
  );
}
