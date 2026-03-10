import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Package, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const sessionEstablished = useRef(false);

  useEffect(() => {
    // -----------------------------------------------------------------------
    // Supabase v2 uses PKCE by default → reset link arrives as ?code=XXXXX
    // Older / explicit implicit flow → tokens arrive as #access_token=...
    // We handle BOTH plus the onAuthStateChange PASSWORD_RECOVERY event.
    // -----------------------------------------------------------------------

    const markReady = () => {
      if (sessionEstablished.current) return;
      sessionEstablished.current = true;
      setSessionReady(true);
      // Strip sensitive tokens/code from the URL bar
      window.history.replaceState(null, '', window.location.pathname);
    };

    const markError = (msg?: string) => {
      if (sessionEstablished.current) return;
      console.error('[ResetPassword] Link error:', msg);
      setLinkError(true);
      toast.error(msg || 'Invalid or expired reset link. Please request a new one.');
      setTimeout(() => navigate('/forgot-password'), 3000);
    };

    // 1. Subscribe to auth state changes — fires for both PKCE & implicit flows
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ResetPassword] Auth event:', event, '| session:', !!session);
      if (event === 'PASSWORD_RECOVERY') {
        markReady();
      }
    });

    // 2. Parse the current URL for tokens
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');                           // PKCE
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');                  // implicit
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');

    console.log('[ResetPassword] code:', !!code, '| access_token:', !!accessToken, '| type:', type);

    if (code) {
      // PKCE flow — exchange the one-time code for a session
      console.log('[ResetPassword] Exchanging PKCE code for session…');
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error) {
            console.error('[ResetPassword] exchangeCodeForSession error:', error);
            markError('Invalid or expired reset link. Please request a new one.');
          } else {
            console.log('[ResetPassword] Code exchange OK — waiting for PASSWORD_RECOVERY event');
            // PASSWORD_RECOVERY onAuthStateChange fires next; markReady() handles it.
            // Safety net in case the event was already consumed before subscription:
            if (!sessionEstablished.current) markReady();
          }
        });

    } else if (accessToken && refreshToken) {
      // Implicit flow — set session directly
      console.log('[ResetPassword] Setting session from hash tokens…');
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            console.error('[ResetPassword] setSession error:', error);
            markError('Invalid or expired reset link. Please request a new one.');
          } else {
            console.log('[ResetPassword] Session set OK');
            markReady();
          }
        });

    } else {
      // No explicit tokens — Supabase may have auto-processed the URL before this
      // component mounted (detectSessionInUrl=true). Check for an existing session.
      console.warn('[ResetPassword] No code or tokens in URL — checking existing session');
      const timeout = setTimeout(async () => {
        if (sessionEstablished.current) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('[ResetPassword] Found existing session via getSession()');
          markReady();
        } else {
          markError('No valid reset link found. Please request a new password reset.');
        }
      }, 800);

      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    }

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error('[ResetPassword] updateUser error:', error);
        throw new Error(error.message);
      }

      console.log('[ResetPassword] Password updated successfully');
      toast.success('Password reset successfully!');

      await supabase.auth.signOut();
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