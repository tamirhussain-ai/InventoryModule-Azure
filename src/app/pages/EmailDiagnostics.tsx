import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { AuthService } from '../services/auth';
import { useNavigate } from 'react-router';

export default function EmailDiagnostics() {
  const [loading, setLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await AuthService.signout();
      toast.success('Logged out successfully. Please log back in.');
      navigate('/');
    } catch (error) {
      toast.error('Logout failed, but clearing local session anyway');
      localStorage.clear();
      navigate('/');
    }
  };

  const testAuth = () => {
    const token = localStorage.getItem('accessToken');
    const user = AuthService.getCurrentUser();
    console.log('=== Auth Test ===');
    console.log('Access Token:', token ? `Present (${token.length} chars)` : 'Missing');
    console.log('Token value (first 50 chars):', token ? token.substring(0, 50) : 'N/A');
    console.log('Current User:', user);
    console.log('User Role:', user?.role);
    console.log('ProjectId:', projectId);
    console.log('API URL:', `https://${projectId}.supabase.co/functions/v1/make-server-5ec3cec0/email-diagnostics`);
    
    if (!token) {
      toast.error('No access token found. Please log in again.');
    } else if (!user) {
      toast.error('No user found. Please log in again.');
    } else if (user.role !== 'admin') {
      toast.error(`You must be an admin. Current role: ${user.role}`);
    } else {
      toast.success('Authentication looks good! Token and admin role verified.');
    }
  };

  const checkAuthStatus = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        toast.error('No access token found');
        return;
      }

      const url = `https://${projectId}.supabase.co/functions/v1/make-server-5ec3cec0/debug/auth-check?token=${encodeURIComponent(accessToken)}`;
      console.log('Checking auth status at:', url.replace(accessToken, '***TOKEN***'));
      console.log('Token length:', accessToken.length);
      console.log('Token first 30:', accessToken.substring(0, 30));
      console.log('Token last 30:', accessToken.substring(accessToken.length - 30));
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      const data = await response.json();
      console.log('=== AUTH STATUS CHECK RESPONSE ===');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.sessionInKV === 'Found') {
        toast.success('✅ Session found in database!');
      } else {
        toast.error(`❌ Session NOT found in database. ${data.totalSessionsInDB ? `Found ${data.totalSessionsInDB} other sessions.` : ''}`);
        
        if (data.sampleSessions && data.sampleSessions.length > 0) {
          console.log('Sample of existing sessions:', data.sampleSessions);
        }
      }
    } catch (error: any) {
      console.error('Auth check error:', error);
      toast.error('Failed to check auth status');
    }
  };

  const testKVStore = async () => {
    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-5ec3cec0/debug/kv-test`;
      console.log('Testing KV store at:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      const data = await response.json();
      
      console.log('=== KV STORE TEST RESPONSE ===');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.success) {
        toast.success(`✅ KV Store working! Found ${data.tests.sessionsCount} sessions, ${data.tests.usersCount} users`);
      } else {
        toast.error('❌ KV Store test failed: ' + data.error);
      }
    } catch (error: any) {
      console.error('KV test error:', error);
      toast.error('Failed to test KV store');
    }
  };

  const runDiagnostics = async () => {
    setLoading(true);
    setSessionExpired(false);
    try {
      const accessToken = localStorage.getItem('accessToken');
      const user = AuthService.getCurrentUser();
      
      console.log('=== RUN DIAGNOSTICS CALLED V2 ===');
      console.log('Access Token:', accessToken ? `Present (${accessToken.length} chars)` : 'MISSING');
      console.log('Current User:', user);
      console.log('User Role:', user?.role);
      
      if (!accessToken) {
        toast.error('No access token found. Redirecting to login...', { duration: 3000 });
        setTimeout(() => {
          localStorage.clear();
          navigate('/');
        }, 2000);
        setDiagnostics(null);
        setLoading(false);
        setSessionExpired(true);
        return;
      }
      
      if (!user) {
        toast.error('No user found. Redirecting to login...', { duration: 3000 });
        setTimeout(() => {
          localStorage.clear();
          navigate('/');
        }, 2000);
        setDiagnostics(null);
        setLoading(false);
        setSessionExpired(true);
        return;
      }
      
      if (user.role !== 'admin') {
        toast.error(`Admin access required. Your role: ${user.role}`);
        setLoading(false);
        return;
      }
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-5ec3cec0/email-diagnostics?token=${encodeURIComponent(accessToken)}`;
      console.log('Making request to:', url.replace(accessToken, '***TOKEN***'));
      console.log('Request method: GET with token in query parameter AND Authorization header');
      console.log('Authorization header: Bearer ${publicAnonKey}');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      // Try to get response body
      const responseText = await response.text();
      console.log('Response body:', responseText);
      
      // Handle 401 specifically - session expired
      if (response.status === 401) {
        console.error('❌ Session expired or invalid (401)');
        setSessionExpired(true);
        toast.error('Your session has expired. Please log in again.', {
          duration: 5000,
        });
        setDiagnostics(null);
        setLoading(false);
        return;
      }
      
      // Parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        throw new Error('Invalid response from server');
      }
      
      console.log('Parsed data:', data);

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      setDiagnostics(data);
      setSessionExpired(false);
      toast.success('Diagnostics loaded successfully!');
    } catch (error: any) {
      console.error('❌ DIAGNOSTICS ERROR:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      const errorMessage = error.message || 'Failed to run diagnostics';
      toast.error(errorMessage, { duration: 5000 });
      setDiagnostics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  // Auto-redirect to login if session expired with countdown
  useEffect(() => {
    if (sessionExpired) {
      setRedirectCountdown(5);
      
      const countdownInterval = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(countdownInterval);
    }
  }, [sessionExpired]);

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="w-5 h-5 text-green-600" />
    ) : (
      <XCircle className="w-5 h-5 text-red-600" />
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Email System Diagnostics</h1>
        <p className="text-gray-600">
          Check the status of your email notification system
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Email Configuration Status
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testAuth}
              >
                Test Auth
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={checkAuthStatus}
              >
                Check Session
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={testKVStore}
              >
                Test KV Store
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={runDiagnostics}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Complete diagnostic check of your email notification system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500">Running diagnostics...</p>
            </div>
          ) : sessionExpired ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
              <h3 className="text-xl font-bold mb-3 text-gray-900">Session Expired</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Your session has expired (sessions last 24 hours). You need to log in again to access diagnostics.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 max-w-md mx-auto text-left">
                <p className="text-sm font-semibold text-amber-900 mb-2">What happened?</p>
                <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                  <li>Your session token is no longer valid</li>
                  <li>Sessions automatically expire after 24 hours</li>
                  <li>The server cannot verify your identity</li>
                </ul>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 max-w-md mx-auto">
                <p className="text-sm text-blue-800">
                  <strong>Redirecting to login in {redirectCountdown} seconds...</strong>
                </p>
                <p className="text-xs text-blue-600 mt-1">Or click the button below to go now</p>
              </div>
              <Button
                size="lg"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="w-5 h-5" />
                Go to Login Page Now
              </Button>
            </div>
          ) : diagnostics ? (
            <div className="space-y-6">
              {/* API Key Status */}
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <div className="mt-0.5">
                  {getStatusIcon(diagnostics.resendApiKey.configured)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Resend API Key</h3>
                  <p className="text-sm text-gray-600">
                    {diagnostics.resendApiKey.configured
                      ? `Configured ✓ (${diagnostics.resendApiKey.length} characters)`
                      : 'Not configured ✗'}
                  </p>
                  {diagnostics.resendApiKey.partial && (
                    <div className="mt-2 bg-gray-50 p-2 rounded border">
                      <p className="text-xs text-gray-500 mb-1">Configured key (partial):</p>
                      <code className="text-xs font-mono bg-white px-2 py-1 rounded border">
                        {diagnostics.resendApiKey.partial}
                      </code>
                      <div className="mt-2 space-y-1">
                        {diagnostics.resendApiKey.prefix?.startsWith('re_') ? (
                          <p className="text-xs text-green-600 font-semibold">
                            ✓ Valid Resend API key format (starts with "re_")
                          </p>
                        ) : (
                          <p className="text-xs text-red-600 font-semibold">
                            ✗ Invalid key format. Resend API keys should start with "re_"
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {!diagnostics.resendApiKey.configured && (
                    <p className="text-sm text-red-600 mt-2">
                      ⚠️ RESEND_API_KEY environment variable is missing
                    </p>
                  )}
                </div>
              </div>

              {/* Global Settings */}
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <div className="mt-0.5">
                  {getStatusIcon(diagnostics.globalSettings.enabled)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Global Email Notifications</h3>
                  <p className="text-sm text-gray-600">
                    {diagnostics.globalSettings.enabled
                      ? 'Enabled ✓'
                      : 'Disabled ✗'}
                  </p>
                  {!diagnostics.globalSettings.enabled && (
                    <div className="mt-2">
                      <p className="text-sm text-red-600 mb-2">
                        ⚠️ Email notifications are globally disabled
                      </p>
                      <p className="text-sm text-gray-600">
                        To enable: Go to <strong>Admin Settings &gt; Email Notifications</strong> and toggle ON
                      </p>
                    </div>
                  )}
                  {diagnostics.globalSettings.lastUpdated && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last updated: {new Date(diagnostics.globalSettings.lastUpdated).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Approvers */}
              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <div className="mt-0.5">
                  {getStatusIcon(diagnostics.approvers.count > 0)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Approvers Found</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {diagnostics.approvers.count} approver(s) configured
                  </p>
                  {diagnostics.approvers.list.length > 0 ? (
                    <div className="space-y-1">
                      {diagnostics.approvers.list.map((approver: any, idx: number) => (
                        <div key={idx} className="text-sm flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span>
                            <strong>{approver.name}</strong> ({approver.email})
                          </span>
                          <Badge variant={approver.emailEnabled ? 'default' : 'secondary'}>
                            {approver.emailEnabled ? 'Emails ON' : 'Emails OFF'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-red-600">
                      ⚠️ No approvers found. Orders will not trigger email notifications.
                    </p>
                  )}
                </div>
              </div>

              {/* Overall Status */}
              <div className={`p-4 rounded-lg border-2 ${
                diagnostics.overall.ready
                  ? 'bg-green-50 border-green-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-start space-x-3">
                  {diagnostics.overall.ready ? (
                    <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-yellow-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">
                      {diagnostics.overall.ready
                        ? 'Email System Ready ✓'
                        : 'Email System Not Ready'}
                    </h3>
                    <p className="text-sm">
                      {diagnostics.overall.message}
                    </p>
                    {diagnostics.overall.issues.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {diagnostics.overall.issues.map((issue: string, idx: number) => (
                          <li key={idx} className="text-sm text-red-600">
                            • {issue}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              {!diagnostics.overall.ready && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-blue-900">Next Steps:</h3>
                  <ol className="space-y-2 text-sm text-blue-800">
                    {!diagnostics.resendApiKey.configured && (
                      <li>1. Configure RESEND_API_KEY environment variable</li>
                    )}
                    {!diagnostics.globalSettings.enabled && (
                      <li>
                        {!diagnostics.resendApiKey.configured ? '2' : '1'}. Go to Admin Settings &gt; Email Notifications tab
                      </li>
                    )}
                    {!diagnostics.globalSettings.enabled && (
                      <li>
                        {!diagnostics.resendApiKey.configured ? '3' : '2'}. Toggle "Enable Email Notifications" to ON
                      </li>
                    )}
                    {diagnostics.approvers.count === 0 && (
                      <li>
                        {(!diagnostics.resendApiKey.configured || !diagnostics.globalSettings.enabled) ? '4' : '1'}. 
                        Create at least one user with "Approver" or "Admin" role
                      </li>
                    )}
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-semibold mb-2 text-gray-900">Failed to Load Diagnostics</h3>
              <p className="text-gray-600 mb-4">
                Your session may have expired. Please try one of the following:
              </p>
              <div className="space-y-2 mb-6 text-sm text-left max-w-md mx-auto bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold text-red-600 mb-2">⚠️ Your session is not valid</p>
                <p>1. Click <strong>"Logout & Sign In Again"</strong> below</p>
                <p>2. Sign in with your admin credentials</p>
                <p>3. Return to this page</p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout & Sign In Again
                </Button>
                <Button
                  variant="outline"
                  onClick={checkAuthStatus}
                >
                  Check Session
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}