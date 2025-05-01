import MainLayout from "@/components/main-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OngletServices from "@/components/parametrages/OngletServices";
import OngletGroupes from "@/components/parametrages/OngletGroupes";
import OngletTenues from "@/components/parametrages/OngletTenues";
import OngletUtilisateurs from "@/components/parametrages/OngletUtilisateurs";
import OngletPostes from "@/components/parametrages/OngletPostes";

export default function Parametrages() {
  return (
    <MainLayout>
      <Tabs defaultValue="services">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="groupes">Groupes</TabsTrigger>
          <TabsTrigger value="tenues">Tenues</TabsTrigger>
          <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>
          <TabsTrigger value="postes">Postes</TabsTrigger>
        </TabsList>
        <div className="p-6">
          <TabsContent value="services">
            <OngletServices />
          </TabsContent>
          <TabsContent value="groupes">
            <OngletGroupes />
          </TabsContent>
          <TabsContent value="tenues">
            <OngletTenues />
          </TabsContent>
          <TabsContent value="utilisateurs">
            <OngletUtilisateurs />
          </TabsContent>
          <TabsContent value="postes">
            <OngletPostes />
          </TabsContent>
        </div>
      </Tabs>
    </MainLayout>
  );
}
