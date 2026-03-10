import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Package, ArrowLeft, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface TestResult {
  success: boolean;
  error?: string;
  durationMs: number;
  redirectTo: string;
  timestamp: string;
}

export default function DebugForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const redirectTo = `${window.location.origin}/reset-password`;
    const start = Date.now();

    console.log('=== DEBUG FORGOT PASSWORD ===');
    console.log('Email:', email);
    console.log('redirectTo:', redirectTo);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      const durationMs = Date.now() - start;
      console.log('Result — error:', error, '| duration:', durationMs, 'ms');

      setResult({
        success: !error,
        error: error?.message,
        durationMs,
        redirectTo,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message || String(err),
        durationMs: Date.now() - start,
        redirectTo,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center">
                  <Package className="h-6 w-6 mr-2 text-blue-600" />
                  Debug: Forgot Password
                </CardTitle>
                <CardDescription>
                  Tests <code>supabase.auth.resetPasswordForEmail()</code> directly from the browser
                </CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link to="/forgot-password">Normal Page</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
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
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Sending…' : 'Test Reset Password Email'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.success
                  ? <><CheckCircle className="h-5 w-5" /> API call succeeded</>
                  : <><AlertCircle className="h-5 w-5" /> API call failed</>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="font-medium">Status</div>
                <div>{result.success ? '✅ No error returned' : `❌ ${result.error}`}</div>
                <div className="font-medium">Duration</div>
                <div>{result.durationMs} ms</div>
                <div className="font-medium">redirectTo</div>
                <div className="font-mono text-xs break-all">{result.redirectTo}</div>
                <div className="font-medium">Timestamp</div>
                <div className="font-mono text-xs">{result.timestamp}</div>
              </div>

              {result.success && (
                <div className="bg-green-100 border border-green-300 rounded p-3 mt-2 space-y-1 text-green-800 text-xs">
                  <p className="font-semibold">Next steps:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Check your <strong>inbox and spam/junk</strong> folder for the reset email.</li>
                    <li>
                      Verify <code className="bg-green-200 px-1 rounded">{result.redirectTo}</code> is in{' '}
                      <strong>Supabase Dashboard → Auth → URL Configuration → Redirect URLs</strong>.
                      If it's missing, the email link will be blocked or won't work.
                    </li>
                    <li>Supabase free tier caps reset emails at <strong>4 per hour</strong>.</li>
                    <li>Click the link in the email — it should land on <code className="bg-green-200 px-1 rounded">/reset-password?code=…</code></li>
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Supabase setup checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-5 w-5 text-blue-500" />
              Supabase Setup Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-600 shrink-0">1.</span>
                <span>
                  <strong>Redirect URL whitelist</strong> — In Supabase Dashboard go to{' '}
                  <em>Authentication → URL Configuration → Redirect URLs</em> and add{' '}
                  <code className="bg-gray-100 px-1 rounded text-xs">{window.location.origin}/reset-password</code>.
                  Without this Supabase will reject the <code>redirectTo</code> in the email link.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-600 shrink-0">2.</span>
                <span>
                  <strong>Site URL</strong> — Verify <em>Authentication → URL Configuration → Site URL</em> is set to{' '}
                  <code className="bg-gray-100 px-1 rounded text-xs">{window.location.origin}</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-600 shrink-0">3.</span>
                <span>
                  <strong>Email provider</strong> — On the Supabase free tier the built-in SMTP
                  is limited to 4 emails/hour and emails often land in spam. Consider configuring a
                  custom SMTP provider under <em>Authentication → Email</em> for better deliverability.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-600 shrink-0">4.</span>
                <span>
                  <strong>Auth flow</strong> — This app uses Supabase's default <strong>PKCE</strong> flow.
                  The reset link will arrive as <code className="bg-gray-100 px-1 rounded text-xs">/reset-password?code=…</code>{' '}
                  (not a hash fragment). The <code>/reset-password</code> page now handles this correctly.
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button asChild variant="outline">
            <Link to="/login">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
