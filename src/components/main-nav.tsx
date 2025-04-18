
import { Link, useNavigate } from "react-router-dom"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { Home, Box, Calendar, Users, User, Settings, LogOut } from "lucide-react"
import { signOut } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await signOut();
    
    if (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la déconnexion',
        variant: 'destructive',
      });
      return;
    }
    
    toast({
      title: 'Déconnexion réussie',
      description: 'Vous avez été déconnecté avec succès',
    });
    
    navigate('/login');
  };

  return (
    <div className="flex h-16 items-center px-4 border-b bg-white">
      <Link to="/" className="mr-6 flex items-center space-x-2">
        <img 
          src="/lovable-uploads/aef96993-219b-4605-9395-ee7283fbf87d.png"
          alt="Adaptel Logo"
          className="h-8 w-8"
        />
        <span className="text-xl font-bold text-adaptel">ADAPTEL</span>
        <span className="text-xl font-semibold text-gray-800">Lyon</span>
      </Link>

      <span className="text-sm text-gray-500">
        {user?.email}
      </span>

      <NavigationMenu className="ml-auto">
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

      <button
        onClick={handleSignOut}
        className="ml-4 p-2 rounded-md hover:bg-accent"
        aria-label="Se déconnecter"
      >
        <LogOut className="h-5 w-5 text-gray-500" />
      </button>
    </div>
  )
}
