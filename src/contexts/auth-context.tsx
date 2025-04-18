
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { getSession, getUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function loadUserData() {
      try {
        const { session, error: sessionError } = await getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setIsLoading(false);
          return;
        }

        if (session) {
          const { user: userData, error: userError } = await getUser();
          
          if (userError) {
            console.error('User error:', userError);
            setIsLoading(false);
            return;
          }
          
          setUser(userData);
        }
      } catch (error) {
        console.error('Auth context error:', error);
        toast({
          title: "Erreur d'authentification",
          description: "Un problème est survenu avec votre session.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadUserData();
  }, [toast]);

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
