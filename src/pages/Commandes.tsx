import MainLayout from "@/components/main-layout"
import { SectionFixeCommandes } from "@/components/commandes/section-fixe-commandes"
import { PlanningClientTable } from "@/components/commandes/PlanningClientTable"

export default function Commandes() {
  return (
    <MainLayout>
      <SectionFixeCommandes />
      <PlanningClientTable />
    </MainLayout>
  )
}

