
import { Link } from "react-router-dom"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { Home, Box, Calendar, Users, User, Settings } from "lucide-react"

const routes = [
  {
    title: "Back Office",
    href: "/back-office",
    icon: Home
  },
  {
    title: "Commandes",
    href: "/commandes",
    icon: Box
  },
  {
    title: "Planning",
    href: "/planning",
    icon: Calendar
  },
  {
    title: "Clients",
    href: "/clients",
    icon: Users
  },
  {
    title: "Candidats",
    href: "/candidats",
    icon: User
  },
  {
    title: "Paramètres",
    href: "/parametrages",
    icon: Settings
  }
]

export function MainNav() {
  const { user } = useAuth()
  
  return (
    <div className="flex h-16 items-center px-4 border-b bg-white">
      <Link to="/" className="mr-6 flex items-center space-x-2">
        <span className="text-xl font-bold text-adaptel">ADAPTEL</span>
        <span className="text-xl font-semibold text-gray-800">Lyon</span>
      </Link>

      <span className="ml-auto mr-6 text-sm text-gray-500">
        {user?.email}
      </span>

      <NavigationMenu>
        <NavigationMenuList>
          {routes.map(({ title, href, icon: Icon }) => (
            <NavigationMenuItem key={href}>
              <Link
                to={href}
                className={cn(
                  "group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50",
                )}
              >
                <Icon className="mr-2 h-4 w-4" />
                {title}
              </Link>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  )
}
