
import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useNavigate } from 'react-router-dom';

export function withAuthGuard<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        navigate('/login');
      }
    }, [isAuthenticated, isLoading, navigate]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-pulse text-xl text-gray-500">Chargement...</div>
        </div>
      );
    }

    return isAuthenticated ? <Component {...props} /> : null;
  };
}
