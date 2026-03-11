/**
 * AuthService — Phase 1 Azure Migration
 *
 * Replaces Supabase auth with Azure Entra ID (MSAL).
 * Interface kept compatible with existing callers.
 */

import { msalInstance, AppUser, AppRole } from '../../lib/authContext';
import { loginRequest } from '../../lib/msalConfig';

export type { AppUser as User };

export class AuthService {

  static getAccessToken(): string | null {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) return null;
    return localStorage.getItem('msal_access_token');
  }

  static getCurrentUser(): AppUser | null {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) return null;
    const account = accounts[0];
    const role = (localStorage.getItem(`role_${account.localAccountId}`) as AppRole) || 'requestor';
    const department = localStorage.getItem(`dept_${account.localAccountId}`) || undefined;
    return {
      id: account.localAccountId,
      email: account.username,
      name: account.name || account.username,
      role,
      department,
    };
  }

  static isAuthenticated(): boolean {
    return msalInstance.getAllAccounts().length > 0;
  }

  static async signin(): Promise<{ user: AppUser; accessToken: string }> {
    const result = await msalInstance.loginPopup(loginRequest);
    localStorage.setItem('msal_access_token', result.accessToken);
    const role = (localStorage.getItem(`role_${result.account.localAccountId}`) as AppRole) || 'requestor';
    const department = localStorage.getItem(`dept_${result.account.localAccountId}`) || undefined;
    const user: AppUser = {
      id: result.account.localAccountId,
      email: result.account.username,
      name: result.account.name || result.account.username,
      role,
      department,
    };
    return { user, accessToken: result.accessToken };
  }

  static async signout(): Promise<void> {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      await msalInstance.logoutPopup({ account: accounts[0] });
    }
    localStorage.removeItem('msal_access_token');
  }

  static async getFreshToken(): Promise<string | null> {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) return null;
    try {
      const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
      localStorage.setItem('msal_access_token', result.accessToken);
      return result.accessToken;
    } catch {
      try {
        const result = await msalInstance.acquireTokenPopup({ ...loginRequest, account: accounts[0] });
        localStorage.setItem('msal_access_token', result.accessToken);
        return result.accessToken;
      } catch (err) {
        console.error('Token refresh failed', err);
        await AuthService.signout();
        return null;
      }
    }
  }

  static async checkSession(): Promise<AppUser | null> {
    if (!AuthService.isAuthenticated()) return null;
    const token = await AuthService.getFreshToken();
    if (!token) return null;
    return AuthService.getCurrentUser();
  }
}
