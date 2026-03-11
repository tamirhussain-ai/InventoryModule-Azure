import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PublicClientApplication, AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { msalConfig, loginRequest } from './msalConfig';

export const msalInstance = new PublicClientApplication(msalConfig);

export type AppRole = 'admin' | 'fulfillment' | 'requestor' | 'approver';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  department?: string;
}

// ─── Allowlist helpers ────────────────────────────────────────────────────────
const ALLOWLIST_KEY = 'shc_allowed_emails';

export interface AllowedUser {
  email: string;
  role: AppRole;
  department?: string;
  addedAt: string;
}

export function getAllowedUsers(): AllowedUser[] {
  try {
    const raw = localStorage.getItem(ALLOWLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveAllowedUsers(users: AllowedUser[]) {
  localStorage.setItem(ALLOWLIST_KEY, JSON.stringify(users));
}

export function isEmailAllowed(email: string): AllowedUser | null {
  const list = getAllowedUsers();
  return list.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export function addAllowedUser(user: AllowedUser) {
  const list = getAllowedUsers();
  const exists = list.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (exists >= 0) { list[exists] = user; } else { list.push(user); }
  saveAllowedUsers(list);
}

export function removeAllowedUser(email: string) {
  saveAllowedUsers(getAllowedUsers().filter(u => u.email.toLowerCase() !== email.toLowerCase()));
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthContextType {
  user: AppUser | null;
  msalAccount: AccountInfo | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAccessDenied: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  setUserRole: (role: AppRole, department?: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [msalAccount, setMsalAccount] = useState<AccountInfo | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  useEffect(() => {
    const accounts = msalInstance.getAllAccounts();
    console.log('[Auth] Accounts found in cache:', accounts.length);
    console.log('[Auth] Allowlist:', getAllowedUsers());
    if (accounts.length > 0) {
      const account = accounts[0];
      console.log('[Auth] Auto-logging in with cached account:', account.username);
      setMsalAccount(account);
      hydrateAppUser(account);
    } else {
      console.log('[Auth] No cached account — showing login page');
      setIsLoading(false);
    }
  }, []);

  const hydrateAppUser = async (account: AccountInfo) => {
    const email = account.username;
    const allUsers = getAllowedUsers();

    // Bootstrap: first ever login becomes admin
    if (allUsers.length === 0) {
      addAllowedUser({ email, role: 'admin', addedAt: new Date().toISOString() });
    } else if (!isEmailAllowed(email)) {
      setIsAccessDenied(true);
      setIsLoading(false);
      return;
    }

    setIsAccessDenied(false);
    const entry = isEmailAllowed(email)!;
    const user: AppUser = {
      id: account.localAccountId,
      email,
      name: account.name || email,
      role: entry.role,
      department: entry.department,
    };
    setAppUser(user);

    try {
      const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
      setAccessToken(result.accessToken);
      localStorage.setItem('msal_access_token', result.accessToken);
    } catch {
      console.warn('Silent token acquisition failed');
    }

    setIsLoading(false);
  };

  const login = async () => {
    const result: AuthenticationResult = await msalInstance.loginPopup(loginRequest);
    setMsalAccount(result.account);
    setAccessToken(result.accessToken);
    localStorage.setItem('msal_access_token', result.accessToken);
    await hydrateAppUser(result.account);
  };

  const logout = async () => {
    // Clear local storage first
    localStorage.removeItem('msal_access_token');
    localStorage.removeItem('shc_allowed_emails');

    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      // Use redirect logout — more reliable than popup across all browsers
      await msalInstance.logoutRedirect({
        account: accounts[0],
        postLogoutRedirectUri: window.location.origin,
      });
    } else {
      window.location.href = '/';
    }
  };

  const getToken = async (): Promise<string | null> => {
    if (!msalAccount) return null;
    try {
      const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account: msalAccount });
      setAccessToken(result.accessToken);
      localStorage.setItem('msal_access_token', result.accessToken);
      return result.accessToken;
    } catch {
      try {
        const result = await msalInstance.acquireTokenPopup({ ...loginRequest, account: msalAccount });
        setAccessToken(result.accessToken);
        localStorage.setItem('msal_access_token', result.accessToken);
        return result.accessToken;
      } catch { return null; }
    }
  };

  const setUserRole = (role: AppRole, department?: string) => {
    if (!appUser) return;
    addAllowedUser({ email: appUser.email, role, department, addedAt: new Date().toISOString() });
    setAppUser(prev => prev ? { ...prev, role, department } : prev);
  };

  return (
    <AuthContext.Provider value={{
      user: appUser,
      msalAccount,
      accessToken,
      isAuthenticated: !!msalAccount && !isAccessDenied,
      isLoading,
      isAccessDenied,
      login,
      logout,
      getToken,
      setUserRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
