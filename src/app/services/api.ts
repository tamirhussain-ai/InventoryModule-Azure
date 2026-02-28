import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { AuthService } from './auth';

export const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5ec3cec0`;

export function getAuthHeaders() {
  const token = AuthService.getAccessToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
    ...(token ? { 'X-Session-Token': token } : {}),
  };
}

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const token = AuthService.getAccessToken();
  
  try {
    console.log(`API Request: ${endpoint}`, { hasToken: !!token });
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    console.log(`API Response: ${endpoint}`, { status: response.status, ok: response.ok });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('Authentication expired or invalid. Logging out.');
        await AuthService.signout();
        window.location.href = '/';
        throw new Error('Session expired');
      }

      const errorText = await response.text();
      console.error(`API Error [${response.status}] ${endpoint}:`, errorText);
      
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
      console.error(`Network error for ${endpoint}: Cannot reach server. Please check:`, {
        apiUrl: API_URL,
        endpoint,
        fullUrl: `${API_URL}${endpoint}`,
      });
      throw new Error('Cannot connect to server. Please check your connection and try again.');
    }
    console.error(`Network error for ${endpoint}:`, error);
    throw error;
  }
}

// Items
export async function getItems(filters?: { active?: boolean; category?: string; search?: string }) {
  let url = '/items?';
  if (filters?.active !== undefined) url += `active=${filters.active}&`;
  if (filters?.category) url += `category=${encodeURIComponent(filters.category)}&`;
  if (filters?.search) url += `search=${encodeURIComponent(filters.search)}&`;
  return fetchAPI(url);
}

export async function searchOnline(sku: string) {
  return fetchAPI('/search-online', {
    method: 'POST',
    body: JSON.stringify({ sku }),
  });
}

export async function getItem(id: string) {
  return fetchAPI(`/items/${id}`);
}

export async function createItem(itemData: any) {
  return fetchAPI('/items', {
    method: 'POST',
    body: JSON.stringify(itemData),
  });
}

export async function updateItem(id: string, updates: any) {
  return fetchAPI(`/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deactivateItem(id: string) {
  return fetchAPI(`/items/${id}`, {
    method: 'DELETE',
  });
}

// Stock
export async function getStock(itemId?: string) {
  if (itemId) {
    return fetchAPI(`/stock/${itemId}`);
  }
  return fetchAPI('/stock');
}

export async function adjustStock(adjustment: {
  itemId: string;
  locationId: string;
  quantity: number;
  reason: string;
  type: string;
}) {
  return fetchAPI('/stock/adjust', {
    method: 'POST',
    body: JSON.stringify(adjustment),
  });
}

export async function getStockMovements() {
  return fetchAPI('/stock/movements');
}

// Orders
export async function createOrder(orderData: any) {
  return fetchAPI('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });
}

export async function getOrders(status?: string) {
  const url = status ? `/orders?status=${status}` : '/orders';
  return fetchAPI(url);
}

export async function getOrder(id: string) {
  return fetchAPI(`/orders/${id}`);
}

export async function updateOrderStatus(id: string, status: string, notes?: string) {
  return fetchAPI(`/orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, notes }),
  });
}

export async function fulfillOrder(id: string, fulfillmentData: any) {
  return fetchAPI(`/orders/${id}/fulfill`, {
    method: 'POST',
    body: JSON.stringify(fulfillmentData),
  });
}

// Categories & Locations
export async function getCategories() {
  return fetchAPI('/categories');
}

export async function createCategory(name: string, description?: string) {
  return fetchAPI('/categories', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function updateCategory(id: string, name: string, description?: string) {
  return fetchAPI(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description }),
  });
}

export async function getLocations() {
  return fetchAPI('/locations');
}

export async function createLocation(name: string, type?: string, description?: string) {
  return fetchAPI('/locations', {
    method: 'POST',
    body: JSON.stringify({ name, type, description }),
  });
}

export async function updateLocation(id: string, name: string, type?: string, description?: string) {
  return fetchAPI(`/locations/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, type, description }),
  });
}

// Reports & Notifications
export async function getLowStockReport() {
  return fetchAPI('/reports/low-stock');
}

export async function getAuditLog() {
  return fetchAPI('/audit-log');
}

export async function getNotifications() {
  return fetchAPI('/notifications');
}

export async function markNotificationRead(id: string) {
  return fetchAPI(`/notifications/${id}/read`, {
    method: 'PUT',
  });
}

// Users (admin only)
export async function getUsers() {
  return fetchAPI('/users');
}

export async function createUser(userData: {
  name: string;
  email: string;
  role: string;
  department?: string;
}) {
  return fetchAPI('/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function updateUser(id: string, updates: {
  name?: string;
  email?: string;
  role?: string;
  department?: string;
}) {
  return fetchAPI(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// Bins
export async function getBins(locationId?: string) {
  const url = locationId ? `/bins?locationId=${locationId}` : '/bins';
  return fetchAPI(url);
}

export async function createBin(binData: {
  locationId: string;
  aisle?: string;
  shelf?: string;
  bin?: string;
  description?: string;
}) {
  return fetchAPI('/bins', {
    method: 'POST',
    body: JSON.stringify(binData),
  });
}

// Lots and Expiration Tracking
export async function createLot(lotData: {
  itemId: string;
  lotNumber: string;
  expirationDate?: string;
  quantity: number;
  locationId: string;
  binId?: string;
  receivedFrom?: string;
}) {
  return fetchAPI('/lots', {
    method: 'POST',
    body: JSON.stringify(lotData),
  });
}

export async function getLots(itemId: string) {
  return fetchAPI(`/lots/${itemId}`);
}

export async function getExpiringItems(days: number = 30) {
  return fetchAPI(`/reports/expiring?days=${days}`);
}

export async function recallLot(lotId: string, reason: string) {
  return fetchAPI(`/lots/${lotId}/recall`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// Purchase Orders
export async function createPurchaseOrder(poData: {
  poNumber?: string;
  vendor: string;
  expectedDeliveryDate?: string;
  items: any[];
  totalCost: number;
  notes?: string;
}) {
  return fetchAPI('/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(poData),
  });
}

export async function getPurchaseOrders(status?: string) {
  const url = status ? `/purchase-orders?status=${status}` : '/purchase-orders';
  return fetchAPI(url);
}

export async function getPurchaseOrder(id: string) {
  return fetchAPI(`/purchase-orders/${id}`);
}

export async function receivePurchaseOrder(
  id: string,
  receiptData: {
    locationId?: string;
    items: any[];
    notes?: string;
    damagedItems?: any[];
  }
) {
  return fetchAPI(`/purchase-orders/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify(receiptData),
  });
}

// Stock Transfers
export async function createTransfer(transferData: {
  itemId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  lotId?: string;
  reason?: string;
}) {
  return fetchAPI('/transfers', {
    method: 'POST',
    body: JSON.stringify(transferData),
  });
}

export async function completeTransfer(id: string) {
  return fetchAPI(`/transfers/${id}/complete`, {
    method: 'POST',
  });
}

export async function getTransfers() {
  return fetchAPI('/transfers');
}

// ========== CRITICAL WORKFLOWS ==========

// Workflow A: Approval routing and pick tasks
export async function routeOrderForApproval(orderId: string) {
  return fetchAPI(`/orders/${orderId}/route-approval`, {
    method: 'POST',
  });
}

export async function generatePickTask(orderId: string) {
  return fetchAPI(`/orders/${orderId}/generate-pick-task`, {
    method: 'POST',
  });
}

export async function processPickTask(pickTaskId: string, data: {
  pickedItems: any[];
  notes?: string;
}) {
  return fetchAPI(`/pick-tasks/${pickTaskId}/process`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getPickTasks(status?: string) {
  const url = status ? `/pick-tasks?status=${status}` : '/pick-tasks';
  return fetchAPI(url);
}

// Workflow B: Reorder and backorder management
export async function getReorderReport() {
  return fetchAPI('/reports/reorder');
}

export async function autoFillBackorders(poId: string) {
  return fetchAPI(`/purchase-orders/${poId}/auto-fill-backorders`, {
    method: 'POST',
  });
}

// Workflow C: Returns
export async function createReturnToVendor(data: {
  itemId: string;
  quantity: number;
  vendor: string;
  reasonCode: string;
  reason: string;
  poId?: string;
  lotNumber?: string;
  requiresApproval?: boolean;
}) {
  return fetchAPI('/returns/vendor', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createReturnToStock(data: {
  orderId?: string;
  itemId: string;
  quantity: number;
  locationId?: string;
  reasonCode: string;
  reason: string;
  requiresApproval?: boolean;
}) {
  return fetchAPI('/returns/stock', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function approveReturn(type: 'vendor' | 'stock', returnId: string) {
  return fetchAPI(`/returns/${type}/${returnId}/approve`, {
    method: 'POST',
  });
}

export async function getReturns() {
  return fetchAPI('/returns');
}

// Workflow D: Cycle counts
export async function generateCycleCount(data: {
  method: 'location' | 'category' | 'abc' | 'all';
  filterValue?: string;
}) {
  return fetchAPI('/cycle-counts/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function submitCycleCount(cycleCountId: string, data: {
  countedItems: any[];
  notes?: string;
}) {
  return fetchAPI(`/cycle-counts/${cycleCountId}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function approveCycleCount(cycleCountId: string, data: {
  approvedItems: any[];
  notes?: string;
}) {
  return fetchAPI(`/cycle-counts/${cycleCountId}/approve`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getCycleCounts() {
  return fetchAPI('/cycle-counts');
}

// Workflow E: Expiration management
export async function pullExpiredLot(data: {
  lotId: string;
  action: 'pull_waste' | 'pull_replace';
  replacementLotId?: string;
  wasteReason?: string;
}) {
  return fetchAPI('/expiration/pull-replace', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getWasteReport(startDate?: string, endDate?: string) {
  let url = '/reports/waste';
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (params.toString()) url += `?${params.toString()}`;
  return fetchAPI(url);
}

// Vendors
export async function createVendor(vendorData: {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}) {
  return fetchAPI('/vendors', {
    method: 'POST',
    body: JSON.stringify(vendorData),
  });
}

export async function getVendors() {
  return fetchAPI('/vendors');
}

// Advanced Reports
export async function getUsageByDepartment(startDate?: string, endDate?: string) {
  let url = '/reports/usage-by-department?';
  if (startDate) url += `startDate=${startDate}&`;
  if (endDate) url += `endDate=${endDate}&`;
  return fetchAPI(url);
}

export async function getTurnoverReport() {
  return fetchAPI('/reports/turnover');
}

export async function getFulfillmentSLAReport(startDate?: string, endDate?: string) {
  let url = '/reports/fulfillment-sla?';
  if (startDate) url += `startDate=${startDate}&`;
  if (endDate) url += `endDate=${endDate}&`;
  return fetchAPI(url);
}