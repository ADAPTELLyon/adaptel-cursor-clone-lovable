import MainLayout from "@/components/main-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OngletServices from "@/components/parametrages/OngletServices";
import OngletGroupes from "@/components/parametrages/OngletGroupes";
import OngletTenues from "@/components/parametrages/OngletTenues";
import OngletUtilisateurs from "@/components/parametrages/OngletUtilisateurs";
import OngletPostes from "@/components/parametrages/OngletPostes";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Settings, BarChart3 } from "lucide-react";

export default function Parametrages() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5" /> Paramétrages
          </h1>
        </div>

        <Tabs defaultValue="services" className="space-y-4">
          <TabsList className="flex flex-wrap gap-2">
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="groupes">Groupes</TabsTrigger>
            <TabsTrigger value="tenues">Tenues</TabsTrigger>
            <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>
            <TabsTrigger value="postes">Postes</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>

          <div className="p-4 rounded bg-white shadow space-y-4">
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
            <TabsContent value="admin">
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Zone d’administration avancée pour vos indicateurs et analyses.
                </p>
                <Button
                  onClick={() => navigate("/reporting")}
                  className="bg-[#840404] hover:bg-[#750303] text-white flex items-center gap-2"
                >
                  <BarChart3 className="w-4 h-4" /> Accéder au reporting
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </MainLayout>
  );
}
