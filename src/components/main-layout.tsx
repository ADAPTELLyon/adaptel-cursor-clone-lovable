
import { MainNav } from "./main-nav"
import { withAuthGuard } from "./auth-guard"

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <MainNav />
      <main className="container mx-auto p-8">
        {children}
      </main>
    </div>
  )
}

export default withAuthGuard(MainLayout)
