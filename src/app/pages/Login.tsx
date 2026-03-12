<<<<<<< HEAD
import { useEffect, useState } from 'react';
=======
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
>>>>>>> d12f103 (Local login page changes)
import { useAuth } from '../../lib/authContext';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import AccessDenied from './AccessDenied';
import { Package, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

function MicrosoftLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#F35325" />
      <rect x="11" y="1" width="9" height="9" fill="#81BC06" />
      <rect x="1" y="11" width="9" height="9" fill="#05A6F0" />
      <rect x="11" y="11" width="9" height="9" fill="#FFBA08" />
    </svg>
  );
}

<<<<<<< HEAD
export default function Login() {
  const { isLoading, isAuthenticated, isAccessDenied, login, user } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    const role = user?.role || 'requestor';
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
      default:
        navigate('/requestor', { replace: true });
        break;
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  // Already authenticated — routes.tsx loader handles redirect
  // but as a fallback, show loading while we wait
=======
const ROLE_ROUTES: Record<string, string> = {
  admin: '/admin',
  fulfillment: '/fulfillment',
  approver: '/approver',
  requestor: '/requestor',
};

export default function Login() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated, isAccessDenied, user, loginWithMicrosoft, loginWithPassword } = useAuth();
  const hasNavigated = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msalBusy, setMsalBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  // Redirect once authenticated — guard prevents double navigation
  useEffect(() => {
    console.log('[Login] effect fired - isLoading:', isLoading, 'isAuthenticated:', isAuthenticated, 'user:', user?.email, 'hasNavigated:', hasNavigated.current);
    if (!isLoading && isAuthenticated && user && !hasNavigated.current) {
      hasNavigated.current = true;
      console.log('[Login] navigating to', ROLE_ROUTES[user.role]);
      navigate(ROLE_ROUTES[user.role] || '/requestor', { replace: true });
    }
  }, [isLoading, isAuthenticated, user]);

>>>>>>> d12f103 (Local login page changes)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isAccessDenied) return <AccessDenied />;

  const handleMicrosoft = async () => {
    setMsalBusy(true);
    try { await loginWithMicrosoft(); }
    catch { setMsalBusy(false); }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwBusy(true);
    try {
      await loginWithPassword(email, password);
      // navigate handled by useEffect above
    } catch (err: any) {
      toast.error(err.message || 'Sign in failed');
      setPwBusy(false);
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
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <Button
            onClick={handleMicrosoft}
            disabled={msalBusy}
            variant="outline"
            className="w-full flex items-center gap-3 h-11 text-sm font-medium border-gray-300 hover:bg-gray-50"
          >
            <MicrosoftLogo />
            {msalBusy ? 'Redirecting to Microsoft…' : 'Sign in with Microsoft'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">or</span>
            </div>
          </div>

          <form onSubmit={handlePassword} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={pwBusy}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={pwBusy}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={pwBusy || !email || !password} className="w-full h-11">
              {pwBusy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-500 pt-1">
            Contact your administrator if you need access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
