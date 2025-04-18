
import React from 'react';
import { withAuthGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { AdaptelLogo } from '@/components/adaptel-logo';

function CommandesPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <AdaptelLogo />
          <Button onClick={handleSignOut} variant="outline">
            Se déconnecter
          </Button>
        </div>
        
        <div className="bg-white p-8 rounded-xl shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Gestion des commandes
          </h1>
          <p className="text-gray-600">
            Bienvenue dans votre interface de gestion des commandes.
            Le contenu sera ajouté dans les prochaines étapes.
          </p>
        </div>
      </div>
    </div>
  );
}

export default withAuthGuard(CommandesPage);
