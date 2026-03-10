import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { AuthService } from '../services/auth';
import { toast } from 'sonner';
import { Package } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    if (AuthService.isAuthenticated()) {
      const user = AuthService.getCurrentUser();
      redirectToDashboard(user?.role);
    }
  }, []);

  const redirectToDashboard = (role?: string) => {
    switch (role) {
      case 'admin':
        navigate('/admin');
        break;
      case 'fulfillment':
        navigate('/fulfillment');
        break;
      case 'approver':
        navigate('/approver');
        break;
      case 'requestor':
      default:
        navigate('/requestor');
        break;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('=== LOGIN ATTEMPT ===');
      console.log('Email:', email);
      
      const result = await AuthService.signin(email, password);
      
      console.log('=== LOGIN SUCCESS ===');
      console.log('Result:', result);
      console.log('Access token received:', result.accessToken ? `Yes (${result.accessToken.length} chars)` : 'No');
      console.log('User:', result.user);
      console.log('Debug info:', result.debug);
      
      // Verify token was stored in localStorage
      const storedToken = localStorage.getItem('accessToken');
      console.log('Token stored in localStorage:', storedToken ? `Yes (${storedToken.length} chars)` : 'No');
      console.log('Tokens match:', result.accessToken === storedToken);
      
      toast.success('Signed in successfully!');
      // If user has a temporary password or expired password, force them to change it first
      if (result.user.mustResetPassword) {
        navigate('/change-password');
      } else if (result.passwordExpired) {
        toast.warning('Your password has expired. Please set a new password to continue.');
        navigate('/change-password?reason=expired');
      } else {
        redirectToDashboard(result.user.role);
      }
    } catch (error: any) {
      console.error('=== LOGIN FAILED ===');
      console.error('Error:', error);
      toast.error(error.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Package className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">SHC Inventory System</CardTitle>
          <CardDescription>Sign in to access your inventory dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="text-right">
                <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-gray-600">Don't have an account? </span>
            <Link to="/signup" className="text-blue-600 hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
