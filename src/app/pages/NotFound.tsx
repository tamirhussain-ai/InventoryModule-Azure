import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';
import { AuthService } from '../services/auth';
import { useNavigate, useLocation } from 'react-router';

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = AuthService.getCurrentUser();

  useEffect(() => {
    // Log the problematic URL
    console.error('=== 404 ERROR ===');
    console.error('Path:', location.pathname);
    console.error('Search:', location.search);
    console.error('State:', location.state);
    console.error('User:', user?.email, 'Role:', user?.role);
    console.error('================');

    // If user is logged in, give them 2 seconds to see the error, then redirect to their dashboard
    if (user) {
      console.log('404 - User is logged in, will redirect to dashboard in 2 seconds');
      const timeout = setTimeout(() => {
        const role = user.role;
        switch (role) {
          case 'admin':
            navigate('/admin', { replace: true });
            break;
          case 'fulfillment':
            navigate('/fulfillment', { replace: true });
            break;
          case 'approver':
            navigate('/approver', { replace: true });
            break;
          case 'requestor':
          default:
            navigate('/requestor', { replace: true });
            break;
        }
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [user, navigate, location]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-12 pb-12 text-center">
          <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
          <p className="text-lg text-gray-600 mb-6">Page not found</p>
          <p className="text-sm text-gray-500 mb-4">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <p className="text-xs text-gray-400 mb-8 font-mono">
            Path: {location.pathname}
          </p>
          {user && <p className="text-sm text-blue-600 mb-8">Redirecting to your dashboard...</p>}
          <Link to={user ? `/${user.role}` : '/'}>
            <Button>{user ? 'Go to Dashboard Now' : 'Back to Home'}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}