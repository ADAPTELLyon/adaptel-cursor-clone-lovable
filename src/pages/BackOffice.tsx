
import MainLayout from "@/components/main-layout"

export default function BackOffice() {
  return (
    <MainLayout>
      <div className="rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">Back Office</h1>
        <p className="mt-4 text-gray-600">Bienvenue dans le back office d'Adaptel Lyon</p>
      </div>
    </MainLayout>
  )
}
