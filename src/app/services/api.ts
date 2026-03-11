/**
 * api.ts — Phase 1 Azure Migration
 *
 * API_URL now points to an environment variable.
 * During Phase 1, this still points to the Supabase backend.
 * In Phase 3, it will point to the Azure App Service backend.
 *
 * Auth header now sends the MSAL access token instead of the Supabase anon key.
 */

import { AuthService } from './auth';

// Phase 1: still Supabase backend — swap to Azure App Service URL in Phase 3
export const API_URL = import.meta.env.VITE_API_URL || '';

export function getAuthHeaders(): Record<string, string> {
  const token = AuthService.getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  // Always try to use a fresh token
  await AuthService.getFreshToken();
  const token = AuthService.getAccessToken();

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('Session expired. Logging out.');
        await AuthService.signout();
        window.location.href = '/';
        throw new Error('Session expired');
      }

      const errorText = await response.text();
      let error;
      try {
        const errorJson = JSON.parse(errorText);
        error = errorJson.error || `API request failed (${response.status})`;
      } catch {
        error = errorText || `API request failed (${response.status})`;
      }
      throw new Error(error);
    }

    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      if (endpoint === '/notifications' || endpoint === '/badge-counts') {
        console.log(`${endpoint} endpoint unavailable`);
      } else {
        console.error(`Network error for ${endpoint}`);
      }
      throw new Error('Cannot connect to server. Please check your connection and try again.');
    }
    throw error;
  }
}

// ── Items ─────────────────────────────────────────────────────────────────────
export async function getItems(filters?: { active?: boolean; category?: string; search?: string }) {
  let url = '/items?';
  if (filters?.active !== undefined) url += `active=${filters.active}&`;
  if (filters?.category) url += `category=${encodeURIComponent(filters.category)}&`;
  if (filters?.search) url += `search=${encodeURIComponent(filters.search)}&`;
  return fetchAPI(url);
}

export async function getItem(id: string) { return fetchAPI(`/items/${id}`); }
export async function createItem(data: unknown) { return fetchAPI('/items', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateItem(id: string, data: unknown) { return fetchAPI(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export async function deleteItem(id: string) { return fetchAPI(`/items/${id}`, { method: 'DELETE' }); }

// ── Orders ────────────────────────────────────────────────────────────────────
export async function getOrders(filters?: { status?: string; userId?: string }) {
  let url = '/orders?';
  if (filters?.status) url += `status=${encodeURIComponent(filters.status)}&`;
  if (filters?.userId) url += `userId=${encodeURIComponent(filters.userId)}&`;
  return fetchAPI(url);
}

export async function getOrder(id: string) { return fetchAPI(`/orders/${id}`); }
export async function createOrder(data: unknown) { return fetchAPI('/orders', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateOrder(id: string, data: unknown) { return fetchAPI(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export async function updateOrderStatus(id: string, status: string, notes?: string) {
  return fetchAPI(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes }) });
}

// ── Users ─────────────────────────────────────────────────────────────────────
export async function getUsers() { return fetchAPI('/users'); }
export async function updateUser(id: string, data: unknown) { return fetchAPI(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export async function updateUserRole(id: string, role: string, department?: string) {
  return fetchAPI(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role, department }) });
}

// ── Stock / Inventory ─────────────────────────────────────────────────────────
export async function getStock(filters?: { itemId?: string; location?: string }) {
  let url = '/stock?';
  if (filters?.itemId) url += `itemId=${encodeURIComponent(filters.itemId)}&`;
  if (filters?.location) url += `location=${encodeURIComponent(filters.location)}&`;
  return fetchAPI(url);
}
export async function updateStock(id: string, data: unknown) { return fetchAPI(`/stock/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }

// ── Approvals ─────────────────────────────────────────────────────────────────
export async function getApprovals(filters?: { status?: string }) {
  let url = '/approvals?';
  if (filters?.status) url += `status=${encodeURIComponent(filters.status)}&`;
  return fetchAPI(url);
}
export async function approveOrder(id: string, notes?: string) {
  return fetchAPI(`/approvals/${id}/approve`, { method: 'POST', body: JSON.stringify({ notes }) });
}
export async function denyOrder(id: string, notes?: string) {
  return fetchAPI(`/approvals/${id}/deny`, { method: 'POST', body: JSON.stringify({ notes }) });
}

// ── Purchase Orders ───────────────────────────────────────────────────────────
export async function getPurchaseOrders() { return fetchAPI('/purchase-orders'); }
export async function createPurchaseOrder(data: unknown) { return fetchAPI('/purchase-orders', { method: 'POST', body: JSON.stringify(data) }); }
export async function updatePurchaseOrder(id: string, data: unknown) { return fetchAPI(`/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }

// ── Vendors ───────────────────────────────────────────────────────────────────
export async function getVendors() { return fetchAPI('/vendors'); }
export async function createVendor(data: unknown) { return fetchAPI('/vendors', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateVendor(id: string, data: unknown) { return fetchAPI(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }

// ── Transfers ─────────────────────────────────────────────────────────────────
export async function getTransfers() { return fetchAPI('/transfers'); }
export async function createTransfer(data: unknown) { return fetchAPI('/transfers', { method: 'POST', body: JSON.stringify(data) }); }

// ── Cycle Counts ──────────────────────────────────────────────────────────────
export async function getCycleCounts() { return fetchAPI('/cycle-counts'); }
export async function createCycleCount(data: unknown) { return fetchAPI('/cycle-counts', { method: 'POST', body: JSON.stringify(data) }); }
export async function updateCycleCount(id: string, data: unknown) { return fetchAPI(`/cycle-counts/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }

// ── Bins & Lots ───────────────────────────────────────────────────────────────
export async function getBins() { return fetchAPI('/bins'); }
export async function createBin(data: unknown) { return fetchAPI('/bins', { method: 'POST', body: JSON.stringify(data) }); }
export async function getLots() { return fetchAPI('/lots'); }
export async function createLot(data: unknown) { return fetchAPI('/lots', { method: 'POST', body: JSON.stringify(data) }); }

// ── Returns ───────────────────────────────────────────────────────────────────
export async function getReturns() { return fetchAPI('/returns'); }
export async function createReturn(data: unknown) { return fetchAPI('/returns', { method: 'POST', body: JSON.stringify(data) }); }

// ── Reports ───────────────────────────────────────────────────────────────────
export async function getReports(type: string, params?: Record<string, string>) {
  let url = `/reports/${type}?`;
  if (params) Object.entries(params).forEach(([k, v]) => { url += `${k}=${encodeURIComponent(v)}&`; });
  return fetchAPI(url);
}

// ── Notifications ─────────────────────────────────────────────────────────────
export async function getNotifications() { return fetchAPI('/notifications'); }
export async function getBadgeCounts() { return fetchAPI('/badge-counts'); }
export async function markNotificationRead(id: string) { return fetchAPI(`/notifications/${id}/read`, { method: 'PATCH' }); }
