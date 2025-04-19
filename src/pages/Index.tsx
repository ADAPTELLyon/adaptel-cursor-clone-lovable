
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Only redirect once loading is complete
    if (!isLoading) {
      if (isAuthenticated) {
        navigate('/commandes', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Show loading indicator while auth state is being determined
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="animate-pulse text-xl text-gray-500">Chargement...</div>
    </div>
  );
};

export default Index;
