import { useState, useEffect } from 'react';
import { msalInstance, getAllowedUsers } from '../../lib/authContext';
import { loginRequest } from '../../lib/msalConfig';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

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

const INITIAL_CHECKS: Check[] = [
  { label: 'VITE_AZURE_CLIENT_ID set',       status: 'idle', detail: '' },
  { label: 'VITE_AZURE_TENANT_ID set',       status: 'idle', detail: '' },
  { label: 'VITE_API_URL set',               status: 'idle', detail: '' },
  { label: 'VITE_SUPABASE_ANON_KEY set',    status: 'idle', detail: '' },
  { label: 'MSAL initialized',              status: 'idle', detail: '' },
  { label: 'MSAL cached account',           status: 'idle', detail: '' },
  { label: 'Backend /auth/forgot-password',     status: 'idle', detail: '' },
  { label: 'Backend /items (with session)', status: 'idle', detail: '' },
];

export default function Debug() {
  const [checks, setChecks] = useState<Check[]>(INITIAL_CHECKS);
  const [msalLoginStatus, setMsalLoginStatus] = useState<Status>('idle');
  const [msalLoginDetail, setMsalLoginDetail] = useState('');

  const update = (index: number, status: Status, detail: string) =>
    setChecks(prev => prev.map((c, i) => i === index ? { ...c, status, detail } : c));

  useEffect(() => { runChecks(); }, []);

  const runChecks = async () => {
    // Reset all
    setChecks(INITIAL_CHECKS);

    // 0 - Client ID
    update(0, CLIENT_ID && !CLIENT_ID.includes('your') ? 'ok' : 'error',
      CLIENT_ID ? CLIENT_ID.substring(0, 8) + '…' : 'Missing in .env');

    // 1 - Tenant ID
    update(1, TENANT_ID && !TENANT_ID.includes('your') ? 'ok' : 'error',
      TENANT_ID ? TENANT_ID.substring(0, 8) + '…' : 'Missing in .env');

    // 2 - API URL
    update(2, API_URL ? 'ok' : 'error',
      API_URL ? API_URL.substring(0, 45) + '…' : 'Missing VITE_API_URL in .env');

    // 3 - Supabase Anon Key
    update(3, SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 20 ? 'ok' : 'error',
      SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.substring(0, 12) + '…' : 'Missing in .env');

    // 4 - MSAL initialized
    try {
      msalInstance.getAllAccounts();
      update(4, 'ok', 'MSAL ready');
    } catch (e: any) {
      update(4, 'error', e.message);
    }

    // 5 - Cached account
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      update(5, 'ok', accounts[0].username);
    } else {
      update(5, 'idle', 'No cached account — use Test button below to sign in');
    }

    // 6 - /auth/forgot-password
    const msalToken = localStorage.getItem('msal_access_token');
    if (!msalToken) {
      update(6, 'idle', 'No MSAL token — sign in first using the button below');
    } else {
      update(6, 'loading', 'Calling /auth/forgot-password…');
      try {
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'X-MSAL-Token': msalToken,
          },
        });
        const text = await res.text();
        if (res.ok) {
          const json = JSON.parse(text);
          localStorage.setItem('backend_session_token', json.accessToken);
          localStorage.setItem('backend_user', JSON.stringify(json.user));
          update(6, 'ok', `Session created — role: ${json.user?.role}, token: ${json.accessToken?.substring(0, 16)}…`);
        } else {
          update(6, 'error', `HTTP ${res.status} — ${text.substring(0, 120)}`);
        }
      } catch (e: any) {
        update(6, 'error', e.message);
      }
    }

    // 7 - /items with session token
    const sessionToken = localStorage.getItem('backend_session_token');
    if (!sessionToken) {
      update(7, 'idle', 'No backend session — need /auth/forgot-password to pass first');
    } else {
      update(7, 'loading', 'Fetching /items…');
      try {
        const res = await fetch(`${API_URL}/items?active=true`, {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'X-Session-Token': sessionToken,
            'Content-Type': 'application/json',
          },
        });
        const text = await res.text();
        if (res.ok) {
          const json = JSON.parse(text);
          const count = json.items?.length ?? '?';
          update(7, 'ok', `HTTP ${res.status} — ${count} items returned`);
        } else {
          update(7, 'error', `HTTP ${res.status} — ${text.substring(0, 120)}`);
        }
      } catch (e: any) {
        update(7, 'error', e.message);
      }
    }
  };

  const testMsalLogin = async () => {
    setMsalLoginStatus('loading');
    setMsalLoginDetail('Opening Microsoft login popup…');
    // Clear stale MSAL state first
    Object.keys(localStorage)
      .filter(k => k.includes('interaction.status') || k.includes('request.initiated') || k.includes('.state.'))
      .forEach(k => localStorage.removeItem(k));
    try {
      const result = await msalInstance.loginPopup({ ...loginRequest, prompt: 'select_account' });
      localStorage.setItem('msal_access_token', result.accessToken);
      setMsalLoginStatus('ok');
      setMsalLoginDetail(`✓ Signed in: ${result.account.username} — re-running checks…`);
      setTimeout(runChecks, 500);
    } catch (e: any) {
      setMsalLoginStatus('error');
      setMsalLoginDetail(`${e.errorCode || ''}: ${e.message}`);
    }
  };

  const passed = checks.filter(c => c.status === 'ok').length;
  const failed = checks.filter(c => c.status === 'error').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">System Debug</h1>
            <p className="text-sm text-gray-500">Tests env vars, MSAL, and backend connection</p>
          </div>
          <div className="text-sm">
            <span className="text-green-600 font-medium">{passed} passed</span>
            {failed > 0 && <span className="text-red-600 font-medium ml-2">{failed} failed</span>}
          </div>
        </div>

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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Step 1: Sign in with MSAL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              Signs in via popup and stores the MSAL token, then auto-runs all checks.
            </p>
            <Button onClick={testMsalLogin} disabled={msalLoginStatus === 'loading'} size="sm">
              {msalLoginStatus === 'loading' ? 'Opening popup…' : 'Sign in with Microsoft (Popup)'}
            </Button>
            {msalLoginDetail && (
              <div className={`text-xs font-mono p-2 rounded break-all ${
                msalLoginStatus === 'ok' ? 'bg-green-50 text-green-700' :
                msalLoginStatus === 'error' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
              }`}>
                {msalLoginDetail}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Allowlist (localStorage)</CardTitle>
          </CardHeader>
          <CardContent>
            {getAllowedUsers().length === 0 ? (
              <p className="text-xs text-gray-500">Empty — first login bootstraps as admin</p>
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
          Remove <code>/debug</code> route before going to production
        </p>
      </div>
    </div>
  );
}
