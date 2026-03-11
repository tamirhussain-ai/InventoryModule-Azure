import { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
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

export default function Login() {
  const { isLoading, isAuthenticated, isAccessDenied, login, user } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  // Already authenticated — routes.tsx loader handles redirect
  // but as a fallback, show loading while we wait
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Signing you in...</p>
        </div>
      </div>
    );
  }

  if (isAccessDenied) return <AccessDenied />;

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await login();
      // loginRedirect navigates away — this line won't be reached
    } catch (error: any) {
      console.error('Login error:', error);
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
            {signingIn ? 'Redirecting to Microsoft...' : 'Sign in with Microsoft'}
          </Button>
          <p className="text-center text-xs text-gray-500 pt-2">
            Use your university email. Contact your administrator if you need access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
