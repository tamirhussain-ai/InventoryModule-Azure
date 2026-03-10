import { API_BASE_URL, createGatewayHeaders } from '../config/azure';

const API_URL = API_BASE_URL;

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'fulfillment' | 'requestor' | 'approver';
  department?: string;
}

export class AuthService {
  private static accessToken: string | null = null;
  private static currentUser: User | null = null;

  static async signup(email: string, password: string, name: string, role: string, department?: string) {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createGatewayHeaders(),
      },
      body: JSON.stringify({ email, password, name, role, department }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }

    return data;
  }

  static async signin(email: string, password: string) {
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createGatewayHeaders(),
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Sign in failed');
    }

    this.accessToken = data.accessToken;
    this.currentUser = data.user;
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    return data;
  }

  static async signout() {
    const token = this.getAccessToken(); // Ensure we have the token
    
    if (token) {
      try {
        await fetch(`${API_URL}/auth/signout`, {
          method: 'POST',
          headers: {
            ...createGatewayHeaders(),
            'X-Session-Token': token,
          },
        });
      } catch (error) {
        console.error('Sign out error:', error);
        // Continue to clear local storage even if server request fails
      }
    }

    this.accessToken = null;
    this.currentUser = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  }

  static getAccessToken(): string | null {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem('accessToken');
    }
    return this.accessToken;
  }

  static getCurrentUser(): User | null {
    if (!this.currentUser) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        this.currentUser = JSON.parse(userStr);
      }
    }
    return this.currentUser;
  }

  static isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  static async checkSession() {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_URL}/auth/session`, {
        headers: {
          ...createGatewayHeaders(),
          ...(token ? { 'X-Session-Token': token } : {}),
        },
      });

      if (!response.ok) {
        this.signout();
        return null;
      }

      const data = await response.json();
      this.currentUser = data.user;
      return data.user;
    } catch (error) {
      console.error('Session check failed:', error);
      this.signout();
      return null;
    }
  }

  static async requestPasswordReset(email: string, redirectTo: string) {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createGatewayHeaders(),
      },
      body: JSON.stringify({ email, redirectTo }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to request password reset');
    }

    return data;
  }

  static async resetPassword(token: string, password: string) {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createGatewayHeaders(),
      },
      body: JSON.stringify({ token, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to reset password');
    }

    return data;
  }

}