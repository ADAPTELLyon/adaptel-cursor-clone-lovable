import MainLayout from "@/components/main-layout"
import WeeklyReporting from "@/components/reporting/WeeklyReporting"

export default function Reporting() {
  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <WeeklyReporting />
      </div>
    </MainLayout>
  )
}
