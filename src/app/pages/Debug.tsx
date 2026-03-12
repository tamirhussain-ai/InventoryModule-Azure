import { useState, useEffect } from 'react';
import { msalInstance, getAllowedUsers } from '../../lib/authContext';
import { loginRequest } from '../../lib/msalConfig';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

const API_URL = import.meta.env.VITE_API_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || '';
const TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || '';

type Status = 'idle' | 'loading' | 'ok' | 'error';

interface Check {
  label: string;
  status: Status;
  detail: string;
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; color: string }> = {
    idle:    { label: 'Not run',  color: 'bg-gray-100 text-gray-600' },
    loading: { label: 'Testing…', color: 'bg-yellow-100 text-yellow-700' },
    ok:      { label: '✓ Pass',   color: 'bg-green-100 text-green-700' },
    error:   { label: '✗ Fail',   color: 'bg-red-100 text-red-700' },
  };
  const { label, color } = map[status];
  return <span className={`text-xs font-medium px-2 py-1 rounded-full ${color}`}>{label}</span>;
}

export default function Debug() {
  const [checks, setChecks] = useState<Check[]>([
    { label: 'VITE_AZURE_CLIENT_ID set',      status: 'idle', detail: '' },
    { label: 'VITE_AZURE_TENANT_ID set',      status: 'idle', detail: '' },
    { label: 'VITE_API_URL set',              status: 'idle', detail: '' },
    { label: 'VITE_SUPABASE_ANON_KEY set',   status: 'idle', detail: '' },
    { label: 'MSAL initialized',             status: 'idle', detail: '' },
    { label: 'MSAL cached account',          status: 'idle', detail: '' },
    { label: 'Supabase /items reachable',    status: 'idle', detail: '' },
    { label: 'Supabase /users reachable',    status: 'idle', detail: '' },
  ]);
  const [msalLoginStatus, setMsalLoginStatus] = useState<Status>('idle');
  const [msalLoginDetail, setMsalLoginDetail] = useState('');

  const update = (index: number, status: Status, detail: string) => {
    setChecks(prev => prev.map((c, i) => i === index ? { ...c, status, detail } : c));
  };

  useEffect(() => {
    runChecks();
  }, []);

  const runChecks = async () => {
    // 0 - Client ID
    if (CLIENT_ID && CLIENT_ID !== 'your-app-client-id-here') {
      update(0, 'ok', CLIENT_ID.substring(0, 8) + '…');
    } else {
      update(0, 'error', 'Missing or placeholder value in .env');
    }

    // 1 - Tenant ID
    if (TENANT_ID && TENANT_ID !== 'your-university-tenant-id-here') {
      update(1, 'ok', TENANT_ID.substring(0, 8) + '…');
    } else {
      update(1, 'error', 'Missing or placeholder value in .env');
    }

    // 2 - API URL
    if (API_URL) {
      update(2, 'ok', API_URL.substring(0, 40) + '…');
    } else {
      update(2, 'error', 'VITE_API_URL not set in .env');
    }

    // 3 - Supabase Anon Key
    if (SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 20) {
      update(3, 'ok', SUPABASE_ANON_KEY.substring(0, 12) + '…');
    } else {
      update(3, 'error', 'VITE_SUPABASE_ANON_KEY not set in .env');
    }

    // 4 - MSAL initialized
    try {
      const accounts = msalInstance.getAllAccounts();
      update(4, 'ok', `MSAL ready (${accounts.length} account(s) cached)`);
    } catch (e: any) {
      update(4, 'error', e.message);
    }

    // 5 - Cached MSAL account
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      update(5, 'ok', accounts[0].username);
    } else {
      update(5, 'idle', 'No cached account — need to sign in');
    }

    // 6 - Supabase /items
    update(6, 'loading', 'Fetching…');
    try {
      const res = await fetch(`${API_URL}/items?active=true`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      const text = await res.text();
      if (res.ok) {
        try {
          const json = JSON.parse(text);
          const count = json.items?.length ?? JSON.stringify(json).length;
          update(6, 'ok', `HTTP ${res.status} — ${count} items returned`);
        } catch {
          update(6, 'ok', `HTTP ${res.status} — ${text.substring(0, 60)}`);
        }
      } else {
        update(6, 'error', `HTTP ${res.status} — ${text.substring(0, 100)}`);
      }
    } catch (e: any) {
      update(6, 'error', e.message);
    }

    // 7 - Supabase /users
    update(7, 'loading', 'Fetching…');
    try {
      const token = localStorage.getItem('msal_access_token') || '';
      const res = await fetch(`${API_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          ...(token ? { 'X-Session-Token': token } : {}),
        },
      });
      const text = await res.text();
      if (res.ok) {
        update(7, 'ok', `HTTP ${res.status} — OK`);
      } else {
        update(7, 'error', `HTTP ${res.status} — ${text.substring(0, 100)}`);
      }
    } catch (e: any) {
      update(7, 'error', e.message);
    }
  };

  const testMsalLogin = async () => {
    setMsalLoginStatus('loading');
    setMsalLoginDetail('Opening Microsoft login popup…');
    try {
      const result = await msalInstance.loginPopup({
        ...loginRequest,
        prompt: 'select_account',
      });
      setMsalLoginStatus('ok');
      setMsalLoginDetail(`Signed in as: ${result.account.username} | Token: ${result.accessToken.substring(0, 20)}…`);
      // Re-run checks to update cached account status
      runChecks();
    } catch (e: any) {
      setMsalLoginStatus('error');
      setMsalLoginDetail(`${e.errorCode || ''}: ${e.message}`);
    }
  };

  const allChecks = checks;
  const passed = allChecks.filter(c => c.status === 'ok').length;
  const failed = allChecks.filter(c => c.status === 'error').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">System Debug</h1>
            <p className="text-sm text-gray-500">Tests env vars, MSAL, and Supabase connection</p>
          </div>
          <div className="text-sm text-gray-500">
            <span className="text-green-600 font-medium">{passed} passed</span>
            {failed > 0 && <span className="text-red-600 font-medium ml-2">{failed} failed</span>}
          </div>
        </div>

        {/* Environment & Connection Checks */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Automatic Checks</CardTitle>
              <Button size="sm" variant="outline" onClick={runChecks}>Re-run</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-0 divide-y">
            {checks.map((check, i) => (
              <div key={i} className="flex items-start justify-between py-2.5 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{check.label}</p>
                  {check.detail && (
                    <p className="text-xs text-gray-500 mt-0.5 font-mono break-all">{check.detail}</p>
                  )}
                </div>
                <StatusBadge status={check.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Manual MSAL Login Test */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">MSAL Login Test (Popup)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              Tests Microsoft SSO directly using a popup. This bypasses the redirect flow to isolate the issue.
            </p>
            <Button
              onClick={testMsalLogin}
              disabled={msalLoginStatus === 'loading'}
              size="sm"
            >
              {msalLoginStatus === 'loading' ? 'Opening popup…' : 'Test MSAL Login (Popup)'}
            </Button>
            {msalLoginDetail && (
              <div className={`text-xs font-mono p-2 rounded ${msalLoginStatus === 'ok' ? 'bg-green-50 text-green-700' : msalLoginStatus === 'error' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                {msalLoginDetail}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Allowlist */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Allowlist (localStorage)</CardTitle>
          </CardHeader>
          <CardContent>
            {getAllowedUsers().length === 0 ? (
              <p className="text-xs text-gray-500">Empty — first login will bootstrap as admin</p>
            ) : (
              <div className="space-y-1">
                {getAllowedUsers().map((u, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-gray-700">{u.email}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600">{u.role}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-gray-400">
          This page is only accessible at <code>/debug</code> — remove it before going to production
        </p>
      </div>
    </div>
  );
}
