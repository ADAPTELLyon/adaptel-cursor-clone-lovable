import MainLayout from "@/components/main-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import OngletServices from "@/components/parametrages/OngletServices"
import OngletGroupes from "@/components/parametrages/OngletGroupes"
import OngletTenues from "@/components/parametrages/OngletTenues"
import OngletUtilisateurs from "@/components/parametrages/OngletUtilisateurs"
import OngletPostes from "@/components/parametrages/OngletPostes"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { Settings, BarChart3, Calendar } from "lucide-react"

/**
 * ✅ Bouton EXISTANT – génération PDF (on ne touche à RIEN)
 */
import PlanningClientExportDialog from "@/components/PlanningClientExportDialog"

/**
 * ✅ NOUVEAU bouton – génération PLANNING (même pop-up, autre usage ensuite)
 * 👉 volontairement le MÊME composant pour l’instant
 */
import PlanningClientExportDialogPlanning from "@/components/PlanningClientExportDialog"

export default function Parametrages() {
  const navigate = useNavigate()

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

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={() => navigate("/reporting")}
                    className="bg-[#840404] hover:bg-[#750303] text-white flex items-center gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Accéder au reporting
                  </Button>

                  {/* 🔴 BOUTON EXISTANT – PDF (inchangé) */}
                  <PlanningClientExportDialog />

                  {/* 🟢 NOUVEAU BOUTON – PLANNING CLIENT */}
                  <div>
                    <Button
                      variant="outline"
                      className="bg-[#840404] hover:bg-[#750303] text-white flex items-center gap-2"
                      onClick={() => {
                        // 👉 on déclenche EXACTEMENT le même pop-up
                        // la différence sera gérée DANS le composant ensuite
                        document
                          .querySelector<HTMLButtonElement>(
                            '[data-planning-client-export]'
                          )
                          ?.click()
                      }}
                    >
                      <Calendar className="w-4 h-4" />
                      Générer planning
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </MainLayout>
  )
}
