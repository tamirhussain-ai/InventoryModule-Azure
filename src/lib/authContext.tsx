import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PublicClientApplication, AccountInfo } from '@azure/msal-browser';
import { msalConfig, loginRequest } from './msalConfig';

// ─── MSAL instance (needed for Microsoft SSO only) ────────────────────────────
export const msalInstance = new PublicClientApplication(msalConfig);

// ─── Types ────────────────────────────────────────────────────────────────────
export type AppRole = 'admin' | 'fulfillment' | 'requestor' | 'approver';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  department?: string;
}

// ─── Allowlist (Phase 1 — stored in localStorage) ────────────────────────────
const ALLOWLIST_KEY = 'shc_allowed_emails';

export interface AllowedUser {
  email: string;
  role: AppRole;
  department?: string;
  addedAt: string;
}

export function getAllowedUsers(): AllowedUser[] {
  try { return JSON.parse(localStorage.getItem(ALLOWLIST_KEY) || '[]'); }
  catch { return []; }
}

export function saveAllowedUsers(users: AllowedUser[]) {
  localStorage.setItem(ALLOWLIST_KEY, JSON.stringify(users));
}

export function isEmailAllowed(email: string): AllowedUser | null {
  return getAllowedUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export function addAllowedUser(user: AllowedUser) {
  const list = getAllowedUsers();
  const i = list.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (i >= 0) list[i] = user; else list.push(user);
  saveAllowedUsers(list);
}

export function removeAllowedUser(email: string) {
  saveAllowedUsers(getAllowedUsers().filter(u => u.email.toLowerCase() !== email.toLowerCase()));
}

// ─── Session storage helpers ──────────────────────────────────────────────────
const SESSION_USER_KEY = 'shc_session_user';
const SESSION_TOKEN_KEY = 'backend_session_token';

export function getStoredUser(): AppUser | null {
  try { return JSON.parse(localStorage.getItem(SESSION_USER_KEY) || 'null'); }
  catch { return null; }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

function storeSession(user: AppUser, token: string) {
  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSession() {
  localStorage.removeItem(SESSION_USER_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem('msal_access_token');
  localStorage.removeItem('backend_user');
}

// ─── API config ───────────────────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ─── Password signin ──────────────────────────────────────────────────────────
export async function passwordSignin(email: string, password: string): Promise<{ user: AppUser; token: string }> {
  const res = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Sign in failed');

  const user: AppUser = {
    id: data.user?.id || email,
    email: data.user?.email || email,
    name: data.user?.name || email,
    role: (data.user?.role as AppRole) || 'requestor',
    department: data.user?.department,
  };
  return { user, token: data.accessToken };
}

// ─── MSAL signin via Graph token ─────────────────────────────────────────────
async function msalGraphSignin(msalAccessToken: string, attempt = 0): Promise<{ token: string; user: any } | null> {
  try {
    // Small delay on retry to let the page settle after Microsoft redirect
    if (attempt > 0) await new Promise(r => setTimeout(r, 500 * attempt));
    
    const res = await fetch(`${API_URL}/auth/msal-signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ msalToken: msalAccessToken }),
    });
    const text = await res.text();
    console.log('[Auth] msalGraphSignin response status:', res.status, 'body:', text.slice(0, 200));
    if (!res.ok) return null;
    const data = JSON.parse(text);
    return data.accessToken ? { token: data.accessToken, user: data.user } : null;
  } catch (e) {
    console.error('[Auth] msalGraphSignin error (attempt', attempt, '):', e);
    if (attempt < 3) return msalGraphSignin(msalAccessToken, attempt + 1);
    return null;
  }
}

// ─── Context type ─────────────────────────────────────────────────────────────
interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAccessDenied: boolean;
  loginWithMicrosoft: () => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUserRole: (role: AppRole, department?: string) => void;
  // Legacy aliases
  login: () => Promise<void>;
  msalAccount: AccountInfo | null;
  accessToken: string | null;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => getStoredUser());
  // If session already exists, no loading needed
  const [isLoading, setIsLoading] = useState(() => !getStoredToken() || !getStoredUser());
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [msalAccount, setMsalAccount] = useState<AccountInfo | null>(null);

  useEffect(() => {
    const init = async () => {
      // If we already have a stored session, we're done — no MSAL needed
      if (getStoredToken() && getStoredUser()) {
        console.log('[Auth] Session exists, skipping MSAL init');
        setIsLoading(false);
        return;
      }
      console.log('[Auth] No session, starting MSAL init');

      // Otherwise check for MSAL redirect result
      try {
        // Clear stale MSAL interaction state
        Object.keys(localStorage)
          .filter(k => k.includes('interaction.status') || k.includes('request.initiated') || k.includes('.state.'))
          .forEach(k => localStorage.removeItem(k));

        const result = await msalInstance.handleRedirectPromise();
        console.log('[Auth] handleRedirectPromise result:', result ? 'has result' : 'null', 'accessToken:', !!result?.accessToken);
        if (result?.account) {
          setMsalAccount(result.account);
          // Pass the access token directly from the redirect result
          await hydrateFromMsal(result.account, result.accessToken);
          return;
        }

        // Check MSAL cache — try silent token acquisition
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          setMsalAccount(accounts[0]);
          try {
            const silent = await msalInstance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
            await hydrateFromMsal(accounts[0], silent.accessToken);
          } catch {
            // Silent failed — user needs to sign in again
            setIsLoading(false);
          }
          return;
        }
      } catch (err) {
        console.error('[Auth] MSAL init error:', err);
      }

      setIsLoading(false);
    };

    init();
  }, []);

  const hydrateFromMsal = async (account: AccountInfo, msalAccessToken?: string) => {
    const email = account.username;
    console.log('[Auth] hydrateFromMsal called, email:', email, 'hasToken:', !!msalAccessToken);

    if (!msalAccessToken) {
      console.error('[Auth] No MSAL access token available');
      setIsLoading(false);
      return;
    }

    // Sign in with backend using the real MSAL token
    console.log('[Auth] Calling msalGraphSignin...');
    const result = await msalGraphSignin(msalAccessToken);
    console.log('[Auth] msalGraphSignin result:', result ? 'success' : 'null');
    if (!result) { setIsLoading(false); return; }

    // Backend returns the real user profile — use it for role/id
    const backendUser = result.user;
    const allUsers = getAllowedUsers();

    // Bootstrap allowlist if empty
    if (allUsers.length === 0) {
      addAllowedUser({ email, role: backendUser?.role || 'admin', addedAt: new Date().toISOString() });
    } else if (!isEmailAllowed(email)) {
      setIsAccessDenied(true);
      setIsLoading(false);
      return;
    }

    const entry = isEmailAllowed(email)!;
    const appUser: AppUser = {
      id: backendUser?.id || account.localAccountId,
      email,
      name: backendUser?.name || account.name || email,
      role: entry.role || backendUser?.role || 'requestor',
      department: entry.department || backendUser?.department,
    };

    storeSession(appUser, result.token);
    setUser(appUser);
    setIsLoading(false);
  };

  const loginWithMicrosoft = async () => {
    Object.keys(localStorage)
      .filter(k => k.includes('interaction.status') || k.includes('request.initiated') || k.includes('.state.'))
      .forEach(k => localStorage.removeItem(k));
    await msalInstance.loginRedirect({ ...loginRequest, prompt: 'select_account' });
  };

  const loginWithPassword = async (email: string, password: string) => {
    const { user: appUser, token } = await passwordSignin(email, password);
    storeSession(appUser, token);
    setUser(appUser);
  };

  const logout = async () => {
    clearSession();
    setUser(null);
    setMsalAccount(null);
    setIsAccessDenied(false);

    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      await msalInstance.logoutRedirect({ account: accounts[0], postLogoutRedirectUri: window.location.origin });
    } else {
      window.location.href = '/';
    }
  };

  const setUserRole = (role: AppRole, department?: string) => {
    if (!user) return;
    addAllowedUser({ email: user.email, role, department, addedAt: new Date().toISOString() });
    const updated = { ...user, role, department };
    storeSession(updated, getStoredToken()!);
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user && !isAccessDenied,
      isLoading,
      isAccessDenied,
      loginWithMicrosoft,
      loginWithPassword,
      logout,
      setUserRole,
      login: loginWithMicrosoft,
      msalAccount,
      accessToken: getStoredToken(),
      getToken: async () => getStoredToken(),
    }}>
      {children}
    </AuthContext.Provider>
  );
}
