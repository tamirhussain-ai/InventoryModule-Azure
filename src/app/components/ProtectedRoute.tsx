import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AuthService } from '../services/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = AuthService.getAccessToken();
    const user = AuthService.getCurrentUser();

    console.log('ProtectedRoute - Checking auth:', { hasToken: !!token, hasUser: !!user });

    if (!token || !user) {
      console.log('ProtectedRoute - No valid session, redirecting to login');
      navigate('/', { replace: true });
      return;
    }

    // Optionally verify the session with the server
    try {
      const sessionUser = await AuthService.checkSession();
      if (!sessionUser) {
        console.log('ProtectedRoute - Session invalid, redirecting to login');
        navigate('/', { replace: true });
        return;
      }
      console.log('ProtectedRoute - Auth valid, rendering page');
      setIsChecking(false);
    } catch (error) {
      console.error('ProtectedRoute - Session check failed:', error);
      navigate('/', { replace: true });
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
