
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSession, getUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

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
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setUser(session?.user ?? null);
      }
    );

    // Check for existing session
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

    // Cleanup subscription on component unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [toast]);

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
