import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../lib/authContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Package } from 'lucide-react';
import AccessDenied from './AccessDenied';

function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F35325" />
      <rect x="11" y="1" width="9" height="9" fill="#81BC06" />
      <rect x="1" y="11" width="9" height="9" fill="#05A6F0" />
      <rect x="11" y="11" width="9" height="9" fill="#FFBA08" />
    </svg>
  );
}

const ROLE_ROUTES: Record<string, string> = {
  admin: '/admin',
  fulfillment: '/fulfillment',
  approver: '/approver',
  requestor: '/requestor',
};

export default function Login() {
  const navigate = useNavigate();
  const { isLoading, isAccessDenied, login } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  if (isAccessDenied) return <AccessDenied />;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      const user = await login();
      if (user) {
        // Redirect immediately using the returned user — no need to wait for state update
        const route = ROLE_ROUTES[user.role] || '/requestor';
        console.log('[Login] Redirecting to:', route, 'for role:', user.role);
        navigate(route, { replace: true });
      } else {
        // Email not on allowlist — isAccessDenied will flip and show AccessDenied
        console.log('[Login] User not on allowlist');
      }
    } catch (error: any) {
      if (error?.errorCode === 'user_cancelled') {
        setSigningIn(false);
        return;
      }
      console.error('Login error:', error);
      toast.error('Sign in failed. Please try again.');
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Package className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">SHC Inventory System</CardTitle>
          <CardDescription>Sign in with your university Microsoft account</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <Button
            onClick={handleLogin}
            disabled={signingIn}
            variant="outline"
            className="w-full flex items-center gap-3 h-11 text-sm font-medium border-gray-300 hover:bg-gray-50"
          >
            <MicrosoftLogo />
            {signingIn ? 'Signing in...' : 'Sign in with Microsoft'}
          </Button>
          <p className="text-center text-xs text-gray-500 pt-2">
            Use your university email. Contact your administrator if you need access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
