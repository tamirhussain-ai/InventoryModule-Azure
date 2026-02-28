import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// Log environment variables status (without exposing keys)
console.log('=== ENVIRONMENT VARIABLES CHECK ===');
console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? `SET (length: ${supabaseServiceKey.length})` : 'NOT SET');
console.log('SUPABASE_ANON_KEY:', supabaseAnonKey ? `SET (length: ${supabaseAnonKey.length})` : 'NOT SET');
console.log('===================================');

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Session-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Global error handler
app.onError((err, c) => {
  console.error('Global error handler caught:', err);
  console.error('Error type:', typeof err);
  console.error('Error message:', err.message);
  console.error('Error stack:', err.stack);
  return c.json({ error: 'Internal server error', details: err.message }, 500);
});

// Add a catch-all error middleware
app.use('*', async (c, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Middleware error:', error);
    return c.json({ error: 'Request processing failed', details: String(error) }, 500);
  }
});

// Explicit OPTIONS handler for preflight requests
app.options("/*", (c) => {
  return c.text("", 204);
});

// Helper to verify user authorization using session tokens
async function verifyAuth(c: any) {
  const authHeader = c.req.header('Authorization');
  const sessionTokenHeader = c.req.header('X-Session-Token');
  
  console.log('=== verifyAuth called ===');
  
  let token: string | undefined;
  
  if (sessionTokenHeader) {
    console.log('Using X-Session-Token header');
    token = sessionTokenHeader;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log('Using Authorization header');
    token = authHeader.split(' ')[1];
  } else {
    console.log('verifyAuth: No valid auth token found');
    return null;
  }
  
  // Clean token just in case
  token = token?.trim();
  
  console.log('Token extracted, length:', token?.length);
  
  if (!token) {
    return null;
  }
  
  // Don't try to verify if it's the anon key
  if (token === supabaseAnonKey) {
    console.log('verifyAuth: Request using anon key, not a user token');
    return null;
  }
  
  try {
    // Look up session in KV store
    console.log('Looking up session:', `session:${token.substring(0, 20)}...`);
    const session = await kv.get(`session:${token}`);
    console.log('Session lookup result:', session ? 'found' : 'not found');
    
    if (!session) {
      console.log('verifyAuth: No session found for token');
      return null;
    }
    
    console.log('Session data:', { userId: session.userId, email: session.email, createdAt: session.createdAt });
    
    // Check if session is expired (24 hours)
    const sessionAge = Date.now() - new Date(session.createdAt).getTime();
    console.log('Session age (ms):', sessionAge, 'Max age (ms):', 24 * 60 * 60 * 1000);
    
    if (sessionAge > 24 * 60 * 60 * 1000) {
      console.log('verifyAuth: Session expired');
      await kv.del(`session:${token}`);
      return null;
    }
    
    console.log('verifyAuth: Successfully verified user:', session.userId);
    return { id: session.userId, email: session.email };
  } catch (error) {
    console.log('verifyAuth: Exception during verification:', error);
    console.log('Error type:', typeof error, 'Error message:', error?.message);
    return null;
  }
}

// Helper to get user with role
async function getUserWithRole(userId: string) {
  const userData = await kv.get(`user:${userId}`);
  return userData;
}

// Helper to create audit log entry
async function createAuditLog(entityType: string, entityId: string, action: string, userId: string, before: any, after: any) {
  const auditId = crypto.randomUUID();
  await kv.set(`audit:${auditId}`, {
    id: auditId,
    entityType,
    entityId,
    action,
    userId,
    before,
    after,
    timestamp: new Date().toISOString(),
  });
  return auditId;
}

// Helper to create notification
async function createNotification(userId: string, type: string, message: string) {
  const notifId = crypto.randomUUID();
  await kv.set(`notification:${notifId}`, {
    id: notifId,
    userId,
    type,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  });
  return notifId;
}

// Health check endpoint
app.get("/make-server-5ec3cec0/health", (c) => {
  return c.json({ status: "ok" });
});

// Ping endpoint
app.get("/make-server-5ec3cec0/ping", (c) => {
  return c.text("pong");
});

// ========== ONLINE SKU SEARCH ==========

// Search for products online by SKU
app.post("/make-server-5ec3cec0/search-online", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { sku } = await c.req.json();
    
    if (!sku || sku.trim() === '') {
      return c.json({ error: 'SKU is required' }, 400);
    }

    console.log('Searching online for SKU:', sku);

    // Try multiple free APIs
    const results: any[] = [];

    try {
      // 1. Try UPCitemdb.com (free tier, no auth required for basic searches)
      // This works for UPC/EAN barcodes
      const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(sku)}`);
      
      if (upcResponse.ok) {
        const upcData = await upcResponse.json();
        console.log('UPCitemdb response:', upcData);
        
        if (upcData.items && upcData.items.length > 0) {
          upcData.items.forEach((item: any) => {
            results.push({
              source: 'UPCitemdb',
              name: item.title || item.brand || 'Unknown Product',
              description: item.description || '',
              sku: item.upc || item.ean || sku,
              brand: item.brand || '',
              category: item.category || 'uncategorized',
              imageUrl: item.images && item.images.length > 0 ? item.images[0] : '',
              manufacturer: item.brand || '',
            });
          });
        }
      }
    } catch (error) {
      console.log('UPCitemdb search failed:', error);
    }

    try {
      // 2. Try Open Food Facts (free, open database for food products)
      const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/search?code=${encodeURIComponent(sku)}&json=true`);
      
      if (offResponse.ok) {
        const offData = await offResponse.json();
        console.log('Open Food Facts response:', offData);
        
        if (offData.products && offData.products.length > 0) {
          offData.products.forEach((product: any) => {
            results.push({
              source: 'Open Food Facts',
              name: product.product_name || product.generic_name || 'Unknown Product',
              description: product.generic_name_en || product.product_name_en || '',
              sku: product.code || sku,
              brand: product.brands || '',
              category: product.categories || 'food',
              imageUrl: product.image_url || product.image_front_url || '',
              manufacturer: product.brands || product.manufacturing_places || '',
            });
          });
        }
      }
    } catch (error) {
      console.log('Open Food Facts search failed:', error);
    }

    // Remove duplicates based on SKU
    const uniqueResults = results.filter((item, index, self) =>
      index === self.findIndex((t) => t.sku === item.sku && t.name === item.name)
    );

    console.log(`Found ${uniqueResults.length} unique results`);

    return c.json({ 
      success: true, 
      results: uniqueResults,
      message: uniqueResults.length === 0 
        ? 'No products found online for this SKU. Try searching with a different format or check if it\'s a valid UPC/EAN code.'
        : `Found ${uniqueResults.length} product(s)`
    });
  } catch (error) {
    console.log('Error searching online:', error);
    return c.json({ error: 'Failed to search online', details: error.message }, 500);
  }
});

// Test KV store endpoint
app.get("/make-server-5ec3cec0/test-kv", async (c) => {
  console.log('=== TESTING KV STORE ===');
  
  try {
    // Test write
    console.log('Attempting to write test key...');
    await kv.set('test:connection', { timestamp: new Date().toISOString(), test: true });
    console.log('Write successful');
    
    // Test read
    console.log('Attempting to read test key...');
    const result = await kv.get('test:connection');
    console.log('Read successful:', result);
    
    // Clean up
    console.log('Cleaning up test key...');
    await kv.del('test:connection');
    console.log('Delete successful');
    
    return c.json({ 
      status: 'KV store is working correctly',
      testResult: result
    });
  } catch (error) {
    console.error('KV STORE TEST FAILED:');
    console.error('Error type:', typeof error);
    console.error('Error message:', error?.message);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Error stack:', error?.stack);
    
    return c.json({ 
      status: 'KV store test failed',
      error: error?.message || String(error),
      errorType: typeof error
    }, 500);
  }
});

// ========== AUTH ROUTES ==========

// Sign up
app.post("/make-server-5ec3cec0/auth/signup", async (c) => {
  try {
    const { email, password, name, role, department } = await c.req.json();
    
    if (!email || !password || !name || !role) {
      return c.json({ error: 'Email, password, name, and role are required' }, 400);
    }

    // Valid roles: admin, fulfillment, requestor, approver
    const validRoles = ['admin', 'fulfillment', 'requestor', 'approver'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role, department },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.log('Sign up error:', error);
      return c.json({ error: error.message }, 400);
    }

    // Store user profile in KV
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name,
      role,
      department: department || '',
      createdAt: new Date().toISOString(),
    });

    return c.json({ success: true, userId: data.user.id });
  } catch (error) {
    console.log('Unexpected error during sign up:', error);
    return c.json({ error: 'Sign up failed' }, 500);
  }
});

// Sign in
app.post("/make-server-5ec3cec0/auth/signin", async (c) => {
  try {
    console.log('=== SIGNIN REQUEST ===');
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    console.log('Creating Supabase client for sign in...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('Attempting to sign in user:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log('Sign in error:', error);
      return c.json({ error: error.message }, 401);
    }

    console.log('Sign in successful, user ID:', data.user.id);
    
    // Store session in KV
    const token = data.session.access_token;
    console.log('Storing session with token (first 20 chars):', token.substring(0, 20));
    
    try {
      await kv.set(`session:${token}`, {
        userId: data.user.id,
        email: data.user.email,
        createdAt: new Date().toISOString(),
      });
      console.log('Session stored successfully');
    } catch (kvError) {
      console.error('KV SET ERROR:', kvError);
      console.error('KV error type:', typeof kvError);
      console.error('KV error message:', kvError?.message);
      console.error('KV error details:', JSON.stringify(kvError, null, 2));
      return c.json({ error: 'Failed to store session: ' + kvError.message }, 500);
    }

    // Get user profile
    console.log('Fetching user profile...');
    let userProfile;
    try {
      userProfile = await kv.get(`user:${data.user.id}`);
      console.log('User profile fetched:', !!userProfile);
    } catch (kvError) {
      console.error('KV GET ERROR:', kvError);
      console.error('KV error message:', kvError?.message);
      // Continue even if user profile fetch fails
      userProfile = null;
    }

    console.log('Returning successful sign in response');
    return c.json({ 
      success: true, 
      accessToken: token,
      user: userProfile || { id: data.user.id, email: data.user.email },
    });
  } catch (error) {
    console.log('Unexpected error during sign in:', error);
    console.log('Error type:', typeof error);
    console.log('Error message:', error?.message);
    console.log('Error stack:', error?.stack);
    return c.json({ error: 'Sign in failed: ' + (error?.message || 'Unknown error') }, 500);
  }
});

// Get current session
app.get("/make-server-5ec3cec0/auth/session", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await kv.get(`user:${user.id}`);
    return c.json({ user: userProfile || { id: user.id, email: user.email } });
  } catch (error) {
    console.log('Session check error:', error);
    return c.json({ error: 'Session check failed' }, 500);
  }
});

// Sign out
app.post("/make-server-5ec3cec0/auth/signout", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    await supabase.auth.signOut();
    
    // Delete session from KV
    const authHeader = c.req.header('Authorization');
    const sessionTokenHeader = c.req.header('X-Session-Token');
    
    let token;
    if (sessionTokenHeader) {
      token = sessionTokenHeader;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    if (token) {
      await kv.del(`session:${token}`);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.log('Sign out error:', error);
    return c.json({ error: 'Sign out failed' }, 500);
  }
});

// ========== ITEM MANAGEMENT ROUTES ==========

// Create item (admin/fulfillment only)
app.post("/make-server-5ec3cec0/items", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const itemData = await c.req.json();
    const itemId = crypto.randomUUID();
    
    const item = {
      id: itemId,
      name: itemData.name,
      description: itemData.description || '',
      sku: itemData.sku || '',
      itemNumber: itemData.itemNumber || '',
      category: itemData.category || 'uncategorized',
      
      // Unit and packaging
      unitOfMeasure: itemData.unitOfMeasure || 'each',
      packSize: itemData.packSize || 1,
      
      // Vendor and purchasing
      manufacturer: itemData.manufacturer || '',
      vendor: itemData.vendor || '',
      vendorItemNumber: itemData.vendorItemNumber || '',
      contractNumber: itemData.contractNumber || '',
      cost: itemData.cost || 0,
      
      // Reorder settings
      reorderThreshold: itemData.reorderThreshold || 10,
      maxPar: itemData.maxPar || 100,
      leadTimeDays: itemData.leadTimeDays || 7,
      
      // Item flags
      isStocked: itemData.isStocked !== false, // default true
      isControlled: itemData.isControlled || false,
      isHazmat: itemData.isHazmat || false,
      isTempSensitive: itemData.isTempSensitive || false,
      isExpirationTracked: itemData.isExpirationTracked || false,
      isLotTracked: itemData.isLotTracked || false,
      requiresApproval: itemData.requiresApproval || false,
      
      // Storage requirements
      storageTemp: itemData.storageTemp || '', // e.g., "2-8°C"
      
      // Attachments and documentation
      imageUrl: itemData.imageUrl || '',
      attachments: itemData.attachments || [], // Array of {name, url, type}
      notes: itemData.notes || '',
      
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`item:${itemId}`, item);
    
    // Create audit log
    await createAuditLog('item', itemId, 'create', user.id, null, item);

    return c.json({ success: true, item });
  } catch (error) {
    console.log('Error creating item:', error);
    return c.json({ error: 'Failed to create item' }, 500);
  }
});

// Get all items
app.get("/make-server-5ec3cec0/items", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const items = await kv.getByPrefix('item:');
    const activeParam = c.req.query('active');
    const categoryParam = c.req.query('category');
    const searchParam = c.req.query('search');

    let filteredItems = items;

    if (activeParam === 'true') {
      filteredItems = filteredItems.filter((item: any) => item.active === true);
    }

    if (categoryParam) {
      filteredItems = filteredItems.filter((item: any) => item.category === categoryParam);
    }

    if (searchParam) {
      const search = searchParam.toLowerCase();
      filteredItems = filteredItems.filter((item: any) => 
        item.name.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search) ||
        item.sku.toLowerCase().includes(search)
      );
    }

    return c.json({ items: filteredItems });
  } catch (error) {
    console.log('Error fetching items:', error);
    return c.json({ error: 'Failed to fetch items' }, 500);
  }
});

// Get single item
app.get("/make-server-5ec3cec0/items/:id", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const itemId = c.req.param('id');
    const item = await kv.get(`item:${itemId}`);

    if (!item) {
      return c.json({ error: 'Item not found' }, 404);
    }

    return c.json({ item });
  } catch (error) {
    console.log('Error fetching item:', error);
    return c.json({ error: 'Failed to fetch item' }, 500);
  }
});

// Update item (admin/fulfillment only)
app.put("/make-server-5ec3cec0/items/:id", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const itemId = c.req.param('id');
    const existingItem = await kv.get(`item:${itemId}`);

    if (!existingItem) {
      return c.json({ error: 'Item not found' }, 404);
    }

    const updates = await c.req.json();
    const updatedItem = {
      ...existingItem,
      ...updates,
      id: itemId, // prevent ID change
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`item:${itemId}`, updatedItem);
    await createAuditLog('item', itemId, 'update', user.id, existingItem, updatedItem);

    return c.json({ success: true, item: updatedItem });
  } catch (error) {
    console.log('Error updating item:', error);
    return c.json({ error: 'Failed to update item' }, 500);
  }
});

// Deactivate item (admin/fulfillment only)
app.delete("/make-server-5ec3cec0/items/:id", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const itemId = c.req.param('id');
    const existingItem = await kv.get(`item:${itemId}`);

    if (!existingItem) {
      return c.json({ error: 'Item not found' }, 404);
    }

    const deactivatedItem = {
      ...existingItem,
      active: false,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`item:${itemId}`, deactivatedItem);
    await createAuditLog('item', itemId, 'deactivate', user.id, existingItem, deactivatedItem);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error deactivating item:', error);
    return c.json({ error: 'Failed to deactivate item' }, 500);
  }
});

// ========== STOCK MANAGEMENT ROUTES ==========

// Get stock for an item
app.get("/make-server-5ec3cec0/stock/:itemId", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const itemId = c.req.param('itemId');
    const stockRecords = await kv.getByPrefix(`stock:${itemId}:`);

    return c.json({ stock: stockRecords });
  } catch (error) {
    console.log('Error fetching stock:', error);
    return c.json({ error: 'Failed to fetch stock' }, 500);
  }
});

// Update stock (admin/fulfillment only)
app.post("/make-server-5ec3cec0/stock/adjust", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const { itemId, locationId, quantity, reason, type } = await c.req.json();

    if (!itemId || !locationId || quantity === undefined || !reason || !type) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const stockKey = `stock:${itemId}:${locationId}`;
    const existingStock = await kv.get(stockKey) || { 
      itemId, 
      locationId, 
      onHand: 0, 
      reserved: 0, 
      available: 0 
    };

    const newOnHand = existingStock.onHand + quantity;
    const newAvailable = newOnHand - existingStock.reserved;

    if (newOnHand < 0) {
      return c.json({ error: 'Cannot reduce stock below zero' }, 400);
    }

    const updatedStock = {
      ...existingStock,
      onHand: newOnHand,
      available: newAvailable,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(stockKey, updatedStock);

    // Record stock movement
    const movementId = crypto.randomUUID();
    await kv.set(`movement:${movementId}`, {
      id: movementId,
      itemId,
      locationId,
      type,
      quantity,
      reason,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    await createAuditLog('stock', stockKey, 'adjust', user.id, existingStock, updatedStock);

    return c.json({ success: true, stock: updatedStock });
  } catch (error) {
    console.log('Error adjusting stock:', error);
    return c.json({ error: 'Failed to adjust stock' }, 500);
  }
});

// Get all stock (for reports)
app.get("/make-server-5ec3cec0/stock", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const allStock = await kv.getByPrefix('stock:');
    return c.json({ stock: allStock });
  } catch (error) {
    console.log('Error fetching all stock:', error);
    return c.json({ error: 'Failed to fetch stock' }, 500);
  }
});

// Get stock movements/history
app.get("/make-server-5ec3cec0/stock/movements", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const movements = await kv.getByPrefix('movement:');
    return c.json({ movements });
  } catch (error) {
    console.log('Error fetching movements:', error);
    return c.json({ error: 'Failed to fetch movements' }, 500);
  }
});

// ========== ORDER MANAGEMENT ROUTES ==========

// Create order (all authenticated users)
app.post("/make-server-5ec3cec0/orders", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orderData = await c.req.json();
    const orderId = crypto.randomUUID();

    const order = {
      id: orderId,
      userId: user.id,
      status: 'submitted',
      deliveryPreference: orderData.deliveryPreference || 'delivery',
      deliveryLocation: orderData.deliveryLocation || '',
      neededBy: orderData.neededBy || '',
      department: orderData.department || '',
      costCenter: orderData.costCenter || '',
      notes: orderData.notes || '',
      submittedAt: new Date().toISOString(),
      approvedAt: null,
      fulfilledAt: null,
      items: orderData.items || [],
    };

    await kv.set(`order:${orderId}`, order);

    // Reserve stock for each item
    for (const item of order.items) {
      const stockKey = `stock:${item.itemId}:${item.locationId || 'main'}`;
      const stock = await kv.get(stockKey);
      if (stock) {
        const updatedStock = {
          ...stock,
          reserved: stock.reserved + item.quantity,
          available: stock.available - item.quantity,
        };
        await kv.set(stockKey, updatedStock);
      }
    }

    // Create notification for fulfillment team
    await createNotification('fulfillment-team', 'new_order', `New order ${orderId} submitted by ${user.email}`);
    await createAuditLog('order', orderId, 'create', user.id, null, order);

    return c.json({ success: true, order });
  } catch (error) {
    console.log('Error creating order:', error);
    return c.json({ error: 'Failed to create order' }, 500);
  }
});

// Get orders
app.get("/make-server-5ec3cec0/orders", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    const allOrders = await kv.getByPrefix('order:');

    let orders = allOrders;

    // Requestors see only their own orders
    if (userProfile && userProfile.role === 'requestor') {
      orders = allOrders.filter((order: any) => order.userId === user.id);
    }

    // Filter by status if provided
    const statusParam = c.req.query('status');
    if (statusParam) {
      orders = orders.filter((order: any) => order.status === statusParam);
    }

    return c.json({ orders });
  } catch (error) {
    console.log('Error fetching orders:', error);
    return c.json({ error: 'Failed to fetch orders' }, 500);
  }
});

// Get single order
app.get("/make-server-5ec3cec0/orders/:id", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orderId = c.req.param('id');
    const order = await kv.get(`order:${orderId}`);

    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const userProfile = await getUserWithRole(user.id);
    // Requestors can only see their own orders
    if (userProfile && userProfile.role === 'requestor' && order.userId !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    return c.json({ order });
  } catch (error) {
    console.log('Error fetching order:', error);
    return c.json({ error: 'Failed to fetch order' }, 500);
  }
});

// Update order status (fulfillment/admin/approver)
app.put("/make-server-5ec3cec0/orders/:id/status", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment', 'approver'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const orderId = c.req.param('id');
    const { status, notes } = await c.req.json();

    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const updatedOrder = {
      ...order,
      status,
      notes: notes || order.notes,
      ...(status === 'approved' && { approvedAt: new Date().toISOString() }),
      ...(status === 'fulfilled' && { fulfilledAt: new Date().toISOString() }),
    };

    await kv.set(`order:${orderId}`, updatedOrder);
    await createAuditLog('order', orderId, 'status_change', user.id, order, updatedOrder);

    // Create notification for requestor
    await createNotification(order.userId, 'order_status', `Your order ${orderId} status changed to ${status}`);

    return c.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.log('Error updating order status:', error);
    return c.json({ error: 'Failed to update order status' }, 500);
  }
});

// Fulfill order (fulfillment/admin only)
app.post("/make-server-5ec3cec0/orders/:id/fulfill", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const orderId = c.req.param('id');
    const fulfillmentData = await c.req.json();

    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Update stock quantities
    for (const item of fulfillmentData.items) {
      const stockKey = `stock:${item.itemId}:${item.locationId || 'main'}`;
      const stock = await kv.get(stockKey);
      
      if (stock) {
        const fulfilledQty = item.quantityFulfilled || 0;
        const reservedQty = item.quantityRequested || 0;
        
        const updatedStock = {
          ...stock,
          onHand: stock.onHand - fulfilledQty,
          reserved: stock.reserved - reservedQty,
          available: stock.available - fulfilledQty + reservedQty,
        };
        
        await kv.set(stockKey, updatedStock);

        // Record movement
        const movementId = crypto.randomUUID();
        await kv.set(`movement:${movementId}`, {
          id: movementId,
          itemId: item.itemId,
          locationId: item.locationId || 'main',
          type: 'fulfill',
          quantity: -fulfilledQty,
          reason: `Order ${orderId} fulfillment`,
          userId: user.id,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const updatedOrder = {
      ...order,
      status: 'fulfilled',
      fulfilledAt: new Date().toISOString(),
      fulfilledBy: user.id,
      fulfillmentNotes: fulfillmentData.notes || '',
      items: fulfillmentData.items,
    };

    await kv.set(`order:${orderId}`, updatedOrder);
    await createAuditLog('order', orderId, 'fulfill', user.id, order, updatedOrder);
    await createNotification(order.userId, 'order_fulfilled', `Your order ${orderId} has been fulfilled`);

    return c.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.log('Error fulfilling order:', error);
    return c.json({ error: 'Failed to fulfill order' }, 500);
  }
});

// ========== CATEGORIES & LOCATIONS ==========

// Get categories
app.get("/make-server-5ec3cec0/categories", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const categories = await kv.getByPrefix('category:');
    return c.json({ categories });
  } catch (error) {
    console.log('Error fetching categories:', error);
    return c.json({ error: 'Failed to fetch categories' }, 500);
  }
});

// Create category (admin only)
app.post("/make-server-5ec3cec0/categories", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const { name, description } = await c.req.json();
    const categoryId = crypto.randomUUID();

    const category = {
      id: categoryId,
      name,
      description: description || '',
      createdAt: new Date().toISOString(),
    };

    await kv.set(`category:${categoryId}`, category);
    return c.json({ success: true, category });
  } catch (error) {
    console.log('Error creating category:', error);
    return c.json({ error: 'Failed to create category' }, 500);
  }
});

// Update category (admin only)
app.put("/make-server-5ec3cec0/categories/:id", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const categoryId = c.req.param('id');
    const existingCategory = await kv.get(`category:${categoryId}`);

    if (!existingCategory) {
      return c.json({ error: 'Category not found' }, 404);
    }

    const { name, description } = await c.req.json();
    const updatedCategory = {
      ...existingCategory,
      name,
      description: description || '',
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`category:${categoryId}`, updatedCategory);
    await createAuditLog('category', categoryId, 'update', user.id, existingCategory, updatedCategory);

    return c.json({ success: true, category: updatedCategory });
  } catch (error) {
    console.log('Error updating category:', error);
    return c.json({ error: 'Failed to update category' }, 500);
  }
});

// Get locations
app.get("/make-server-5ec3cec0/locations", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const locations = await kv.getByPrefix('location:');
    return c.json({ locations });
  } catch (error) {
    console.log('Error fetching locations:', error);
    return c.json({ error: 'Failed to fetch locations' }, 500);
  }
});

// Create location (admin only)
app.post("/make-server-5ec3cec0/locations", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const { name, type, description } = await c.req.json();
    const locationId = crypto.randomUUID();

    const location = {
      id: locationId,
      name,
      type: type || 'storeroom',
      description: description || '',
      createdAt: new Date().toISOString(),
    };

    await kv.set(`location:${locationId}`, location);
    return c.json({ success: true, location });
  } catch (error) {
    console.log('Error creating location:', error);
    return c.json({ error: 'Failed to create location' }, 500);
  }
});

// Update location (admin only)
app.put("/make-server-5ec3cec0/locations/:id", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const locationId = c.req.param('id');
    const existingLocation = await kv.get(`location:${locationId}`);

    if (!existingLocation) {
      return c.json({ error: 'Location not found' }, 404);
    }

    const { name, type, description } = await c.req.json();
    const updatedLocation = {
      ...existingLocation,
      name,
      type: type || existingLocation.type,
      description: description || '',
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`location:${locationId}`, updatedLocation);
    await createAuditLog('location', locationId, 'update', user.id, existingLocation, updatedLocation);

    return c.json({ success: true, location: updatedLocation });
  } catch (error) {
    console.log('Error updating location:', error);
    return c.json({ error: 'Failed to update location' }, 500);
  }
});

// ========== REPORTING & NOTIFICATIONS ==========

// Get low stock report
app.get("/make-server-5ec3cec0/reports/low-stock", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const allStock = await kv.getByPrefix('stock:');
    const allItems = await kv.getByPrefix('item:');

    const lowStockItems = [];

    for (const stock of allStock) {
      const item = allItems.find((i: any) => i.id === stock.itemId);
      if (item && stock.available <= item.reorderThreshold) {
        lowStockItems.push({
          ...item,
          stock,
        });
      }
    }

    return c.json({ lowStockItems });
  } catch (error) {
    console.log('Error generating low stock report:', error);
    return c.json({ error: 'Failed to generate report' }, 500);
  }
});

// Get audit log
app.get("/make-server-5ec3cec0/audit-log", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const auditLogs = await kv.getByPrefix('audit:');
    return c.json({ auditLogs });
  } catch (error) {
    console.log('Error fetching audit log:', error);
    return c.json({ error: 'Failed to fetch audit log' }, 500);
  }
});

// Get notifications for user
app.get("/make-server-5ec3cec0/notifications", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      console.log('Notifications request - Authorization failed: No valid user from token');
      return c.json({ error: 'Unauthorized - Invalid or missing access token' }, 401);
    }

    console.log('Fetching notifications for user:', user.id);
    
    // Get user profile to check role
    const userProfile = await getUserWithRole(user.id);
    const userId = user.id;
    
    const allNotifications = await kv.getByPrefix('notification:');
    console.log(`Total notifications in system: ${allNotifications.length}`);
    
    const userNotifications = allNotifications.filter((n: any) => {
      // Show notifications for this user or for fulfillment team (if user is admin/fulfillment)
      if (n.userId === userId) {
        return true;
      }
      if (n.userId === 'fulfillment-team' && userProfile && ['admin', 'fulfillment'].includes(userProfile.role)) {
        return true;
      }
      return false;
    });

    console.log(`Found ${userNotifications.length} notifications for user ${userId}`);
    return c.json({ notifications: userNotifications });
  } catch (error) {
    console.log('Error fetching notifications:', error);
    return c.json({ error: 'Failed to fetch notifications', details: String(error) }, 500);
  }
});

// Mark notification as read
app.put("/make-server-5ec3cec0/notifications/:id/read", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const notificationId = c.req.param('id');
    const notification = await kv.get(`notification:${notificationId}`);

    if (!notification) {
      return c.json({ error: 'Notification not found' }, 404);
    }

    const updated = { ...notification, read: true };
    await kv.set(`notification:${notificationId}`, updated);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error marking notification as read:', error);
    return c.json({ error: 'Failed to update notification' }, 500);
  }
});

// Get all users (admin only)
app.get("/make-server-5ec3cec0/users", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const users = await kv.getByPrefix('user:');
    return c.json({ users });
  } catch (error) {
    console.log('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Create user (admin only)
app.post("/make-server-5ec3cec0/users", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const { name, email, role, department } = await c.req.json();

    if (!name || !email || !role) {
      return c.json({ error: 'Name, email, and role are required' }, 400);
    }

    // Valid roles: admin, fulfillment, requestor, approver
    const validRoles = ['admin', 'fulfillment', 'requestor', 'approver'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Invalid role. Must be one of: admin, fulfillment, requestor, approver' }, 400);
    }

    // Check if user already exists
    const existingUsers = await kv.getByPrefix('user:');
    const emailExists = existingUsers.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      return c.json({ error: 'User with this email already exists' }, 400);
    }

    const userId = crypto.randomUUID();
    const newUser = {
      id: userId,
      name,
      email,
      role,
      department: department || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`user:${userId}`, newUser);
    await createAuditLog('user', userId, 'create', user.id, null, newUser);

    return c.json({ success: true, user: newUser });
  } catch (error) {
    console.log('Error creating user:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Update user (admin only)
app.put("/make-server-5ec3cec0/users/:id", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const userId = c.req.param('id');
    const existingUser = await kv.get(`user:${userId}`);

    if (!existingUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    const updates = await c.req.json();

    // Validate role if provided
    if (updates.role) {
      const validRoles = ['admin', 'fulfillment', 'requestor', 'approver'];
      if (!validRoles.includes(updates.role)) {
        return c.json({ error: 'Invalid role. Must be one of: admin, fulfillment, requestor, approver' }, 400);
      }
    }

    // Check email uniqueness if email is being updated
    if (updates.email && updates.email !== existingUser.email) {
      const allUsers = await kv.getByPrefix('user:');
      const emailExists = allUsers.some((u: any) => u.id !== userId && u.email.toLowerCase() === updates.email.toLowerCase());
      if (emailExists) {
        return c.json({ error: 'User with this email already exists' }, 400);
      }
    }

    const updatedUser = {
      ...existingUser,
      ...updates,
      id: userId, // prevent ID change
      createdAt: existingUser.createdAt, // preserve creation date
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`user:${userId}`, updatedUser);
    await createAuditLog('user', userId, 'update', user.id, existingUser, updatedUser);

    return c.json({ success: true, user: updatedUser });
  } catch (error) {
    console.log('Error updating user:', error);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// ========== RETURN/EXCHANGE MANAGEMENT ROUTES ==========

// Get all return requests
app.get("/make-server-5ec3cec0/returns", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    const allReturns = await kv.getByPrefix('return:');
    
    // Filter returns based on role
    let returns = [];
    if (userProfile && ['admin', 'fulfillment'].includes(userProfile.role)) {
      // Admin and fulfillment can see all returns
      returns = allReturns;
    } else if (userProfile && userProfile.role === 'approver') {
      // Approvers can see all returns for approval
      returns = allReturns;
    } else {
      // Requestors can only see their own returns
      returns = allReturns.filter((r: any) => r.requestorId === user.id);
    }

    return c.json({ returns });
  } catch (error) {
    console.log('Error fetching returns:', error);
    return c.json({ error: 'Failed to fetch returns' }, 500);
  }
});

// Create return request
app.post("/make-server-5ec3cec0/returns", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    const { orderId, itemId, quantity, returnType, reason } = await c.req.json();

    if (!orderId || !itemId || !quantity || !returnType || !reason) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate return type
    const validReturnTypes = ['defective', 'wrong-item', 'overage', 'unused', 'other'];
    if (!validReturnTypes.includes(returnType)) {
      return c.json({ error: 'Invalid return type' }, 400);
    }

    // Get order details
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Verify order is fulfilled
    if (order.status !== 'fulfilled') {
      return c.json({ error: 'Can only return items from fulfilled orders' }, 400);
    }

    // Get item details
    const item = await kv.get(`item:${itemId}`);
    if (!item) {
      return c.json({ error: 'Item not found' }, 404);
    }

    // Verify item was in the order
    const orderItem = order.items?.find((i: any) => i.id === itemId);
    if (!orderItem) {
      return c.json({ error: 'Item not found in order' }, 404);
    }

    // Verify quantity
    if (quantity > orderItem.quantity) {
      return c.json({ error: 'Return quantity exceeds ordered quantity' }, 400);
    }

    const returnId = crypto.randomUUID();
    const returnNumber = `RTN-${Date.now().toString().slice(-8)}`;

    const returnRequest = {
      id: returnId,
      returnNumber,
      requestorId: user.id,
      requestorName: userProfile?.name || 'Unknown',
      orderId,
      orderNumber: order.orderNumber,
      itemId,
      itemName: item.name,
      quantity: parseInt(quantity),
      reason,
      returnType,
      status: 'submitted',
      createdAt: new Date().toISOString(),
    };

    await kv.set(`return:${returnId}`, returnRequest);

    // Create notification for approvers/admins
    await createNotification(
      'approval-team',
      'Return Request',
      `${userProfile?.name || 'User'} submitted a return request for ${item.name} (${returnNumber})`,
      `/returns`
    );

    await createAuditLog('return', returnId, 'create', user.id, null, returnRequest);

    return c.json({ success: true, return: returnRequest });
  } catch (error) {
    console.log('Error creating return request:', error);
    return c.json({ error: 'Failed to create return request' }, 500);
  }
});

// Process return (approve/reject)
app.post("/make-server-5ec3cec0/returns/:id/process", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'approver'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: admin or approver only' }, 403);
    }

    const returnId = c.req.param('id');
    const returnRequest = await kv.get(`return:${returnId}`);

    if (!returnRequest) {
      return c.json({ error: 'Return request not found' }, 404);
    }

    if (returnRequest.status !== 'submitted') {
      return c.json({ error: 'Return request has already been processed' }, 400);
    }

    const { approved, resolutionType, approverNotes } = await c.req.json();

    // Validate resolution type if approved
    if (approved) {
      const validResolutionTypes = ['restock', 'exchange', 'credit'];
      if (!resolutionType || !validResolutionTypes.includes(resolutionType)) {
        return c.json({ error: 'Valid resolution type required for approval' }, 400);
      }
    }

    const updatedReturn = {
      ...returnRequest,
      status: approved ? 'approved' : 'rejected',
      resolutionType: approved ? resolutionType : undefined,
      approverNotes: approverNotes || undefined,
      approverId: user.id,
      approverName: userProfile.name,
      resolvedAt: new Date().toISOString(),
    };

    await kv.set(`return:${returnId}`, updatedReturn);

    // Notify requestor
    await createNotification(
      returnRequest.requestorId,
      'Return Update',
      `Your return request ${returnRequest.returnNumber} has been ${approved ? 'approved' : 'rejected'}`,
      `/returns`
    );

    // If approved, notify fulfillment team
    if (approved) {
      await createNotification(
        'fulfillment-team',
        'Return Approved',
        `Return ${returnRequest.returnNumber} approved and ready for processing`,
        `/returns`
      );
    }

    await createAuditLog('return', returnId, 'update', user.id, returnRequest, updatedReturn);

    return c.json({ success: true, return: updatedReturn });
  } catch (error) {
    console.log('Error processing return:', error);
    return c.json({ error: 'Failed to process return' }, 500);
  }
});

// Complete return and restock
app.post("/make-server-5ec3cec0/returns/:id/complete", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: fulfillment or admin only' }, 403);
    }

    const returnId = c.req.param('id');
    const returnRequest = await kv.get(`return:${returnId}`);

    if (!returnRequest) {
      return c.json({ error: 'Return request not found' }, 404);
    }

    if (returnRequest.status !== 'approved') {
      return c.json({ error: 'Can only complete approved returns' }, 400);
    }

    // If resolution type is 'restock', update inventory
    if (returnRequest.resolutionType === 'restock') {
      const stockRecords = await kv.getByPrefix('stock:');
      const itemStock = stockRecords.filter((s: any) => s.itemId === returnRequest.itemId);

      if (itemStock.length > 0) {
        // Add to first available stock record
        const stock = itemStock[0];
        const updatedStock = {
          ...stock,
          onHand: stock.onHand + returnRequest.quantity,
          available: stock.available + returnRequest.quantity,
          updatedAt: new Date().toISOString(),
        };
        await kv.set(`stock:${stock.id}`, updatedStock);

        await createAuditLog('stock', stock.id, 'update', user.id, stock, updatedStock);
      }
    }

    const completedReturn = {
      ...returnRequest,
      status: 'completed',
      completedById: user.id,
      completedByName: userProfile.name,
      completedAt: new Date().toISOString(),
    };

    await kv.set(`return:${returnId}`, completedReturn);

    // Notify requestor
    await createNotification(
      returnRequest.requestorId,
      'Return Completed',
      `Your return ${returnRequest.returnNumber} has been processed`,
      `/returns`
    );

    await createAuditLog('return', returnId, 'complete', user.id, returnRequest, completedReturn);

    return c.json({ success: true, return: completedReturn });
  } catch (error) {
    console.log('Error completing return:', error);
    return c.json({ error: 'Failed to complete return' }, 500);
  }
});

// ========== BIN MANAGEMENT ROUTES ==========

// Create bin (admin only)
app.post("/make-server-5ec3cec0/bins", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const { locationId, aisle, shelf, bin, description } = await c.req.json();
    const binId = crypto.randomUUID();

    const binData = {
      id: binId,
      locationId,
      aisle: aisle || '',
      shelf: shelf || '',
      bin: bin || '',
      description: description || '',
      active: true,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`bin:${binId}`, binData);
    return c.json({ success: true, bin: binData });
  } catch (error) {
    console.log('Error creating bin:', error);
    return c.json({ error: 'Failed to create bin' }, 500);
  }
});

// Get bins by location
app.get("/make-server-5ec3cec0/bins", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const locationId = c.req.query('locationId');
    const allBins = await kv.getByPrefix('bin:');
    
    let bins = allBins;
    if (locationId) {
      bins = allBins.filter((b: any) => b.locationId === locationId);
    }

    return c.json({ bins });
  } catch (error) {
    console.log('Error fetching bins:', error);
    return c.json({ error: 'Failed to fetch bins' }, 500);
  }
});

// ========== LOT/EXPIRATION TRACKING ROUTES ==========

// Add lot to stock (receiving)
app.post("/make-server-5ec3cec0/lots", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const { itemId, lotNumber, expirationDate, quantity, locationId, binId, receivedFrom } = await c.req.json();
    const lotId = crypto.randomUUID();

    const lot = {
      id: lotId,
      itemId,
      lotNumber,
      expirationDate: expirationDate || null,
      quantity,
      quantityRemaining: quantity,
      locationId,
      binId: binId || null,
      receivedFrom: receivedFrom || '',
      receivedDate: new Date().toISOString(),
      status: 'active', // active, expired, recalled
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`lot:${lotId}`, lot);
    
    // Update stock
    const stockKey = `stock:${itemId}:${locationId}`;
    const existingStock = await kv.get(stockKey) || { 
      itemId, 
      locationId, 
      onHand: 0, 
      reserved: 0, 
      available: 0 
    };

    const updatedStock = {
      ...existingStock,
      onHand: existingStock.onHand + quantity,
      available: existingStock.onHand + quantity - existingStock.reserved,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(stockKey, updatedStock);
    await createAuditLog('lot', lotId, 'create', user.id, null, lot);

    return c.json({ success: true, lot });
  } catch (error) {
    console.log('Error creating lot:', error);
    return c.json({ error: 'Failed to create lot' }, 500);
  }
});

// Get lots for an item (with FEFO sorting)
app.get("/make-server-5ec3cec0/lots/:itemId", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const itemId = c.req.param('itemId');
    const allLots = await kv.getByPrefix('lot:');
    const itemLots = allLots.filter((l: any) => l.itemId === itemId && l.quantityRemaining > 0);

    // Sort by expiration date (FEFO - First Expire First Out)
    itemLots.sort((a: any, b: any) => {
      if (!a.expirationDate) return 1;
      if (!b.expirationDate) return -1;
      return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
    });

    return c.json({ lots: itemLots });
  } catch (error) {
    console.log('Error fetching lots:', error);
    return c.json({ error: 'Failed to fetch lots' }, 500);
  }
});

// Get expiring items report
app.get("/make-server-5ec3cec0/reports/expiring", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const daysParam = c.req.query('days') || '30';
    const days = parseInt(daysParam);
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + days);

    const allLots = await kv.getByPrefix('lot:');
    const expiringLots = allLots.filter((l: any) => {
      if (!l.expirationDate || l.quantityRemaining <= 0) return false;
      const expDate = new Date(l.expirationDate);
      return expDate <= thresholdDate && expDate >= new Date();
    });

    // Get item details for each lot
    const enrichedLots = [];
    for (const lot of expiringLots) {
      const item = await kv.get(`item:${lot.itemId}`);
      enrichedLots.push({ ...lot, item });
    }

    return c.json({ expiringLots: enrichedLots });
  } catch (error) {
    console.log('Error generating expiring items report:', error);
    return c.json({ error: 'Failed to generate report' }, 500);
  }
});

// Lot recall
app.post("/make-server-5ec3cec0/lots/:lotId/recall", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const lotId = c.req.param('lotId');
    const { reason } = await c.req.json();

    const lot = await kv.get(`lot:${lotId}`);
    if (!lot) {
      return c.json({ error: 'Lot not found' }, 404);
    }

    const updatedLot = {
      ...lot,
      status: 'recalled',
      recallReason: reason,
      recalledAt: new Date().toISOString(),
      recalledBy: user.id,
    };

    await kv.set(`lot:${lotId}`, updatedLot);
    await createAuditLog('lot', lotId, 'recall', user.id, lot, updatedLot);
    await createNotification('fulfillment-team', 'lot_recall', `Lot ${lot.lotNumber} has been recalled: ${reason}`);

    return c.json({ success: true, lot: updatedLot });
  } catch (error) {
    console.log('Error recalling lot:', error);
    return c.json({ error: 'Failed to recall lot' }, 500);
  }
});

// ========== PURCHASE ORDER ROUTES ==========

// Create PO
app.post("/make-server-5ec3cec0/purchase-orders", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const poData = await c.req.json();
    const poId = crypto.randomUUID();

    const po = {
      id: poId,
      poNumber: poData.poNumber || `PO-${Date.now()}`,
      vendor: poData.vendor,
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: poData.expectedDeliveryDate || null,
      status: 'pending', // pending, partially_received, received, cancelled
      items: poData.items || [],
      totalCost: poData.totalCost || 0,
      notes: poData.notes || '',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`po:${poId}`, po);
    await createAuditLog('purchase_order', poId, 'create', user.id, null, po);

    return c.json({ success: true, purchaseOrder: po });
  } catch (error) {
    console.log('Error creating purchase order:', error);
    return c.json({ error: 'Failed to create purchase order' }, 500);
  }
});

// Get all POs
app.get("/make-server-5ec3cec0/purchase-orders", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const purchaseOrders = await kv.getByPrefix('po:');
    const statusParam = c.req.query('status');
    
    let filteredPOs = purchaseOrders;
    if (statusParam) {
      filteredPOs = purchaseOrders.filter((po: any) => po.status === statusParam);
    }

    return c.json({ purchaseOrders: filteredPOs });
  } catch (error) {
    console.log('Error fetching purchase orders:', error);
    return c.json({ error: 'Failed to fetch purchase orders' }, 500);
  }
});

// Get single PO
app.get("/make-server-5ec3cec0/purchase-orders/:id", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const poId = c.req.param('id');
    const po = await kv.get(`po:${poId}`);

    if (!po) {
      return c.json({ error: 'Purchase order not found' }, 404);
    }

    return c.json({ purchaseOrder: po });
  } catch (error) {
    console.log('Error fetching purchase order:', error);
    return c.json({ error: 'Failed to fetch purchase order' }, 500);
  }
});

// Receive PO (full or partial)
app.post("/make-server-5ec3cec0/purchase-orders/:id/receive", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const poId = c.req.param('id');
    const receiptData = await c.req.json();

    const po = await kv.get(`po:${poId}`);
    if (!po) {
      return c.json({ error: 'Purchase order not found' }, 404);
    }

    // Create receiving record
    const receiptId = crypto.randomUUID();
    const receipt = {
      id: receiptId,
      poId,
      receivedDate: new Date().toISOString(),
      receivedBy: user.id,
      items: receiptData.items || [],
      notes: receiptData.notes || '',
      damagedItems: receiptData.damagedItems || [],
    };

    await kv.set(`receipt:${receiptId}`, receipt);

    // Update stock and create lots if needed
    for (const item of receiptData.items) {
      if (item.quantityReceived > 0 && item.condition === 'good') {
        const itemData = await kv.get(`item:${item.itemId}`);
        
        if (itemData?.isLotTracked || itemData?.isExpirationTracked) {
          // Create lot
          const lotId = crypto.randomUUID();
          await kv.set(`lot:${lotId}`, {
            id: lotId,
            itemId: item.itemId,
            lotNumber: item.lotNumber || `LOT-${Date.now()}`,
            expirationDate: item.expirationDate || null,
            quantity: item.quantityReceived,
            quantityRemaining: item.quantityReceived,
            locationId: receiptData.locationId || 'main',
            binId: item.binId || null,
            receivedFrom: po.vendor,
            receivedDate: new Date().toISOString(),
            status: 'active',
            createdAt: new Date().toISOString(),
            createdBy: user.id,
          });
        }

        // Update stock
        const stockKey = `stock:${item.itemId}:${receiptData.locationId || 'main'}`;
        const stock = await kv.get(stockKey) || {
          itemId: item.itemId,
          locationId: receiptData.locationId || 'main',
          onHand: 0,
          reserved: 0,
          available: 0,
        };

        const updatedStock = {
          ...stock,
          onHand: stock.onHand + item.quantityReceived,
          available: stock.onHand + item.quantityReceived - stock.reserved,
          updatedAt: new Date().toISOString(),
        };

        await kv.set(stockKey, updatedStock);

        // Record movement
        const movementId = crypto.randomUUID();
        await kv.set(`movement:${movementId}`, {
          id: movementId,
          itemId: item.itemId,
          locationId: receiptData.locationId || 'main',
          type: 'receive',
          quantity: item.quantityReceived,
          reason: `PO ${po.poNumber} receipt`,
          userId: user.id,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update PO status
    const totalOrdered = po.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const totalReceived = receiptData.items.reduce((sum: number, item: any) => sum + (item.quantityReceived || 0), 0);
    
    let newStatus = po.status;
    if (totalReceived >= totalOrdered) {
      newStatus = 'received';
    } else if (totalReceived > 0) {
      newStatus = 'partially_received';
    }

    const updatedPO = {
      ...po,
      status: newStatus,
      receivedDate: newStatus === 'received' ? new Date().toISOString() : po.receivedDate,
    };

    await kv.set(`po:${poId}`, updatedPO);
    await createAuditLog('purchase_order', poId, 'receive', user.id, po, updatedPO);

    return c.json({ success: true, receipt, purchaseOrder: updatedPO });
  } catch (error) {
    console.log('Error receiving purchase order:', error);
    return c.json({ error: 'Failed to receive purchase order' }, 500);
  }
});

// ========== STOCK TRANSFER ROUTES ==========

// Create stock transfer
app.post("/make-server-5ec3cec0/transfers", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const transferData = await c.req.json();
    const transferId = crypto.randomUUID();

    const transfer = {
      id: transferId,
      itemId: transferData.itemId,
      fromLocationId: transferData.fromLocationId,
      toLocationId: transferData.toLocationId,
      quantity: transferData.quantity,
      lotId: transferData.lotId || null,
      reason: transferData.reason || '',
      status: 'pending',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`transfer:${transferId}`, transfer);
    await createAuditLog('transfer', transferId, 'create', user.id, null, transfer);

    return c.json({ success: true, transfer });
  } catch (error) {
    console.log('Error creating transfer:', error);
    return c.json({ error: 'Failed to create transfer' }, 500);
  }
});

// Complete transfer
app.post("/make-server-5ec3cec0/transfers/:id/complete", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const transferId = c.req.param('id');
    const transfer = await kv.get(`transfer:${transferId}`);

    if (!transfer) {
      return c.json({ error: 'Transfer not found' }, 404);
    }

    // Reduce stock from source location
    const fromStockKey = `stock:${transfer.itemId}:${transfer.fromLocationId}`;
    const fromStock = await kv.get(fromStockKey);

    if (!fromStock || fromStock.available < transfer.quantity) {
      return c.json({ error: 'Insufficient stock at source location' }, 400);
    }

    const updatedFromStock = {
      ...fromStock,
      onHand: fromStock.onHand - transfer.quantity,
      available: fromStock.available - transfer.quantity,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(fromStockKey, updatedFromStock);

    // Add stock to destination location
    const toStockKey = `stock:${transfer.itemId}:${transfer.toLocationId}`;
    const toStock = await kv.get(toStockKey) || {
      itemId: transfer.itemId,
      locationId: transfer.toLocationId,
      onHand: 0,
      reserved: 0,
      available: 0,
    };

    const updatedToStock = {
      ...toStock,
      onHand: toStock.onHand + transfer.quantity,
      available: toStock.available + transfer.quantity,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(toStockKey, updatedToStock);

    // Update lot location if applicable
    if (transfer.lotId) {
      const lot = await kv.get(`lot:${transfer.lotId}`);
      if (lot) {
        await kv.set(`lot:${transfer.lotId}`, {
          ...lot,
          locationId: transfer.toLocationId,
        });
      }
    }

    // Record movements
    const movementOutId = crypto.randomUUID();
    await kv.set(`movement:${movementOutId}`, {
      id: movementOutId,
      itemId: transfer.itemId,
      locationId: transfer.fromLocationId,
      type: 'transfer_out',
      quantity: -transfer.quantity,
      reason: `Transfer to ${transfer.toLocationId}: ${transfer.reason}`,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    const movementInId = crypto.randomUUID();
    await kv.set(`movement:${movementInId}`, {
      id: movementInId,
      itemId: transfer.itemId,
      locationId: transfer.toLocationId,
      type: 'transfer_in',
      quantity: transfer.quantity,
      reason: `Transfer from ${transfer.fromLocationId}: ${transfer.reason}`,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    // Update transfer status
    const updatedTransfer = {
      ...transfer,
      status: 'completed',
      completedBy: user.id,
      completedAt: new Date().toISOString(),
    };

    await kv.set(`transfer:${transferId}`, updatedTransfer);
    await createAuditLog('transfer', transferId, 'complete', user.id, transfer, updatedTransfer);

    return c.json({ success: true, transfer: updatedTransfer });
  } catch (error) {
    console.log('Error completing transfer:', error);
    return c.json({ error: 'Failed to complete transfer' }, 500);
  }
});

// Get transfers
app.get("/make-server-5ec3cec0/transfers", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const transfers = await kv.getByPrefix('transfer:');
    return c.json({ transfers });
  } catch (error) {
    console.log('Error fetching transfers:', error);
    return c.json({ error: 'Failed to fetch transfers' }, 500);
  }
});

// ========== CYCLE COUNT ROUTES ==========

// Create cycle count
app.post("/make-server-5ec3cec0/cycle-counts", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const countData = await c.req.json();
    const countId = crypto.randomUUID();

    const cycleCount = {
      id: countId,
      name: countData.name || `Cycle Count ${new Date().toLocaleDateString()}`,
      type: countData.type || 'cycle',
      locationId: countData.locationId || null,
      items: countData.items || [],
      status: 'pending',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`count:${countId}`, cycleCount);
    await createAuditLog('cycle_count', countId, 'create', user.id, null, cycleCount);

    return c.json({ success: true, cycleCount });
  } catch (error) {
    console.log('Error creating cycle count:', error);
    return c.json({ error: 'Failed to create cycle count' }, 500);
  }
});

// Submit cycle count results
app.post("/make-server-5ec3cec0/cycle-counts/:id/submit", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const countId = c.req.param('id');
    const { counts } = await c.req.json();

    const cycleCount = await kv.get(`count:${countId}`);
    if (!cycleCount) {
      return c.json({ error: 'Cycle count not found' }, 404);
    }

    // Calculate variances
    const variances = [];
    for (const count of counts) {
      const stockKey = `stock:${count.itemId}:${count.locationId}`;
      const stock = await kv.get(stockKey);
      const expectedQty = stock?.onHand || 0;
      const variance = count.countedQty - expectedQty;

      variances.push({
        itemId: count.itemId,
        locationId: count.locationId,
        expectedQty,
        countedQty: count.countedQty,
        variance,
        notes: count.notes || '',
      });
    }

    const updatedCycleCount = {
      ...cycleCount,
      status: 'completed',
      counts,
      variances,
      countedBy: user.id,
      countedAt: new Date().toISOString(),
    };

    await kv.set(`count:${countId}`, updatedCycleCount);
    await createAuditLog('cycle_count', countId, 'submit', user.id, cycleCount, updatedCycleCount);

    return c.json({ success: true, cycleCount: updatedCycleCount, variances });
  } catch (error) {
    console.log('Error submitting cycle count:', error);
    return c.json({ error: 'Failed to submit cycle count' }, 500);
  }
});

// Approve cycle count and adjust stock
app.post("/make-server-5ec3cec0/cycle-counts/:id/approve", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const countId = c.req.param('id');
    const cycleCount = await kv.get(`count:${countId}`);

    if (!cycleCount) {
      return c.json({ error: 'Cycle count not found' }, 404);
    }

    if (cycleCount.status !== 'completed') {
      return c.json({ error: 'Cycle count must be completed before approval' }, 400);
    }

    // Apply adjustments
    for (const variance of cycleCount.variances) {
      if (variance.variance !== 0) {
        const stockKey = `stock:${variance.itemId}:${variance.locationId}`;
        const stock = await kv.get(stockKey);

        if (stock) {
          const updatedStock = {
            ...stock,
            onHand: variance.countedQty,
            available: variance.countedQty - stock.reserved,
            updatedAt: new Date().toISOString(),
          };

          await kv.set(stockKey, updatedStock);

          // Record movement
          const movementId = crypto.randomUUID();
          await kv.set(`movement:${movementId}`, {
            id: movementId,
            itemId: variance.itemId,
            locationId: variance.locationId,
            type: 'cycle_count_adjustment',
            quantity: variance.variance,
            reason: `Cycle count ${countId} adjustment`,
            userId: user.id,
            timestamp: new Date().toISOString(),
          });

          await createAuditLog('stock', stockKey, 'cycle_count_adjust', user.id, stock, updatedStock);
        }
      }
    }

    const updatedCycleCount = {
      ...cycleCount,
      status: 'approved',
      approvedBy: user.id,
      approvedAt: new Date().toISOString(),
    };

    await kv.set(`count:${countId}`, updatedCycleCount);
    await createAuditLog('cycle_count', countId, 'approve', user.id, cycleCount, updatedCycleCount);

    return c.json({ success: true, cycleCount: updatedCycleCount });
  } catch (error) {
    console.log('Error approving cycle count:', error);
    return c.json({ error: 'Failed to approve cycle count' }, 500);
  }
});

// Get cycle counts
app.get("/make-server-5ec3cec0/cycle-counts", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const cycleCounts = await kv.getByPrefix('count:');
    return c.json({ cycleCounts });
  } catch (error) {
    console.log('Error fetching cycle counts:', error);
    return c.json({ error: 'Failed to fetch cycle counts' }, 500);
  }
});

// ========== APPROVAL WORKFLOW ROUTES ==========

// Get pending approvals for approver
app.get("/make-server-5ec3cec0/approvals/pending", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'approver'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    // Get orders that require approval
    const allOrders = await kv.getByPrefix('order:');
    const pendingApprovals = [];

    for (const order of allOrders) {
      if (order.status !== 'submitted') continue;
      
      // Check if any items require approval
      let requiresApproval = false;
      for (const orderItem of order.items || []) {
        const item = await kv.get(`item:${orderItem.itemId}`);
        if (item?.requiresApproval || item?.isControlled) {
          requiresApproval = true;
          break;
        }
      }

      if (requiresApproval) {
        pendingApprovals.push(order);
      }
    }

    return c.json({ pendingApprovals });
  } catch (error) {
    console.log('Error fetching pending approvals:', error);
    return c.json({ error: 'Failed to fetch pending approvals' }, 500);
  }
});

// Approve/reject order
app.post("/make-server-5ec3cec0/orders/:id/approve", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'approver'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const orderId = c.req.param('id');
    const { decision, comments } = await c.req.json();

    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const updatedOrder = {
      ...order,
      status: decision,
      approvalDecision: decision,
      approvalComments: comments || '',
      approvedBy: user.id,
      approvedAt: new Date().toISOString(),
    };

    await kv.set(`order:${orderId}`, updatedOrder);
    await createAuditLog('order', orderId, 'approval_decision', user.id, order, updatedOrder);

    // Notify requestor
    await createNotification(
      order.userId,
      'order_approval',
      `Your order ${orderId} has been ${decision}: ${comments || ''}`
    );

    // If rejected, release reserved stock
    if (decision === 'rejected') {
      for (const item of order.items) {
        const stockKey = `stock:${item.itemId}:${item.locationId || 'main'}`;
        const stock = await kv.get(stockKey);
        if (stock) {
          const updatedStock = {
            ...stock,
            reserved: stock.reserved - item.quantity,
            available: stock.available + item.quantity,
          };
          await kv.set(stockKey, updatedStock);
        }
      }
    }

    return c.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.log('Error processing approval:', error);
    return c.json({ error: 'Failed to process approval' }, 500);
  }
});

// ========== VENDOR MANAGEMENT ROUTES ==========

// Create vendor
app.post("/make-server-5ec3cec0/vendors", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const vendorData = await c.req.json();
    const vendorId = crypto.randomUUID();

    const vendor = {
      id: vendorId,
      name: vendorData.name,
      contactName: vendorData.contactName || '',
      email: vendorData.email || '',
      phone: vendorData.phone || '',
      address: vendorData.address || '',
      notes: vendorData.notes || '',
      active: true,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`vendor:${vendorId}`, vendor);
    return c.json({ success: true, vendor });
  } catch (error) {
    console.log('Error creating vendor:', error);
    return c.json({ error: 'Failed to create vendor' }, 500);
  }
});

// Get vendors
app.get("/make-server-5ec3cec0/vendors", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const vendors = await kv.getByPrefix('vendor:');
    return c.json({ vendors });
  } catch (error) {
    console.log('Error fetching vendors:', error);
    return c.json({ error: 'Failed to fetch vendors' }, 500);
  }
});

// ========== ADDITIONAL REPORTS ==========

// Get usage report by department
app.get("/make-server-5ec3cec0/reports/usage-by-department", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const allOrders = await kv.getByPrefix('order:');
    const fulfilledOrders = allOrders.filter((o: any) => {
      if (o.status !== 'fulfilled') return false;
      if (startDate && o.fulfilledAt < startDate) return false;
      if (endDate && o.fulfilledAt > endDate) return false;
      return true;
    });

    // Group by department
    const usageByDept: any = {};
    for (const order of fulfilledOrders) {
      const dept = order.department || 'Unspecified';
      if (!usageByDept[dept]) {
        usageByDept[dept] = { department: dept, itemCount: 0, orders: 0, totalCost: 0 };
      }
      usageByDept[dept].orders++;
      usageByDept[dept].itemCount += order.items?.length || 0;
      
      // Calculate cost
      for (const item of order.items || []) {
        const itemData = await kv.get(`item:${item.itemId}`);
        usageByDept[dept].totalCost += (itemData?.cost || 0) * item.quantity;
      }
    }

    return c.json({ usageByDepartment: Object.values(usageByDept) });
  } catch (error) {
    console.log('Error generating usage report:', error);
    return c.json({ error: 'Failed to generate report' }, 500);
  }
});

// Get inventory turnover report
app.get("/make-server-5ec3cec0/reports/turnover", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const allItems = await kv.getByPrefix('item:');
    const allMovements = await kv.getByPrefix('movement:');
    const allStock = await kv.getByPrefix('stock:');

    const turnoverData = [];

    for (const item of allItems) {
      const itemMovements = allMovements.filter((m: any) => 
        m.itemId === item.id && (m.type === 'fulfill' || m.type === 'issue')
      );

      const totalFulfilled = itemMovements.reduce((sum: number, m: any) => 
        sum + Math.abs(m.quantity), 0
      );

      const itemStock = allStock.filter((s: any) => s.itemId === item.id);
      const avgStock = itemStock.reduce((sum: number, s: any) => sum + s.onHand, 0) / (itemStock.length || 1);

      const turnoverRate = avgStock > 0 ? totalFulfilled / avgStock : 0;

      turnoverData.push({
        itemId: item.id,
        itemName: item.name,
        avgStock,
        totalFulfilled,
        turnoverRate: turnoverRate.toFixed(2),
      });
    }

    // Sort by turnover rate
    turnoverData.sort((a, b) => parseFloat(b.turnoverRate) - parseFloat(a.turnoverRate));

    return c.json({ turnoverData });
  } catch (error) {
    console.log('Error generating turnover report:', error);
    return c.json({ error: 'Failed to generate report' }, 500);
  }
});

// Get fulfillment SLA report
app.get("/make-server-5ec3cec0/reports/fulfillment-sla", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const allOrders = await kv.getByPrefix('order:');
    const fulfilledOrders = allOrders.filter((o: any) => {
      if (!o.fulfilledAt) return false;
      if (startDate && o.submittedAt < startDate) return false;
      if (endDate && o.submittedAt > endDate) return false;
      return true;
    });

    const slaData = fulfilledOrders.map((order: any) => {
      const submittedTime = new Date(order.submittedAt).getTime();
      const fulfilledTime = new Date(order.fulfilledAt).getTime();
      const hoursToFulfill = (fulfilledTime - submittedTime) / (1000 * 60 * 60);

      return {
        orderId: order.id,
        submittedAt: order.submittedAt,
        fulfilledAt: order.fulfilledAt,
        hoursToFulfill: hoursToFulfill.toFixed(2),
        metSLA: hoursToFulfill <= 24, // Example: 24-hour SLA
      };
    });

    const avgFulfillmentTime = slaData.reduce((sum, o) => sum + parseFloat(o.hoursToFulfill), 0) / (slaData.length || 1);
    const metSLACount = slaData.filter(o => o.metSLA).length;
    const slaComplianceRate = (metSLACount / (slaData.length || 1)) * 100;

    return c.json({
      slaData,
      summary: {
        totalOrders: slaData.length,
        avgFulfillmentTime: avgFulfillmentTime.toFixed(2),
        metSLACount,
        slaComplianceRate: slaComplianceRate.toFixed(2),
      },
    });
  } catch (error) {
    console.log('Error generating SLA report:', error);
    return c.json({ error: 'Failed to generate report' }, 500);
  }
});

Deno.serve(app.fetch);