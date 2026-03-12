import { AuthService } from './auth';

// Phase 1: still pointing to Supabase backend — swap to Azure App Service URL in Phase 3
export const API_URL = import.meta.env.VITE_API_URL || '';

export function getAuthHeaders(): Record<string, string> {
  const token = AuthService.getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function fetchAPI(endpoint: string, options: RequestInit = {}, hasRetried = false) {
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
        // Avoid redirect loops: retry once with a freshly acquired token,
        // then surface the error to the caller instead of force-logging out.
        if (!hasRetried) {
          const refreshedToken = await AuthService.getFreshToken();
          if (refreshedToken) {
            return fetchAPI(endpoint, options, true);
          }
        }
        throw new Error('Unauthorized');
      }
      const errorText = await response.text();
      let error;
      try { const j = JSON.parse(errorText); error = j.error || `API request failed (${response.status})`; }
      catch { error = errorText || `API request failed (${response.status})`; }
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

export async function searchOnline(sku: string) {
  return fetchAPI('/search-online', { method: 'POST', body: JSON.stringify({ sku }) });
}

export async function getItem(id: string) { return fetchAPI(`/items/${id}`); }

export async function createItem(itemData: any) {
  return fetchAPI('/items', { method: 'POST', body: JSON.stringify(itemData) });
}

export async function uploadProductImage(file: File) {
  const token = AuthService.getAccessToken();
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_URL}/upload-product-image`, {
    method: 'POST',
    headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    body: formData,
  });
  if (!response.ok) {
    const errorText = await response.text();
    let error;
    try { const j = JSON.parse(errorText); error = j.error || `Upload failed (${response.status})`; }
    catch { error = errorText || `Upload failed (${response.status})`; }
    throw new Error(error);
  }
  return response.json();
}

export async function updateItem(id: string, updates: any) {
  return fetchAPI(`/items/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
}

export async function bulkUploadItems(items: any[]) {
  return fetchAPI('/items/bulk-upload', { method: 'POST', body: JSON.stringify({ items }) });
}

export async function purgeInactiveItems() {
  return fetchAPI('/items/purge-inactive', { method: 'DELETE' });
}

export async function deactivateItem(id: string) {
  return fetchAPI(`/items/${id}`, { method: 'DELETE' });
}

// ── Stock ─────────────────────────────────────────────────────────────────────
export async function getStock(itemId?: string) {
  return itemId ? fetchAPI(`/stock/${itemId}`) : fetchAPI('/stock');
}

export async function adjustStock(adjustment: { itemId: string; locationId: string; quantity: number; reason: string; type: string }) {
  return fetchAPI('/stock/adjust', { method: 'POST', body: JSON.stringify(adjustment) });
}

export async function getStockMovements() { return fetchAPI('/stock/movements'); }

// ── Orders ────────────────────────────────────────────────────────────────────
export async function createOrder(orderData: any) {
  return fetchAPI('/orders', { method: 'POST', body: JSON.stringify(orderData) });
}

export async function getOrders(status?: string) {
  return fetchAPI(status ? `/orders?status=${status}` : '/orders');
}

export async function getOrder(id: string) { return fetchAPI(`/orders/${id}`); }

export async function updateOrderStatus(id: string, status: string, notes?: string) {
  return fetchAPI(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, notes }) });
}

export async function fulfillOrder(id: string, fulfillmentData: any) {
  return fetchAPI(`/orders/${id}/fulfill`, { method: 'POST', body: JSON.stringify(fulfillmentData) });
}

export async function cancelOrder(id: string, reason?: string) {
  return fetchAPI(`/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export async function updateFulfilledOrder(id: string, updateData: any) {
  return fetchAPI(`/orders/${id}/update-fulfilled`, { method: 'PUT', body: JSON.stringify(updateData) });
}

// ── Categories & Locations ────────────────────────────────────────────────────
export async function getCategories() { return fetchAPI('/categories'); }

export async function createCategory(name: string, description?: string) {
  return fetchAPI('/categories', { method: 'POST', body: JSON.stringify({ name, description }) });
}

export async function updateCategory(id: string, name: string, description?: string, active?: boolean) {
  return fetchAPI(`/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name, description, active }) });
}

export async function getLocations() { return fetchAPI('/locations'); }

export async function createLocation(name: string, type?: string, description?: string) {
  return fetchAPI('/locations', { method: 'POST', body: JSON.stringify({ name, type, description }) });
}

export async function updateLocation(id: string, name: string, type?: string, description?: string) {
  return fetchAPI(`/locations/${id}`, { method: 'PUT', body: JSON.stringify({ name, type, description }) });
}

// ── Requestor Category Settings ───────────────────────────────────────────────
export async function getRequestorCategorySettings() { return fetchAPI('/settings/requestor-categories'); }

export async function updateRequestorCategorySettings(allowedCategories: string[], enabled: boolean) {
  return fetchAPI('/settings/requestor-categories', { method: 'PUT', body: JSON.stringify({ allowedCategories, enabled }) });
}

// ── Reports & Notifications ───────────────────────────────────────────────────
export async function getLowStockReport() { return fetchAPI('/reports/low-stock'); }
export async function getAuditLog() { return fetchAPI('/audit-log'); }
export async function getNotifications() { return fetchAPI('/notifications'); }
export async function getBadgeCounts() { return fetchAPI('/badge-counts'); }

export async function markNotificationRead(id: string) {
  return fetchAPI(`/notifications/${id}/read`, { method: 'PUT' });
}

// ── Users ─────────────────────────────────────────────────────────────────────
export async function getUsers() { return fetchAPI('/users'); }

export async function createUser(userData: { name: string; email: string; role: string; department?: string; tempPassword?: string }) {
  return fetchAPI('/users', { method: 'POST', body: JSON.stringify(userData) });
}

export async function updateUser(id: string, updates: { name?: string; email?: string; role?: string; department?: string; active?: boolean; mustResetPassword?: boolean }) {
  return fetchAPI(`/users/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
}

export async function deleteUser(id: string) { return fetchAPI(`/users/${id}`, { method: 'DELETE' }); }

export async function clearMustResetPassword() {
  const userStr = localStorage.getItem('user');
  if (!userStr) throw new Error('No user session');
  const user = JSON.parse(userStr);
  return fetchAPI(`/users/${user.id}/clear-reset-flag`, { method: 'PUT' });
}

export async function forcePasswordReset(userId: string, tempPassword?: string) {
  return fetchAPI(`/users/${userId}/force-password-reset`, { method: 'POST', body: JSON.stringify({ tempPassword }) });
}

export async function changePassword(newPassword: string, oldPassword?: string) {
  return fetchAPI('/auth/change-password', { method: 'PUT', body: JSON.stringify({ newPassword, oldPassword }) });
}

// ── Security Settings ─────────────────────────────────────────────────────────
export async function getSecuritySettings() { return fetchAPI('/security-settings'); }

export async function updateSecuritySettings(settings: { passwordExpiryEnabled?: boolean; passwordExpiryDays?: number }) {
  return fetchAPI('/security-settings', { method: 'PUT', body: JSON.stringify(settings) });
}

export async function checkPasswordExpiry() { return fetchAPI('/auth/check-password-expiry'); }

// ── Email Settings ────────────────────────────────────────────────────────────
export async function getEmailSettings() { return fetchAPI('/email-settings'); }

export async function updateEmailSettings(enabled: boolean) {
  return fetchAPI('/email-settings', { method: 'PUT', body: JSON.stringify({ enabled }) });
}

export async function getEmailTemplates() { return fetchAPI('/email-templates'); }

export async function getEmailTemplatePreview(templateType: string) {
  return fetchAPI(`/email-templates/${templateType}/preview`);
}

export async function updateEmailTemplate(templateType: string, subject: string, htmlBody: string, textBody: string) {
  return fetchAPI('/email-templates', { method: 'PUT', body: JSON.stringify({ templateType, subject, htmlBody, textBody }) });
}

export async function resetEmailTemplate(templateType: string) {
  return fetchAPI(`/email-templates/${templateType}/reset`, { method: 'POST' });
}

// ── App & Workflow Settings ───────────────────────────────────────────────────
export async function getAppSettings() { return fetchAPI('/app-settings'); }

export async function updateAppSettings(appName: string) {
  return fetchAPI('/app-settings', { method: 'PUT', body: JSON.stringify({ appName }) });
}

export async function getWorkflowSettings() { return fetchAPI('/workflow-settings'); }

export async function updateWorkflowSettings(settings: { approvalRequired: boolean }) {
  return fetchAPI('/workflow-settings', { method: 'PUT', body: JSON.stringify(settings) });
}

// ── Email Preferences ─────────────────────────────────────────────────────────
export async function getEmailPreferences(userId: string) {
  return fetchAPI(`/users/${userId}/email-preferences`);
}

export async function updateEmailPreferences(userId: string, preferences: { onOrderSubmitted?: boolean; onOrderApproved?: boolean; onOrderDenied?: boolean; onOrderFulfilled?: boolean }) {
  return fetchAPI(`/users/${userId}/email-preferences`, { method: 'PUT', body: JSON.stringify(preferences) });
}

// ── Bins & Lots ───────────────────────────────────────────────────────────────
export async function getBins(locationId?: string) {
  return fetchAPI(locationId ? `/bins?locationId=${locationId}` : '/bins');
}

export async function createBin(binData: { locationId: string; aisle?: string; shelf?: string; bin?: string; description?: string }) {
  return fetchAPI('/bins', { method: 'POST', body: JSON.stringify(binData) });
}

export async function getLots(itemId: string) { return fetchAPI(`/lots/${itemId}`); }

export async function createLot(lotData: { itemId: string; lotNumber: string; expirationDate?: string; quantity: number; locationId: string; binId?: string; receivedFrom?: string }) {
  return fetchAPI('/lots', { method: 'POST', body: JSON.stringify(lotData) });
}

export async function getExpiringItems(days: number = 30) { return fetchAPI(`/reports/expiring?days=${days}`); }

export async function recallLot(lotId: string, reason: string) {
  return fetchAPI(`/lots/${lotId}/recall`, { method: 'POST', body: JSON.stringify({ reason }) });
}

// ── Purchase Orders ───────────────────────────────────────────────────────────
export async function getPurchaseOrders(status?: string) {
  return fetchAPI(status ? `/purchase-orders?status=${status}` : '/purchase-orders');
}

export async function getPurchaseOrder(id: string) { return fetchAPI(`/purchase-orders/${id}`); }

export async function createPurchaseOrder(poData: any) {
  return fetchAPI('/purchase-orders', { method: 'POST', body: JSON.stringify(poData) });
}

export async function receivePurchaseOrder(id: string, receiptData: any) {
  return fetchAPI(`/purchase-orders/${id}/receive`, { method: 'POST', body: JSON.stringify(receiptData) });
}

// ── Transfers ─────────────────────────────────────────────────────────────────
export async function getTransfers() { return fetchAPI('/transfers'); }

export async function createTransfer(transferData: any) {
  return fetchAPI('/transfers', { method: 'POST', body: JSON.stringify(transferData) });
}

export async function completeTransfer(id: string) {
  return fetchAPI(`/transfers/${id}/complete`, { method: 'POST' });
}

// ── Returns ───────────────────────────────────────────────────────────────────
export async function getReturns() { return fetchAPI('/returns'); }

export async function createReturnToVendor(data: any) {
  return fetchAPI('/returns/vendor', { method: 'POST', body: JSON.stringify(data) });
}

export async function createReturnToStock(data: any) {
  return fetchAPI('/returns/stock', { method: 'POST', body: JSON.stringify(data) });
}

export async function approveReturn(type: 'vendor' | 'stock', returnId: string) {
  return fetchAPI(`/returns/${type}/${returnId}/approve`, { method: 'POST' });
}

// ── Cycle Counts ──────────────────────────────────────────────────────────────
export async function getCycleCounts() { return fetchAPI('/cycle-counts'); }

export async function generateCycleCount(data: { method: 'location' | 'category' | 'abc' | 'all'; filterValue?: string }) {
  return fetchAPI('/cycle-counts/generate', { method: 'POST', body: JSON.stringify(data) });
}

export async function submitCycleCount(cycleCountId: string, data: { countedItems: any[]; notes?: string }) {
  return fetchAPI(`/cycle-counts/${cycleCountId}/submit`, { method: 'POST', body: JSON.stringify(data) });
}

export async function approveCycleCount(cycleCountId: string, data: { approvedItems: any[]; notes?: string }) {
  return fetchAPI(`/cycle-counts/${cycleCountId}/approve`, { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteCycleCount(cycleCountId: string) {
  return fetchAPI(`/cycle-counts/${cycleCountId}`, { method: 'DELETE' });
}

// ── Vendors ───────────────────────────────────────────────────────────────────
export async function getVendors() { return fetchAPI('/vendors'); }

export async function createVendor(vendorData: any) {
  return fetchAPI('/vendors', { method: 'POST', body: JSON.stringify(vendorData) });
}

// ── Workflows ─────────────────────────────────────────────────────────────────
export async function routeOrderForApproval(orderId: string) {
  return fetchAPI(`/orders/${orderId}/route-approval`, { method: 'POST' });
}

export async function generatePickTask(orderId: string) {
  return fetchAPI(`/orders/${orderId}/generate-pick-task`, { method: 'POST' });
}

export async function processPickTask(pickTaskId: string, data: { pickedItems: any[]; notes?: string }) {
  return fetchAPI(`/pick-tasks/${pickTaskId}/process`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getPickTasks(status?: string) {
  return fetchAPI(status ? `/pick-tasks?status=${status}` : '/pick-tasks');
}

export async function getReorderReport() { return fetchAPI('/reports/reorder'); }

export async function autoFillBackorders(poId: string) {
  return fetchAPI(`/purchase-orders/${poId}/auto-fill-backorders`, { method: 'POST' });
}

export async function pullExpiredLot(data: { lotId: string; action: 'pull_waste' | 'pull_replace'; replacementLotId?: string; wasteReason?: string }) {
  return fetchAPI('/expiration/pull-replace', { method: 'POST', body: JSON.stringify(data) });
}

// ── Advanced Reports ──────────────────────────────────────────────────────────
export async function getUsageByDepartment(startDate?: string, endDate?: string) {
  let url = '/reports/usage-by-department?';
  if (startDate) url += `startDate=${startDate}&`;
  if (endDate) url += `endDate=${endDate}&`;
  return fetchAPI(url);
}

export async function getTurnoverReport() { return fetchAPI('/reports/turnover'); }

export async function getFulfillmentSLAReport(startDate?: string, endDate?: string) {
  let url = '/reports/fulfillment-sla?';
  if (startDate) url += `startDate=${startDate}&`;
  if (endDate) url += `endDate=${endDate}&`;
  return fetchAPI(url);
}

export async function getWasteReport(startDate?: string, endDate?: string) {
  let url = '/reports/waste';
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (params.toString()) url += `?${params.toString()}`;
  return fetchAPI(url);
}

// ── Data Management ───────────────────────────────────────────────────────────
export async function deleteAllOrders() { return fetchAPI('/orders/delete-all', { method: 'DELETE' }); }
export async function deleteAllItems() { return fetchAPI('/items/delete-all', { method: 'DELETE' }); }
