import { useState, useRef } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Package, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// Minimum seconds between reset email sends to respect Supabase rate limits
const COOLDOWN_SECONDS = 60;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setCooldownRemaining(COOLDOWN_SECONDS);
    cooldownTimer.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimer.current!);
          cooldownTimer.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading || cooldownRemaining > 0) return;

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        // Rate limit: give a clear, actionable message
        if (
          error.message.toLowerCase().includes('rate limit') ||
          error.message.toLowerCase().includes('too many') ||
          error.status === 429
        ) {
          toast.error(
            'Too many reset emails sent. Please wait a minute before trying again.',
            { duration: 6000 }
          );
          startCooldown();
          return;
        }
        throw error;
      }

      console.log('Password reset email dispatched for:', email);
      setSubmitted(true);
      toast.success('Password reset link sent! Check your email.');
      startCooldown();
    } catch (error: any) {
      console.error('Forgot password error:', error);
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || cooldownRemaining > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Package className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {submitted ? 'Check Your Email' : 'Forgot Password'}
          </CardTitle>
          <CardDescription>
            {submitted
              ? 'If an account exists with this email, you will receive a password reset link shortly.'
              : "Enter your email address and we'll send you a link to reset your password."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <p className="text-center text-sm text-gray-600">
                If an account exists for <strong>{email}</strong>, a reset link was sent.
                Please check your <strong>inbox and spam/junk folder</strong>.
              </p>

              {/* Actionable checklist */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 font-medium">Not seeing the email? Check these:</p>
                </div>
                <ul className="text-xs text-amber-700 space-y-1 ml-6 list-disc">
                  <li>Look in your <strong>spam / junk</strong> folder — Supabase emails are often filtered.</li>
                  <li>
                    In <strong>Supabase Dashboard → Authentication → URL Configuration</strong>, confirm{' '}
                    <code className="bg-amber-100 px-1 rounded">{window.location.origin}/reset-password</code>{' '}
                    is listed under <em>Redirect URLs</em>. Without this, the link will not work.
                  </li>
                  <li>Supabase free tier allows <strong>4 reset emails per hour</strong>. Wait a minute if you've sent several.</li>
                  <li>Make sure the email address belongs to a registered account.</li>
                </ul>
              </div>

              {cooldownRemaining > 0 && (
                <p className="text-center text-xs text-gray-400">
                  Didn't receive it? You can resend in {cooldownRemaining}s.
                </p>
              )}
              {cooldownRemaining === 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSubmitted(false)}
                >
                  Resend Email
                </Button>
              )}
              <Button asChild className="w-full">
                <Link to="/login">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <Button type="submit" className="w-full" disabled={isDisabled}>
                  {loading
                    ? 'Sending…'
                    : cooldownRemaining > 0
                    ? `Resend in ${cooldownRemaining}s`
                    : 'Send Reset Link'}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                <Link to="/login" className="text-blue-600 hover:underline inline-flex items-center">
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}