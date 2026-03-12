/**
 * API Service — Phase 1 Azure Migration
 * Sends Supabase anon key as Authorization (backend requires it)
 * Sends backend_session_token as X-Session-Token for user identity
 */

export const API_URL = import.meta.env.VITE_API_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function getAuthHeaders(): Record<string, string> {
  const sessionToken = localStorage.getItem('backend_session_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (sessionToken) {
    headers['X-Session-Token'] = sessionToken;
  }
  return headers;
}

const api = {
  get:    <T>(path: string) => request<T>(path),
  post:   <T>(path: string, body: any) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put:    <T>(path: string, body: any) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...getAuthHeaders(), ...(options.headers as Record<string, string> || {}) },
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      if (path === '/notifications' || path === '/badge-counts') {
        console.log(`${path} endpoint unavailable`);
      } else {
        console.error(`Network error for ${path}`);
      }
      throw new Error('Cannot connect to server. Please check your connection and try again.');
    }
    throw error;
  }
}

// ── Items ────────────────────────────────────────────────────────────────────
export const getItems          = (params?: any) => api.get<any>(`/items${params ? '?' + new URLSearchParams(params) : ''}`);
export const getItem           = (id: string)   => api.get<any>(`/items/${id}`);
export const createItem        = (data: any)    => api.post<any>('/items', data);
export const updateItem        = (id: string, data: any) => api.put<any>(`/items/${id}`, data);
export const deleteItem        = (id: string)   => api.delete<any>(`/items/${id}`);
export const deactivateItem    = (id: string)   => api.put<any>(`/items/${id}/deactivate`, {});
export const searchItems       = (q: string)    => api.get<any>(`/items/search?q=${encodeURIComponent(q)}`);
export const searchOnline      = (q: string)    => api.get<any>(`/items/search-online?q=${encodeURIComponent(q)}`);
export const getItemByBarcode  = (b: string)    => api.get<any>(`/items/barcode/${b}`);
export const getLowStockItems  = ()             => api.get<any>('/items/low-stock');
export const bulkUploadItems   = (data: any)    => api.post<any>('/items/bulk', data);
export const uploadProductImage = (id: string, data: any) => api.post<any>(`/items/${id}/image`, data);
export const purgeInactiveItems = ()            => api.delete<any>('/items/inactive');

// ── Categories ───────────────────────────────────────────────────────────────
export const getCategories     = ()             => api.get<any>('/categories');
export const createCategory    = (data: any)    => api.post<any>('/categories', data);
export const updateCategory    = (id: string, data: any) => api.put<any>(`/categories/${id}`, data);

// ── Orders ───────────────────────────────────────────────────────────────────
export const getOrders         = (params?: any) => api.get<any>(`/orders${params ? '?' + new URLSearchParams(params) : ''}`);
export const getOrder          = (id: string)   => api.get<any>(`/orders/${id}`);
export const createOrder       = (data: any)    => api.post<any>('/orders', data);
export const updateOrderStatus = (id: string, status: string, note?: string) => api.put<any>(`/orders/${id}/status`, { status, note });
export const cancelOrder       = (id: string)   => api.put<any>(`/orders/${id}/cancel`, {});
export const fulfillOrder      = (id: string, data: any) => api.put<any>(`/orders/${id}/fulfill`, data);
export const updateFulfilledOrder = (id: string, data: any) => api.put<any>(`/orders/${id}/fulfilled`, data);

// ── Approvals ────────────────────────────────────────────────────────────────
export const getApprovals      = ()             => api.get<any>('/approvals');
export const approveRequest    = (id: string, note?: string) => api.put<any>(`/approvals/${id}/approve`, { note });
export const rejectRequest     = (id: string, note?: string) => api.put<any>(`/approvals/${id}/reject`, { note });

// ── Users ────────────────────────────────────────────────────────────────────
export const getUsers          = ()             => api.get<any>('/users');
export const getUser           = (id: string)   => api.get<any>(`/users/${id}`);
export const createUser        = (data: any)    => api.post<any>('/users', data);
export const updateUser        = (id: string, data: any) => api.put<any>(`/users/${id}`, data);
export const deleteUser        = (id: string)   => api.delete<any>(`/users/${id}`);
export const forcePasswordReset = (id: string)  => api.post<any>(`/users/${id}/force-reset`, {});
export const updateUserRole    = (id: string, role: string, department?: string) => api.put<any>(`/users/${id}/role`, { role, department });

// ── Stock ────────────────────────────────────────────────────────────────────
export const getStock          = (itemId?: string) => api.get<any>(itemId ? `/stock?item_id=${itemId}` : '/stock');
export const getStockLevels    = ()             => api.get<any>('/stock');
export const adjustStock       = (id: string, data: any) => api.post<any>(`/stock/${id}/adjust`, data);
export const getStockHistory   = (id: string)   => api.get<any>(`/stock/${id}/history`);
export const getStockMovements = (params?: any) => api.get<any>(`/stock/movements${params ? '?' + new URLSearchParams(params) : ''}`);
export const updateStock       = (data: any)    => api.put<any>('/stock', data);

// ── Notifications ────────────────────────────────────────────────────────────
export const getNotifications      = ()             => api.get<any>('/notifications');
export const markNotificationRead  = (id: string)   => api.put<any>(`/notifications/${id}/read`, {});
export const markAllRead           = ()             => api.put<any>('/notifications/read-all', {});
export const markAllNotificationsRead = ()          => api.put<any>('/notifications/read-all', {});
export const getBadgeCounts        = ()             => api.get<any>('/badge-counts');

// ── Vendors ──────────────────────────────────────────────────────────────────
export const getVendors        = ()             => api.get<any>('/vendors');
export const getVendor         = (id: string)   => api.get<any>(`/vendors/${id}`);
export const createVendor      = (data: any)    => api.post<any>('/vendors', data);
export const updateVendor      = (id: string, data: any) => api.put<any>(`/vendors/${id}`, data);
export const deleteVendor      = (id: string)   => api.delete<any>(`/vendors/${id}`);

// ── Purchase Orders ──────────────────────────────────────────────────────────
export const getPurchaseOrders  = (params?: any) => api.get<any>(`/purchase-orders${params ? '?' + new URLSearchParams(params) : ''}`);
export const getPurchaseOrder   = (id: string)   => api.get<any>(`/purchase-orders/${id}`);
export const createPurchaseOrder = (data: any)   => api.post<any>('/purchase-orders', data);
export const updatePurchaseOrder = (id: string, data: any) => api.put<any>(`/purchase-orders/${id}`, data);
export const receivePurchaseOrder = (id: string, data: any) => api.post<any>(`/purchase-orders/${id}/receive`, data);

// ── Transfers ────────────────────────────────────────────────────────────────
export const getTransfers      = (params?: any) => api.get<any>(`/transfers${params ? '?' + new URLSearchParams(params) : ''}`);
export const getTransfer       = (id: string)   => api.get<any>(`/transfers/${id}`);
export const createTransfer    = (data: any)    => api.post<any>('/transfers', data);
export const updateTransfer    = (id: string, data: any) => api.put<any>(`/transfers/${id}`, data);

// ── Cycle Counts ─────────────────────────────────────────────────────────────
export const getCycleCounts    = (params?: any) => api.get<any>(`/cycle-counts${params ? '?' + new URLSearchParams(params) : ''}`);
export const getCycleCount     = (id: string)   => api.get<any>(`/cycle-counts/${id}`);
export const createCycleCount  = (data: any)    => api.post<any>('/cycle-counts', data);
export const updateCycleCount  = (id: string, data: any) => api.put<any>(`/cycle-counts/${id}`, data);
export const deleteCycleCount  = (id: string)   => api.delete<any>(`/cycle-counts/${id}`);

// ── Returns ──────────────────────────────────────────────────────────────────
export const getReturns        = (params?: any) => api.get<any>(`/returns${params ? '?' + new URLSearchParams(params) : ''}`);
export const getReturn         = (id: string)   => api.get<any>(`/returns/${id}`);
export const createReturn      = (data: any)    => api.post<any>('/returns', data);
export const updateReturn      = (id: string, data: any) => api.put<any>(`/returns/${id}`, data);

// ── Bins & Locations ─────────────────────────────────────────────────────────
export const getBins           = ()             => api.get<any>('/bins');
export const getBin            = (id: string)   => api.get<any>(`/bins/${id}`);
export const createBin         = (data: any)    => api.post<any>('/bins', data);
export const updateBin         = (id: string, data: any) => api.put<any>(`/bins/${id}`, data);
export const getLocations      = ()             => api.get<any>('/locations');
export const createLocation    = (data: any)    => api.post<any>('/locations', data);
export const updateLocation    = (id: string, data: any) => api.put<any>(`/locations/${id}`, data);

// ── Lots ─────────────────────────────────────────────────────────────────────
export const getLots           = ()             => api.get<any>('/lots');
export const getLot            = (id: string)   => api.get<any>(`/lots/${id}`);
export const createLot         = (data: any)    => api.post<any>('/lots', data);
export const updateLot         = (id: string, data: any) => api.put<any>(`/lots/${id}`, data);

// ── Reports ──────────────────────────────────────────────────────────────────
export const getReports        = (params?: any) => api.get<any>(`/reports${params ? '?' + new URLSearchParams(params) : ''}`);
export const getDashboardStats = ()             => api.get<any>('/reports/dashboard');
export const getLowStockReport = ()             => api.get<any>('/reports/low-stock');
export const getAuditLog       = (params?: any) => api.get<any>(`/audit-log${params ? '?' + new URLSearchParams(params) : ''}`);

// ── App Settings ─────────────────────────────────────────────────────────────
export const getAppSettings    = ()             => api.get<any>('/app-settings');
export const updateAppSettings = (data: any)    => api.put<any>('/app-settings', data);
export const getWorkflowSettings = ()           => api.get<any>('/app-settings/workflow');
export const updateWorkflowSettings = (data: any) => api.put<any>('/app-settings/workflow', data);
export const getSecuritySettings = ()           => api.get<any>('/app-settings/security');
export const updateSecuritySettings = (data: any) => api.put<any>('/app-settings/security', data);
export const getEmailSettings  = ()             => api.get<any>('/app-settings/email');
export const updateEmailSettings = (data: any)  => api.put<any>('/app-settings/email', data);
export const getEmailTemplates = ()             => api.get<any>('/email-templates');
export const updateEmailTemplate = (id: string, data: any) => api.put<any>(`/email-templates/${id}`, data);
export const resetEmailTemplate = (id: string)  => api.post<any>(`/email-templates/${id}/reset`, {});
export const getEmailTemplatePreview = (id: string) => api.get<any>(`/email-templates/${id}/preview`);
export const getRequestorCategorySettings = ()  => api.get<any>('/app-settings/requestor-categories');
export const updateRequestorCategorySettings = (data: any) => api.put<any>('/app-settings/requestor-categories', data);

// ── Email Preferences ────────────────────────────────────────────────────────
export const getEmailPreferences   = ()         => api.get<any>('/email-preferences');
export const updateEmailPreferences = (data: any) => api.put<any>('/email-preferences', data);

// ── Auth Utilities ───────────────────────────────────────────────────────────
export const checkPasswordExpiry   = ()         => api.get<any>('/auth/check-password-expiry');
export const changePassword        = (data: any) => api.post<any>('/auth/change-password', data);
