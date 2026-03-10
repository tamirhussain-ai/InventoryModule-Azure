import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Package, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { AuthService } from '../services/auth';

function extractResetToken(): string | null {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));

  return (
    url.searchParams.get('token') ||
    url.searchParams.get('code') ||
    hashParams.get('token') ||
    hashParams.get('code') ||
    hashParams.get('access_token')
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    const token = extractResetToken();

    if (!token) {
      setLinkError(true);
      toast.error('No valid reset link found. Please request a new password reset.');
      setTimeout(() => navigate('/forgot-password'), 3000);
      return;
    }

    setResetToken(token);
    setSessionReady(true);
    window.history.replaceState(null, '', window.location.pathname);
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetToken) {
      toast.error('Missing reset token. Please request a new password reset.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await AuthService.resetPassword(resetToken, password);
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/login'), 1500);
    } catch (error: any) {
      console.error('[ResetPassword] Error:', error);
      toast.error(error.message || 'Failed to reset password');
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
          <CardTitle className="text-2xl">Reset Your Password</CardTitle>
          <CardDescription>
            {linkError
              ? 'This reset link is invalid or has expired.'
              : sessionReady
              ? 'Enter your new password below'
              : 'Verifying your reset link…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkError ? (
            <div className="space-y-4 text-center">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
              <p className="text-sm text-gray-600">Redirecting you to request a new link…</p>
            </div>
          ) : !sessionReady ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500">Must be at least 6 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Resetting…' : 'Reset Password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
