import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth-context";
import Index from "./pages/Index";
import Login from "./pages/Login";
import BackOffice from "./pages/BackOffice";
import Commandes from "./pages/Commandes";
import CommandesClone from "./pages/commandesclone"; // 👉 AJOUT ICI
import Planning from "./pages/Planning";
import Clients from "./pages/Clients";
import Candidats from "./pages/Candidats";
import Parametrages from "./pages/Parametrages";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/back-office" element={<BackOffice />} />
            <Route path="/commandes" element={<Commandes />} />
            <Route path="/commandesclone" element={<CommandesClone />} /> {/* 👉 AJOUT ICI */}
            <Route path="/planning" element={<Planning />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/candidats" element={<Candidats />} />
            <Route path="/parametrages" element={<Parametrages />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
