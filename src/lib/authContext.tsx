import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PublicClientApplication, AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { msalConfig, loginRequest } from './msalConfig';

// ─── MSAL Instance (singleton) ──────────────────────────────────────────────
export const msalInstance = new PublicClientApplication(msalConfig);

// ─── Types ───────────────────────────────────────────────────────────────────
export type AppRole = 'admin' | 'fulfillment' | 'requestor' | 'approver';

export interface AppUser {
  id: string;           // Azure Object ID
  email: string;
  name: string;
  role: AppRole;
  department?: string;
}

interface AuthContextType {
  user: AppUser | null;
  msalAccount: AccountInfo | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  setUserRole: (role: AppRole, department?: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [msalAccount, setMsalAccount] = useState<AccountInfo | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount — initialize MSAL and restore any existing session
  useEffect(() => {
    const init = async () => {
      await msalInstance.initialize();

      // Handle redirect response (for redirect flow, if used)
      await msalInstance.handleRedirectPromise();

      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        const account = accounts[0];
        setMsalAccount(account);
        await hydrateAppUser(account);
      }

      setIsLoading(false);
    };

    init().catch((err) => {
      console.error('MSAL init error:', err);
      setIsLoading(false);
    });
  }, []);

  // ── Hydrate AppUser from MSAL account + localStorage role ─────────────────
  // Azure Entra ID provides identity. App role is stored in backend/localStorage.
  const hydrateAppUser = async (account: AccountInfo) => {
    const storedRole = localStorage.getItem(`role_${account.localAccountId}`) as AppRole | null;
    const storedDept = localStorage.getItem(`dept_${account.localAccountId}`) || undefined;

    const user: AppUser = {
      id: account.localAccountId,
      email: account.username,
      name: account.name || account.username,
      role: storedRole || 'requestor', // Default: requestor until admin assigns a role
      department: storedDept,
    };

    setAppUser(user);

    // Silently acquire a token for API calls
    try {
      const result = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account,
      });
      setAccessToken(result.accessToken);
    } catch {
      console.warn('Silent token acquisition failed — user may need to re-authenticate');
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async () => {
    try {
      const result: AuthenticationResult = await msalInstance.loginPopup(loginRequest);
      setMsalAccount(result.account);
      setAccessToken(result.accessToken);
      await hydrateAppUser(result.account);
    } catch (err) {
      console.error('Login failed:', err);
      throw err;
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    if (msalAccount) {
      await msalInstance.logoutPopup({ account: msalAccount });
    }
    setMsalAccount(null);
    setAppUser(null);
    setAccessToken(null);
  };

  // ── Get fresh token (called by api.ts before each request) ────────────────
  const getToken = async (): Promise<string | null> => {
    if (!msalAccount) return null;
    try {
      const result = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: msalAccount,
      });
      setAccessToken(result.accessToken);
      return result.accessToken;
    } catch {
      // Silent failed — prompt interactive login
      try {
        const result = await msalInstance.acquireTokenPopup({
          ...loginRequest,
          account: msalAccount,
        });
        setAccessToken(result.accessToken);
        return result.accessToken;
      } catch (err) {
        console.error('Token refresh failed:', err);
        return null;
      }
    }
  };

  // ── Set role (called by admin panel after assigning a role) ───────────────
  const setUserRole = (role: AppRole, department?: string) => {
    if (!msalAccount) return;
    localStorage.setItem(`role_${msalAccount.localAccountId}`, role);
    if (department) localStorage.setItem(`dept_${msalAccount.localAccountId}`, department);
    setAppUser((prev) => prev ? { ...prev, role, department } : prev);
  };

  return (
    <AuthContext.Provider
      value={{
        user: appUser,
        msalAccount,
        accessToken,
        isAuthenticated: !!msalAccount,
        isLoading,
        login,
        logout,
        getToken,
        setUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
