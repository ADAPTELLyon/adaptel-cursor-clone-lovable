
import React, { useState, useEffect } from 'react';
import MainLayout from "@/components/main-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const serviceSchema = z.object({
  valeur: z.string().min(1, "La valeur est obligatoire"),
});

const groupeSchema = z.object({
  valeur: z.string().min(1, "La valeur est obligatoire"),
});

const tenueSchema = z.object({
  valeur: z.string().min(1, "La valeur est obligatoire"),
  description: z.string().min(1, "La description est obligatoire"),
});

const utilisateurSchema = z.object({
  prenom: z.string().min(1, "Le prénom est obligatoire"),
  nom: z.string().min(1, "Le nom est obligatoire"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  actif: z.boolean().default(true),
});

export default function Parametrages() {
  const [activeTab, setActiveTab] = useState("services");
  const [services, setServices] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [tenues, setTenues] = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [openDialogService, setOpenDialogService] = useState(false);
  const [openDialogGroupe, setOpenDialogGroupe] = useState(false);
  const [openDialogTenue, setOpenDialogTenue] = useState(false);
  const [openDialogUtilisateur, setOpenDialogUtilisateur] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchServices();
    fetchGroupes();
    fetchTenues();
    fetchUtilisateurs();
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

  const fetchGroupes = async () => {
    const { data, error } = await supabase
      .from('parametrages')
      .select('*')
      .eq('categorie', 'groupe');
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de récupérer les groupes",
        variant: "destructive",
      });
      return;
    }
    
    setGroupes(data || []);
  };

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

  const fetchUtilisateurs = async () => {
    const { data, error } = await supabase
      .from('utilisateurs')
      .select('*');
    
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

  const addService = async (values) => {
    const { error } = await supabase
      .from('parametrages')
      .insert([
        { 
          valeur: values.valeur,
          categorie: 'service'
        }
      ]);
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le service",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Succès",
      description: "Service ajouté avec succès",
    });
    
    fetchServices();
    setOpenDialogService(false);
  };

  const updateService = async (values) => {
    const { error } = await supabase
      .from('parametrages')
      .update({ 
        valeur: values.valeur,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingItem.id);
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le service",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Succès",
      description: "Service mis à jour avec succès",
    });
    
    fetchServices();
    setOpenDialogService(false);
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
    
    toast({
      title: "Succès",
      description: "Service supprimé avec succès",
    });
    
    fetchServices();
  };

  const addGroupe = async (values) => {
    const { error } = await supabase
      .from('parametrages')
      .insert([
        { 
          valeur: values.valeur,
          categorie: 'groupe'
        }
      ]);
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le groupe",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Succès",
      description: "Groupe ajouté avec succès",
    });
    
    fetchGroupes();
    setOpenDialogGroupe(false);
  };

  const updateGroupe = async (values) => {
    const { error } = await supabase
      .from('parametrages')
      .update({ 
        valeur: values.valeur,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingItem.id);
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le groupe",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Succès",
      description: "Groupe mis à jour avec succès",
    });
    
    fetchGroupes();
    setOpenDialogGroupe(false);
    setEditingItem(null);
  };

  const deleteGroupe = async (id) => {
    const { error } = await supabase
      .from('parametrages')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le groupe",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Succès",
      description: "Groupe supprimé avec succès",
    });
    
    fetchGroupes();
  };

  const addTenue = async (values) => {
    const { error } = await supabase
      .from('parametrages')
      .insert([
        { 
          valeur: values.valeur,
          description: values.description,
          categorie: 'tenue'
        }
      ]);
    
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la tenue",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Succès",
      description: "Tenue ajoutée avec succès",
    });
    
    fetchTenues();
    setOpenDialogTenue(false);
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
    
    toast({
      title: "Succès",
      description: "Tenue mise à jour avec succès",
    });
    
    fetchTenues();
    setOpenDialogTenue(false);
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
    
    toast({
      title: "Succès",
      description: "Tenue supprimée avec succès",
    });
    
    fetchTenues();
  };

  const addUtilisateur = async (values) => {
    try {
      // Call the Edge Function to create user with service role
      const response = await fetch(`https://jnfmuvtpdmwjemgoford.supabase.co/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.getSession().then(res => res.data.session?.access_token)}`
        },
        body: JSON.stringify({
          prenom: values.prenom,
          nom: values.nom,
          email: values.email,
          password: values.password,
          actif: values.actif
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }
      
      toast({
        title: "Succès",
        description: "Utilisateur ajouté avec succès",
      });
      
      fetchUtilisateurs();
      setOpenDialogUtilisateur(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter l'utilisateur",
        variant: "destructive",
      });
    }
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
    
    toast({
      title: "Succès",
      description: "Utilisateur mis à jour avec succès",
    });
    
    fetchUtilisateurs();
    setOpenDialogUtilisateur(false);
    setEditingItem(null);
  };

  const deleteUtilisateur = async (id) => {
    try {
      // Call the Edge Function to delete user with service role
      const response = await fetch(`https://jnfmuvtpdmwjemgoford.supabase.co/functions/v1/create-user`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.getSession().then(res => res.data.session?.access_token)}`
        },
        body: JSON.stringify({
          userId: id
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Une erreur est survenue');
      }
      
      toast({
        title: "Succès",
        description: "Utilisateur supprimé avec succès",
      });
      
      fetchUtilisateurs();
    } catch (error) {
      // Fallback to just delete from the database if edge function fails
      const { error: dbError } = await supabase
        .from('utilisateurs')
        .delete()
        .eq('id', id);
      
      if (dbError) {
        toast({
          title: "Erreur",
          description: "Impossible de supprimer l'utilisateur",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Avertissement",
        description: "Utilisateur supprimé de la base de données, mais pas de l'authentification",
        variant: "default",
      });
      
      fetchUtilisateurs();
    }
  };

  const renderServiceDialog = () => {
    const form = useForm({
      resolver: zodResolver(serviceSchema),
      defaultValues: editingItem ? 
        { valeur: editingItem.valeur } : 
        { valeur: "" }
    });

    // Reset form when dialog opens
    useEffect(() => {
      if (openDialogService) {
        form.reset(editingItem ? { valeur: editingItem.valeur } : { valeur: "" });
      }
    }, [openDialogService, form, editingItem]);

    const onSubmit = (values) => {
      if (editingItem) {
        updateService(values);
      } else {
        addService(values);
      }
    };

    return (
      <Dialog open={openDialogService} onOpenChange={setOpenDialogService}>
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

  const renderGroupeDialog = () => {
    const form = useForm({
      resolver: zodResolver(groupeSchema),
      defaultValues: editingItem ? 
        { valeur: editingItem.valeur } : 
        { valeur: "" }
    });

    // Reset form when dialog opens
    useEffect(() => {
      if (openDialogGroupe) {
        form.reset(editingItem ? { valeur: editingItem.valeur } : { valeur: "" });
      }
    }, [openDialogGroupe, form, editingItem]);

    const onSubmit = (values) => {
      if (editingItem) {
        updateGroupe(values);
      } else {
        addGroupe(values);
      }
    };

    return (
      <Dialog open={openDialogGroupe} onOpenChange={setOpenDialogGroupe}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Modifier un groupe" : "Ajouter un groupe"}</DialogTitle>
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
                      <Input placeholder="Nom du groupe" {...field} />
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

  const renderTenueDialog = () => {
    const form = useForm({
      resolver: zodResolver(tenueSchema),
      defaultValues: editingItem ? 
        { 
          valeur: editingItem.valeur,
          description: editingItem.description || ""
        } : 
        { 
          valeur: "",
          description: ""
        }
    });

    // Reset form when dialog opens
    useEffect(() => {
      if (openDialogTenue) {
        form.reset(editingItem ? 
          { valeur: editingItem.valeur, description: editingItem.description || "" } : 
          { valeur: "", description: "" }
        );
      }
    }, [openDialogTenue, form, editingItem]);

    const onSubmit = (values) => {
      if (editingItem) {
        updateTenue(values);
      } else {
        addTenue(values);
      }
    };

    return (
      <Dialog open={openDialogTenue} onOpenChange={setOpenDialogTenue}>
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

  const renderUtilisateurDialog = () => {
    const form = useForm({
      resolver: zodResolver(
        editingItem 
          ? utilisateurSchema.omit({ password: true }) 
          : utilisateurSchema
      ),
      defaultValues: editingItem ? 
        { 
          prenom: editingItem.prenom,
          nom: editingItem.nom,
          email: editingItem.email,
          actif: editingItem.actif
        } : 
        { 
          prenom: "",
          nom: "",
          email: "",
          password: "",
          actif: true
        }
    });

    // Reset form when dialog opens
    useEffect(() => {
      if (openDialogUtilisateur) {
        form.reset(editingItem ? 
          { 
            prenom: editingItem.prenom,
            nom: editingItem.nom,
            email: editingItem.email,
            actif: editingItem.actif
          } : 
          { 
            prenom: "",
            nom: "",
            email: "",
            password: "",
            actif: true
          }
        );
      }
    }, [openDialogUtilisateur, form, editingItem]);

    const onSubmit = (values) => {
      if (editingItem) {
        updateUtilisateur(values);
      } else {
        addUtilisateur(values);
      }
    };

    return (
      <Dialog open={openDialogUtilisateur} onOpenChange={setOpenDialogUtilisateur}>
        <DialogContent className="max-w-md">
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
              {!editingItem && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mot de passe</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Mot de passe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="actif"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center space-x-2">
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
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

  const renderServices = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button 
            onClick={() => {
              setEditingItem(null);
              setOpenDialogService(true);
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
                    setOpenDialogService(true);
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
                      <AlertDialogAction
                        onClick={() => deleteService(service.id)}
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>
        {renderServiceDialog()}
      </div>
    );
  };

  const renderGroupes = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button 
            onClick={() => {
              setEditingItem(null);
              setOpenDialogGroupe(true);
            }}
          >
            Ajouter un groupe
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {groupes.map((groupe) => (
            <Card key={groupe.id}>
              <CardHeader>
                <CardTitle>{groupe.valeur}</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-between">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setEditingItem(groupe);
                    setOpenDialogGroupe(true);
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
                        Cette action ne peut pas être annulée. Cela supprimera définitivement ce groupe.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteGroupe(groupe.id)}
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>
        {renderGroupeDialog()}
      </div>
    );
  };

  const renderTenues = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button 
            onClick={() => {
              setEditingItem(null);
              setOpenDialogTenue(true);
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
                      setOpenDialogTenue(true);
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
                        <AlertDialogAction
                          onClick={() => deleteTenue(tenue.id)}
                        >
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
        {renderTenueDialog()}
      </div>
    );
  };

  const renderUtilisateurs = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button 
            onClick={() => {
              setEditingItem(null);
              setOpenDialogUtilisateur(true);
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
                      setOpenDialogUtilisateur(true);
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
                        <AlertDialogAction
                          onClick={() => deleteUtilisateur(utilisateur.id)}
                        >
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
        {renderUtilisateurDialog()}
      </div>
    );
  };

  return (
    <MainLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="groupes">Groupes</TabsTrigger>
          <TabsTrigger value="tenues">Tenues</TabsTrigger>
          <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>
        </TabsList>
        <div className="p-6">
          <TabsContent value="services">{renderServices()}</TabsContent>
          <TabsContent value="groupes">{renderGroupes()}</TabsContent>
          <TabsContent value="tenues">{renderTenues()}</TabsContent>
          <TabsContent value="utilisateurs">{renderUtilisateurs()}</TabsContent>
        </div>
      </Tabs>
    </MainLayout>
  );
}
