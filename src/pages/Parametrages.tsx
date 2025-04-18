
import React, { useState } from 'react';
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
  actif: z.boolean(),
});

export default function Parametrages() {
  const [activeTab, setActiveTab] = useState("services");

  const renderServices = () => {
    const serviceForm = useForm<z.infer<typeof serviceSchema>>({
      resolver: zodResolver(serviceSchema),
    });

    const onServiceSubmit = (data: z.infer<typeof serviceSchema>) => {
      console.log("Service ajouté", data);
    };

    return (
      <div className="grid gap-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button>Ajouter un service</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un service</DialogTitle>
            </DialogHeader>
            <Form {...serviceForm}>
              <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)}>
                <FormField
                  control={serviceForm.control}
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
                <Button type="submit" className="mt-4">Ajouter</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Example service cards would be rendered here */}
          <Card>
            <CardHeader>
              <CardTitle>Service 1</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-between">
              <Button variant="outline">Modifier</Button>
              <Button variant="destructive">Supprimer</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderGroupes = () => {
    // Similar implementation to services
    return <div>Groupes</div>;
  };

  const renderTenues = () => {
    // Similar implementation to services
    return <div>Tenues</div>;
  };

  const renderUtilisateurs = () => {
    // Similar implementation to services
    return <div>Utilisateurs</div>;
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
