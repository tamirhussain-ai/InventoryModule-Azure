import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as emailService from "./email-service.tsx";

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
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
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
  console.log('Authorization header present:', !!authHeader);
  console.log('X-Session-Token header present:', !!sessionTokenHeader);
  
  let token: string | undefined;
  
  if (sessionTokenHeader) {
    console.log('Using X-Session-Token header');
    token = sessionTokenHeader;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log('Using Authorization header');
    token = authHeader.split(' ')[1];
  } else {
    console.log('verifyAuth: No valid auth token found');
    console.log('Auth header value:', authHeader?.substring(0, 50));
    return null;
  }
  
  // Clean token just in case
  token = token?.trim();
  
  console.log('Token extracted, length:', token?.length);
  console.log('Token preview (first 20 chars):', token?.substring(0, 20));
  
  if (!token) {
    console.log('verifyAuth: Token is empty after extraction');
    return null;
  }
  
  // Don't try to verify if it's the anon key
  if (token === supabaseAnonKey) {
    console.log('verifyAuth: Request using anon key, not a user token');
    return null;
  }
  
  try {
    // Look up session in KV store
    console.log('Looking up session with key:', `session:${token.substring(0, 20)}...`);
    const session = await kv.get(`session:${token}`);
    console.log('Session lookup result:', session ? 'FOUND' : 'NOT FOUND');
    
    if (!session) {
      console.log('verifyAuth: No session found for token in KV store');
      return null;
    }
    
    console.log('Session data:', { 
      userId: session.userId, 
      email: session.email, 
      createdAt: session.createdAt,
      createdAtType: typeof session.createdAt 
    });
    
    // Check if session is expired (24 hours)
    const now = Date.now();
    const sessionCreatedTime = new Date(session.createdAt).getTime();
    const sessionAge = now - sessionCreatedTime;
    const maxAge = 24 * 60 * 60 * 1000;
    
    console.log('Current time (ms):', now);
    console.log('Session created time (ms):', sessionCreatedTime);
    console.log('Session age (ms):', sessionAge);
    console.log('Session age (hours):', (sessionAge / 1000 / 60 / 60).toFixed(2));
    console.log('Max age (ms):', maxAge);
    console.log('Max age (hours):', (maxAge / 1000 / 60 / 60).toFixed(2));
    console.log('Is expired?:', sessionAge > maxAge);
    
    if (sessionAge > maxAge) {
      console.log('verifyAuth: Session expired - deleting from KV store');
      await kv.del(`session:${token}`);
      return null;
    }
    
    console.log('verifyAuth: Successfully verified user:', session.userId);
    return { id: session.userId, email: session.email };
  } catch (error) {
    console.log('verifyAuth: Exception during verification:', error);
    console.log('Error type:', typeof error, 'Error message:', error?.message);
    console.log('Error stack:', error?.stack);
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
async function createNotification(userId: string, type: string, message: string, link?: string) {
  const notifId = crypto.randomUUID();
  await kv.set(`notification:${notifId}`, {
    id: notifId,
    userId,
    type,
    message,
    link: link || null,
    read: false,
    createdAt: new Date().toISOString(),
  });
  return notifId;
}

// Initialize Supabase Storage for product images
const productImageBucketName = 'make-5ec3cec0-product-images';
(async () => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === productImageBucketName);
    if (!bucketExists) {
      console.log('Creating product images bucket...');
      await supabase.storage.createBucket(productImageBucketName, {
        public: false,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      });
      console.log('Product images bucket created successfully');
    } else {
      console.log('Product images bucket already exists');
    }
  } catch (error) {
    console.error('Error initializing storage bucket:', error);
  }
})();

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
    
    // Generate a custom session token (not the Supabase JWT)
    // Use crypto.randomUUID() to create a unique session identifier
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    console.log('=== SESSION STORAGE ===');
    console.log('Generated custom token length:', token.length);
    console.log('Token first 30 chars:', token.substring(0, 30));
    console.log('Token last 30 chars:', token.substring(token.length - 30));
    
    const sessionKey = `session:${token}`;
    const sessionData = {
      userId: data.user.id,
      email: data.user.email,
      createdAt: new Date().toISOString(),
      supabaseAccessToken: data.session.access_token, // Store the Supabase JWT separately if needed
    };
    
    console.log('Session key to store:', sessionKey.substring(0, 40) + '...');
    console.log('Session data:', sessionData);
    
    try {
      await kv.set(sessionKey, sessionData);
      console.log('✅ Session stored successfully');
      
      // Verify it was stored by reading it back immediately
      const verification = await kv.get(sessionKey);
      if (verification) {
        console.log('✅ Session verified in KV store immediately after storage');
        console.log('Verification data:', { userId: verification.userId, email: verification.email });
      } else {
        console.error('❌ CRITICAL ERROR: Session was stored but could NOT be read back immediately!');
        console.error('This indicates a KV store problem');
        return c.json({ error: 'Session storage verification failed' }, 500);
      }
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
      
      // Check if user is inactive
      if (userProfile && userProfile.active === false) {
        console.log('User account is inactive:', userProfile.email);
        return c.json({ error: 'Your account has been deactivated. Please contact an administrator.' }, 403);
      }
    } catch (kvError) {
      console.error('KV GET ERROR:', kvError);
      console.error('KV error message:', kvError?.message);
      // Continue even if user profile fetch fails
      userProfile = null;
    }

    // Check password expiry policy
    let passwordExpired = false;
    try {
      const securitySettings = await kv.get('settings:security');
      const expiryDays = securitySettings?.passwordExpiryDays;
      const expiryEnabled = securitySettings?.passwordExpiryEnabled === true;
      if (expiryEnabled && expiryDays && expiryDays > 0 && userProfile) {
        const lastChanged = userProfile.passwordLastChanged || userProfile.createdAt;
        if (lastChanged) {
          const daysSinceChange = (Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceChange > expiryDays) {
            passwordExpired = true;
            console.log(`Password expired for user ${userProfile.email}: ${Math.floor(daysSinceChange)} days since last change (limit: ${expiryDays} days)`);
          }
        }
      }
    } catch (expiryError) {
      console.log('Error checking password expiry:', expiryError);
    }

    console.log('Returning successful sign in response');
    console.log('Response will include token of length:', token.length);
    console.log('=== END SIGNIN REQUEST ===');
    
    return c.json({ 
      success: true, 
      accessToken: token,
      user: userProfile || { id: data.user.id, email: data.user.email },
      passwordExpired,
      debug: {
        tokenLength: token.length,
        sessionStored: true,
        sessionVerified: true,
      }
    });
  } catch (error) {
    console.log('Unexpected error during sign in:', error);
    console.log('Error type:', typeof error);
    console.log('Error message:', error?.message);
    console.log('Error stack:', error?.stack);
    return c.json({ error: 'Sign in failed: ' + (error?.message || 'Unknown error') }, 500);
  }
});

// Forgot password
app.post("/make-server-5ec3cec0/auth/forgot-password", async (c) => {
  // NOTE: The frontend now calls Supabase Auth directly for password reset
  // (supabase.auth.resetPasswordForEmail) which avoids the Resend domain restriction.
  // This server route is kept as a no-op success so any legacy callers don't break.
  console.log('[forgot-password] Server route hit (frontend should call Supabase directly)');
  return c.json({ success: true, message: 'If an account exists with this email, you will receive a password reset link.' });
});

// Reset password with token
app.post("/make-server-5ec3cec0/auth/reset-password", async (c) => {
  try {
    const { token, password } = await c.req.json();
    
    if (!token || !password) {
      return c.json({ error: 'Token and password are required' }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    console.log('Attempting to reset password with token');
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Update user password
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.log('Password update error:', error);
      return c.json({ error: error.message }, 400);
    }

    console.log('Password updated successfully');
    return c.json({ success: true, message: 'Password reset successfully. You can now sign in with your new password.' });
  } catch (error) {
    console.log('Unexpected error during password reset:', error);
    return c.json({ error: 'Password reset failed' }, 500);
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
      itemNumber: itemData.itemNumber || itemData.internalCode || '', // Support both field names
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

    // Map itemNumber to internalCode for frontend compatibility
    const itemsWithInternalCode = filteredItems.map((item: any) => ({
      ...item,
      internalCode: item.itemNumber || '',
    }));

    return c.json({ items: itemsWithInternalCode });
  } catch (error) {
    console.log('Error fetching items:', error);
    return c.json({ error: 'Failed to fetch items' }, 500);
  }
});

// Delete all items (admin only) - MUST be before /items/:id to avoid route conflict
app.delete("/make-server-5ec3cec0/items/delete-all", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    // Get all items
    const allItems = await kv.getByPrefix('item:');
    
    // Delete each item and its related stock data
    const deletePromises: Promise<void>[] = [];
    
    for (const item of allItems) {
      // Delete the item
      deletePromises.push(kv.del(`item:${item.id}`));
      
      // Delete all stock records for this item
      const stockRecords = await kv.getByPrefix(`stock:${item.id}:`);
      for (const stock of stockRecords) {
        deletePromises.push(kv.del(`stock:${item.id}:${stock.locationId}:${stock.lotNumber || 'no-lot'}`));
      }
    }
    
    await Promise.all(deletePromises);
    
    console.log(`Deleted ${allItems.length} items and their stock data`);
    return c.json({ success: true, deletedCount: allItems.length, message: `Deleted ${allItems.length} items` });
  } catch (error) {
    console.log('Error deleting all items:', error);
    return c.json({ error: 'Failed to delete items' }, 500);
  }
});

// Purge inactive items (admin only) - one-time cleanup
app.delete("/make-server-5ec3cec0/items/purge-inactive", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    // Get all items
    const allItems = await kv.getByPrefix('item:');
    
    // Filter for inactive items (active === false or active is undefined/missing)
    const inactiveItems = allItems.filter((item: any) => item.active !== true);
    
    console.log(`Found ${inactiveItems.length} inactive items out of ${allItems.length} total items`);
    
    // Delete each inactive item and its related stock data
    const deletePromises: Promise<void>[] = [];
    
    for (const item of inactiveItems) {
      // Delete the item
      deletePromises.push(kv.del(`item:${item.id}`));
      
      // Delete all stock records for this item
      const stockRecords = await kv.getByPrefix(`stock:${item.id}:`);
      for (const stock of stockRecords) {
        deletePromises.push(kv.del(`stock:${item.id}:${stock.locationId}:${stock.lotNumber || 'no-lot'}`));
      }
    }
    
    await Promise.all(deletePromises);
    
    console.log(`Purged ${inactiveItems.length} inactive items and their stock data`);
    return c.json({ 
      success: true, 
      deletedCount: inactiveItems.length, 
      totalItems: allItems.length,
      message: `Purged ${inactiveItems.length} inactive items` 
    });
  } catch (error) {
    console.log('Error purging inactive items:', error);
    return c.json({ error: 'Failed to purge inactive items' }, 500);
  }
});

// Bulk upload items from CSV (admin only)
app.post("/make-server-5ec3cec0/items/bulk-upload", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const { items } = await c.req.json();
    
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'Invalid input: items array required' }, 400);
    }

    // Get all existing items to check for duplicates
    const allExistingItems = await kv.getByPrefix('item:');
    console.log(`Found ${allExistingItems.length} existing items in database`);

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: number; name: string; error: string }>,
    };

    // Process each item
    for (let i = 0; i < items.length; i++) {
      const itemData = items[i];
      
      try {
        // Log the item data for debugging
        console.log(`Processing item ${i + 1}:`, {
          name: itemData.name,
          sku: itemData.sku,
          itemNumber: itemData.itemNumber,
        });
        
        // Validate required fields
        if (!itemData.name || itemData.name.trim() === '') {
          results.failed++;
          results.errors.push({
            row: i + 2, // +2 because row 1 is header, and array is 0-indexed
            name: itemData.name || '(no name)',
            error: 'Item name is required',
          });
          continue;
        }

        // Check for existing item by name, SKU, or internal code
        const trimmedName = itemData.name.trim().toLowerCase();
        const trimmedSku = itemData.sku?.trim().toLowerCase() || '';
        const trimmedItemNumber = itemData.itemNumber?.trim().toLowerCase() || '';
        
        let existingItem = allExistingItems.find((item: any) => {
          const matchByName = item.name?.toLowerCase() === trimmedName;
          const matchBySku = trimmedSku && item.sku?.toLowerCase() === trimmedSku;
          const matchByItemNumber = trimmedItemNumber && item.itemNumber?.toLowerCase() === trimmedItemNumber;
          return matchByName || matchBySku || matchByItemNumber;
        });

        // Parse numeric values, defaulting to 0 or appropriate defaults if empty/invalid
        const parseNumber = (val: any, defaultVal: number = 0): number => {
          if (val === null || val === undefined || val === '') return defaultVal;
          const parsed = parseFloat(val);
          return isNaN(parsed) ? defaultVal : parsed;
        };

        if (existingItem) {
          // Item exists - update only missing/empty fields
          console.log(`Item already exists: "${existingItem.name}" - updating missing fields only`);
          
          const updatedItem = {
            ...existingItem,
            // Only update if field is empty/missing in existing item
            description: existingItem.description || itemData.description?.trim() || '',
            sku: existingItem.sku || itemData.sku?.trim() || '',
            itemNumber: existingItem.itemNumber || itemData.itemNumber?.trim() || '',
            category: existingItem.category || itemData.category?.trim() || 'uncategorized',
            unitOfMeasure: existingItem.unitOfMeasure || itemData.unitOfMeasure?.trim() || 'each',
            packSize: existingItem.packSize || parseNumber(itemData.packSize, 1),
            vendor: existingItem.vendor || itemData.vendor?.trim() || '',
            cost: existingItem.cost || parseNumber(itemData.cost, 0),
            reorderThreshold: existingItem.reorderThreshold || parseNumber(itemData.reorderThreshold, 10),
            maxPar: existingItem.maxPar || parseNumber(itemData.maxPar, 100),
            leadTimeDays: existingItem.leadTimeDays || parseNumber(itemData.leadTimeDays, 7),
            productImageUrl: existingItem.productImageUrl || itemData.productImageUrl?.trim() || '',
            updatedAt: new Date().toISOString(),
            updatedBy: user.id,
          };

          await kv.set(`item:${existingItem.id}`, updatedItem);
          await createAuditLog('item', existingItem.id, 'update', user.id, existingItem, updatedItem);
          results.updated++;
          
        } else {
          // Item doesn't exist - create new
          console.log(`Creating new item: "${itemData.name.trim()}"`);
          
          const itemId = crypto.randomUUID();
          
          const item = {
            id: itemId,
            name: itemData.name.trim(),
            description: itemData.description?.trim() || '',
            sku: itemData.sku?.trim() || '',
            itemNumber: itemData.itemNumber?.trim() || '',
            category: itemData.category?.trim() || 'uncategorized',
            
            // Unit and packaging
            unitOfMeasure: itemData.unitOfMeasure?.trim() || 'each',
            packSize: parseNumber(itemData.packSize, 1),
            
            // Vendor and purchasing
            manufacturer: '',
            vendor: itemData.vendor?.trim() || '',
            vendorItemNumber: '',
            contractNumber: '',
            cost: parseNumber(itemData.cost, 0),
            
            // Reorder settings
            reorderThreshold: parseNumber(itemData.reorderThreshold, 10),
            maxPar: parseNumber(itemData.maxPar, 100),
            leadTimeDays: parseNumber(itemData.leadTimeDays, 7),
            
            // Item flags
            active: true,
            isStocked: true,
            isControlled: false,
            isHazmat: false,
            isTempSensitive: false,
            isExpirationTracked: false,
            isLotTracked: false,
            
            // Image URLs
            productImageUrl: itemData.productImageUrl?.trim() || '',
            productImageUrl2: '',
            
            // Timestamps
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: user.id,
            updatedBy: user.id,
          };

          console.log(`Saving item with itemNumber: "${item.itemNumber}"`);
          await kv.set(`item:${itemId}`, item);
          await createAuditLog('item', itemId, 'create', user.id, null, item);
          results.created++;
        }
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          name: itemData.name || '(no name)',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`Bulk upload completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`);
    
    return c.json({ 
      success: true, 
      results,
      message: `Created ${results.created} items, updated ${results.updated} items${results.failed > 0 ? `, ${results.failed} failed` : ''}`,
    });
    
  } catch (error) {
    console.log('Error in bulk upload:', error);
    return c.json({ error: 'Failed to process bulk upload', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
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

    // Map itemNumber to internalCode for frontend compatibility
    const itemWithInternalCode = {
      ...item,
      internalCode: item.itemNumber || '',
    };

    return c.json({ item: itemWithInternalCode });
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
    
    // Map internalCode to itemNumber if present (for frontend compatibility)
    if (updates.internalCode !== undefined && updates.itemNumber === undefined) {
      updates.itemNumber = updates.internalCode;
      delete updates.internalCode;
    }
    
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

// Upload product image (admin/fulfillment only)
app.post("/make-server-5ec3cec0/upload-product-image", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' }, 400);
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: 'File too large. Maximum size is 5MB.' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(productImageBucketName)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return c.json({ error: 'Failed to upload image', details: uploadError.message }, 500);
    }

    // Generate signed URL (valid for 10 years)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(productImageBucketName)
      .createSignedUrl(filePath, 315360000); // 10 years in seconds

    if (urlError) {
      console.error('Signed URL error:', urlError);
      return c.json({ error: 'Failed to generate image URL', details: urlError.message }, 500);
    }

    console.log('Image uploaded successfully:', filePath);

    return c.json({ 
      success: true, 
      imageUrl: signedUrlData.signedUrl,
      filePath 
    });
  } catch (error) {
    console.error('Error uploading product image:', error);
    return c.json({ error: 'Failed to upload product image', details: error.message }, 500);
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

    const { itemId, locationId, binId, quantity, reason, type } = await c.req.json();

    if (!itemId || !locationId || quantity === undefined || !reason || !type) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Build stock key - include binId if provided
    const stockKey = binId 
      ? `stock:${itemId}:${locationId}:${binId}`
      : `stock:${itemId}:${locationId}`;
    
    const existingStock = await kv.get(stockKey) || { 
      itemId, 
      locationId,
      binId: binId || null,
      binCode: null,
      onHand: 0, 
      reserved: 0, 
      available: 0 
    };

    // If binId provided, get bin details
    let binCode = existingStock.binCode;
    if (binId && !binCode) {
      const bin = await kv.get(`bin:${binId}`);
      binCode = bin?.binCode || null;
    }

    const newOnHand = existingStock.onHand + quantity;
    const newAvailable = newOnHand - existingStock.reserved;

    if (newOnHand < 0) {
      return c.json({ error: 'Cannot reduce stock below zero' }, 400);
    }

    const updatedStock = {
      ...existingStock,
      binId: binId || existingStock.binId || null,
      binCode: binCode,
      onHand: newOnHand,
      available: newAvailable,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(stockKey, updatedStock);

    // Update bin occupancy if binId provided
    if (binId) {
      const bin = await kv.get(`bin:${binId}`);
      if (bin) {
        const updatedBin = {
          ...bin,
          currentOccupancy: Math.max(0, (bin.currentOccupancy || 0) + quantity),
          updatedAt: new Date().toISOString(),
        };
        await kv.set(`bin:${binId}`, updatedBin);
      }
    }

    // Record stock movement
    const movementId = crypto.randomUUID();
    await kv.set(`movement:${movementId}`, {
      id: movementId,
      itemId,
      locationId,
      binId: binId || null,
      binCode: binCode,
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

    // Check workflow settings to determine initial status
    const workflowSettings = await kv.get('settings:workflow');
    const approvalRequired = workflowSettings?.approvalRequired !== false; // Default to true

    // Check if user is a requestor and validate category restrictions
    const userProfile = await getUserWithRole(user.id);
    if (userProfile?.role === 'requestor') {
      const categorySettings = await kv.get('settings:requestor_categories');
      
      if (categorySettings?.enabled && categorySettings.allowedCategories?.length > 0) {
        // Get all items to check their categories
        const allItems = await kv.getByPrefix('item:');
        const allCategories = await kv.getByPrefix('category:');
        
        // Check each item in the order
        for (const orderItem of orderData.items || []) {
          const item = allItems.find((i: any) => i.id === orderItem.itemId);
          if (item) {
            // Find the category ID for this item's category name
            const itemCategory = allCategories.find((cat: any) => cat.name === item.category);
            
            if (itemCategory && !categorySettings.allowedCategories.includes(itemCategory.id)) {
              console.log(`Requestor attempted to order from restricted category: ${item.category}`);
              return c.json({ 
                error: `You don't have permission to order items from the "${item.category}" category. Please contact an administrator.` 
              }, 403);
            }
          }
        }
      }
    }

    // Set initial status based on workflow settings
    const initialStatus = approvalRequired ? 'submitted' : 'approved';
    
    const order = {
      id: orderId,
      userId: user.id,
      status: initialStatus,
      deliveryPreference: orderData.deliveryPreference || 'delivery',
      deliveryLocation: orderData.deliveryLocation || '',
      neededBy: orderData.neededBy || '',
      department: orderData.department || '',
      costCenter: orderData.costCenter || '',
      notes: orderData.notes || '',
      submittedAt: new Date().toISOString(),
      approvedAt: approvalRequired ? null : new Date().toISOString(),
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
    const notificationMessage = approvalRequired 
      ? `New order ${orderId} submitted by ${user.email}` 
      : `New order ${orderId} auto-approved and ready for fulfillment`;
    await createNotification('fulfillment-team', 'new_order', notificationMessage, `/orders/${orderId}`);
    await createAuditLog('order', orderId, 'create', user.id, null, order);

    // Send email to approvers or fulfillment based on workflow settings
    try {
      console.log('=== Attempting to send order submission emails ===');
      console.log(`Approval required: ${approvalRequired}`);
      
      const allUsers = await kv.getByPrefix('user:');
      const requestorData = await getUserWithRole(user.id);
      const emailData = {
        orderId,
        orderDate: order.submittedAt,
        requestorName: requestorData?.name || user.email,
        requestorEmail: user.email,
        items: order.items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
        })),
      };

      // Always send confirmation email to requestor
      console.log('Sending confirmation email to requestor...');
      await emailService.sendOrderEmail('submitted_confirmation', emailData, user.id);

      if (approvalRequired) {
        // Send to approvers
        const approvers = allUsers.filter((u: any) => u.role === 'approver' || u.role === 'admin');
        console.log(`Found ${approvers.length} approvers:`, approvers.map((a: any) => `${a.name} (${a.email})`).join(', '));
        
        const emailPromises = approvers.map((approver: any) =>
          emailService.sendOrderEmail('submitted', emailData, approver.id)
        );
        const results = await Promise.allSettled(emailPromises);
      
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
        const failCount = results.length - successCount;
        console.log(`Email results: ${successCount} sent successfully, ${failCount} failed`);
      } else {
        // Send auto-approval notification to fulfillment
        const fulfillmentUsers = allUsers.filter((u: any) => u.role === 'fulfillment' || u.role === 'admin');
        console.log(`Sending auto-approval notifications to ${fulfillmentUsers.length} fulfillment users`);
        
        const emailPromises = fulfillmentUsers.map((user: any) =>
          emailService.sendOrderEmail('submitted_direct', emailData, user.id)
        );
        const results = await Promise.allSettled(emailPromises);
        
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
        const failCount = results.length - successCount;
        console.log(`Email results: ${successCount} sent successfully, ${failCount} failed`);
      }
      console.log('=== Order submission email process complete ===');
    } catch (emailError) {
      console.error('Error sending order submitted emails:', emailError);
      // Don't fail the request if emails fail
    }

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

// TEMPORARY: Delete all orders (admin only)
app.delete("/make-server-5ec3cec0/orders/delete-all", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    // Get all orders
    const allOrders = await kv.getByPrefix('order:');
    
    // Delete each order
    const deletePromises = allOrders.map((order: any) => {
      return kv.del(`order:${order.id}`);
    });
    
    await Promise.all(deletePromises);
    
    console.log(`Deleted ${allOrders.length} orders`);
    return c.json({ success: true, deletedCount: allOrders.length, message: `Deleted ${allOrders.length} orders` });
  } catch (error) {
    console.log('Error deleting all orders:', error);
    return c.json({ error: 'Failed to delete orders' }, 500);
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
    await createNotification(order.userId, 'order_status', `Your order ${orderId} status changed to ${status}`, `/orders/${orderId}`);

    // Send email to requestor when status changes to approved or denied
    if (status === 'approved' || status === 'denied') {
      try {
        const requestorData = await getUserWithRole(order.userId);
        const approverData = await getUserWithRole(user.id);
        
        const emailData = {
          orderId,
          orderDate: order.submittedAt,
          requestorName: requestorData?.name || 'User',
          requestorEmail: requestorData?.email || '',
          approverName: approverData?.name || user.email,
          items: order.items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
          })),
          notes: notes || '',
        };

        await emailService.sendOrderEmail(
          status === 'approved' ? 'approved' : 'denied',
          emailData,
          order.userId
        );
      } catch (emailError) {
        console.error(`Error sending order ${status} email:`, emailError);
        // Don't fail the request if email fails
      }
    }

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
    await createNotification(order.userId, 'order_fulfilled', `Your order ${orderId} has been fulfilled`, `/orders/${orderId}`);

    // Send email to requestor
    try {
      const requestorData = await getUserWithRole(order.userId);
      
      const emailData = {
        orderId,
        orderDate: order.submittedAt,
        requestorName: requestorData?.name || 'User',
        requestorEmail: requestorData?.email || '',
        items: updatedOrder.items.map((item: any) => ({
          name: item.name,
          quantity: item.quantityFulfilled || item.quantity,
        })),
        notes: fulfillmentData.notes || '',
      };

      await emailService.sendOrderEmail('fulfilled', emailData, order.userId);
    } catch (emailError) {
      console.error('Error sending order fulfilled email:', emailError);
      // Don't fail the request if email fails
    }

    return c.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.log('Error fulfilling order:', error);
    return c.json({ error: 'Failed to fulfill order' }, 500);
  }
});

// Update fulfilled order (admin only)
app.put("/make-server-5ec3cec0/orders/:id/update-fulfilled", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const orderId = c.req.param('id');
    const updateData = await c.req.json();

    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    if (order.status !== 'fulfilled') {
      return c.json({ error: 'Can only edit fulfilled orders' }, 400);
    }

    // Reverse previous stock adjustments and apply new ones
    const oldItems = order.items || [];
    const newItems = updateData.items || [];

    // First, reverse the old fulfillment
    for (const oldItem of oldItems) {
      const stockKey = `stock:${oldItem.itemId}:${oldItem.locationId || 'main'}`;
      const stock = await kv.get(stockKey);
      
      if (stock) {
        const oldFulfilledQty = oldItem.quantityFulfilled || oldItem.quantity || 0;
        
        // Add back the previously fulfilled quantity
        const updatedStock = {
          ...stock,
          onHand: stock.onHand + oldFulfilledQty,
          available: stock.available + oldFulfilledQty,
        };
        
        await kv.set(stockKey, updatedStock);

        // Record reversal movement
        const reversalMovementId = crypto.randomUUID();
        await kv.set(`movement:${reversalMovementId}`, {
          id: reversalMovementId,
          itemId: oldItem.itemId,
          locationId: oldItem.locationId || 'main',
          type: 'adjustment',
          quantity: oldFulfilledQty,
          reason: `Order ${orderId} fulfillment reversal (admin edit)`,
          userId: user.id,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Now apply the new fulfillment quantities
    for (const newItem of newItems) {
      const stockKey = `stock:${newItem.itemId}:${newItem.locationId || 'main'}`;
      const stock = await kv.get(stockKey);
      
      if (stock) {
        const newFulfilledQty = newItem.quantityFulfilled || 0;
        
        // Deduct the new fulfilled quantity
        const updatedStock = {
          ...stock,
          onHand: stock.onHand - newFulfilledQty,
          available: stock.available - newFulfilledQty,
        };
        
        await kv.set(stockKey, updatedStock);

        // Record new movement
        const movementId = crypto.randomUUID();
        await kv.set(`movement:${movementId}`, {
          id: movementId,
          itemId: newItem.itemId,
          locationId: newItem.locationId || 'main',
          type: 'fulfill',
          quantity: -newFulfilledQty,
          reason: `Order ${orderId} fulfillment (admin edited)`,
          userId: user.id,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update the order
    const updatedOrder = {
      ...order,
      items: newItems,
      fulfillmentNotes: updateData.notes !== undefined ? updateData.notes : order.fulfillmentNotes,
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: user.id,
    };

    await kv.set(`order:${orderId}`, updatedOrder);
    await createAuditLog('order', orderId, 'update_fulfilled', user.id, order, updatedOrder);
    await createNotification(order.userId, 'order_updated', `Your fulfilled order ${orderId} has been modified by an admin`, `/orders/${orderId}`);

    return c.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.log('Error updating fulfilled order:', error);
    return c.json({ error: 'Failed to update fulfilled order' }, 500);
  }
});

// Cancel order (admin or requestor for non-fulfilled orders)
app.post("/make-server-5ec3cec0/orders/:id/cancel", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile) {
      return c.json({ error: 'User profile not found' }, 404);
    }

    const orderId = c.req.param('id');
    const { reason } = await c.req.json();

    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Check permissions
    const isAdmin = userProfile.role === 'admin';
    const isOrderOwner = order.userId === user.id;
    const canCancel = isAdmin || (isOrderOwner && ['submitted', 'approved', 'picking'].includes(order.status));

    if (!canCancel) {
      return c.json({ error: 'Forbidden: insufficient permissions to cancel this order' }, 403);
    }

    // Cannot cancel fulfilled orders
    if (order.status === 'fulfilled') {
      return c.json({ error: 'Cannot cancel a fulfilled order' }, 400);
    }

    // Cannot cancel already cancelled orders
    if (order.status === 'cancelled') {
      return c.json({ error: 'Order is already cancelled' }, 400);
    }

    // Return reserved stock back to available
    for (const item of order.items || []) {
      const stockKey = `stock:${item.itemId}:${item.locationId || 'main'}`;
      const stock = await kv.get(stockKey);
      
      if (stock) {
        const requestedQty = item.quantity || 0;
        
        // Release reserved stock back to available
        const updatedStock = {
          ...stock,
          reserved: Math.max(0, stock.reserved - requestedQty),
          available: stock.available + requestedQty,
        };
        
        await kv.set(stockKey, updatedStock);

        // Record movement
        const movementId = crypto.randomUUID();
        await kv.set(`movement:${movementId}`, {
          id: movementId,
          itemId: item.itemId,
          locationId: item.locationId || 'main',
          type: 'adjustment',
          quantity: 0, // No change to onHand
          reason: `Order ${orderId} cancelled - released reserved stock`,
          userId: user.id,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const updatedOrder = {
      ...order,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: user.id,
      cancellationReason: reason || 'No reason provided',
    };

    await kv.set(`order:${orderId}`, updatedOrder);
    await createAuditLog('order', orderId, 'cancel', user.id, order, updatedOrder);
    await createNotification(order.userId, 'order_cancelled', `Order ${orderId} has been cancelled`, `/orders/${orderId}`);

    // Send email to requestor if cancelled by admin
    if (isAdmin && order.userId !== user.id) {
      try {
        const requestorData = await getUserWithRole(order.userId);
        
        const emailData = {
          orderId,
          orderDate: order.submittedAt,
          requestorName: requestorData?.name || 'User',
          requestorEmail: requestorData?.email || '',
          cancelledBy: userProfile.name || 'Administrator',
          reason: reason || 'No reason provided',
          items: order.items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
          })),
        };

        await emailService.sendOrderEmail('cancelled', emailData, order.userId);
      } catch (emailError) {
        console.error('Error sending order cancelled email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return c.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.log('Error cancelling order:', error);
    return c.json({ error: 'Failed to cancel order' }, 500);
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
      active: true,
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

    const { name, description, active } = await c.req.json();
    const updatedCategory = {
      ...existingCategory,
      name,
      description: description || '',
      active: active !== undefined ? active : existingCategory.active,
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

// Get requestor category settings (admin only)
app.get("/make-server-5ec3cec0/settings/requestor-categories", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    // Get settings from KV store
    const settings = await kv.get('settings:requestor_categories');
    
    // Default: all categories are allowed if no settings exist
    return c.json({ 
      settings: settings || { 
        allowedCategories: [],  // Empty array means all categories are allowed
        enabled: false  // When false, all categories are accessible
      } 
    });
  } catch (error) {
    console.log('Error fetching requestor category settings:', error);
    return c.json({ error: 'Failed to fetch settings' }, 500);
  }
});

// Update requestor category settings (admin only)
app.put("/make-server-5ec3cec0/settings/requestor-categories", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const { allowedCategories, enabled } = await c.req.json();
    
    const settings = {
      allowedCategories: allowedCategories || [],
      enabled: enabled || false,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };

    await kv.set('settings:requestor_categories', settings);
    
    await createAuditLog('settings', 'requestor_categories', 'update', user.id, {}, settings);

    return c.json({ success: true, settings });
  } catch (error) {
    console.log('Error updating requestor category settings:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
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
    
    // Enrich audit logs with user email and entity names
    const enrichedLogs = await Promise.all(
      auditLogs.map(async (log: any) => {
        // Get user email
        const logUser = await kv.get(`user:${log.userId}`);
        const userEmail = logUser?.email || 'Unknown User';
        
        // Get entity name based on type
        let entityName = 'Unknown';
        try {
          if (log.entityType === 'item' && log.after?.name) {
            entityName = log.after.name;
          } else if (log.entityType === 'order' && log.after?.id) {
            entityName = `Order #${log.after.id.slice(0, 8)}`;
          } else if (log.entityType === 'stock' && log.after?.itemName) {
            entityName = log.after.itemName;
          } else if (log.entityType === 'category' && log.after?.name) {
            entityName = log.after.name;
          } else if (log.entityType === 'location' && log.after?.name) {
            entityName = log.after.name;
          } else if (log.entityType === 'user' && log.after?.name) {
            entityName = log.after.name;
          } else if (log.entityType === 'settings') {
            entityName = log.entityId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
          }
        } catch (e) {
          // Keep default 'Unknown'
        }
        
        return {
          ...log,
          userEmail,
          entityName,
        };
      })
    );
    
    // Sort by timestamp descending (newest first)
    enrichedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return c.json({ auditLogs: enrichedLogs });
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

// Get badge counts for navigation
app.get("/make-server-5ec3cec0/badge-counts", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile) {
      return c.json({ error: 'User profile not found' }, 404);
    }

    const counts: any = {};

    // Get all orders
    const allOrders = await kv.getByPrefix('order:');
    
    // Role-specific counts
    if (userProfile.role === 'admin' || userProfile.role === 'fulfillment') {
      // Count orders that need fulfillment (submitted or approved)
      const needsFulfillment = allOrders.filter((order: any) => 
        order.status === 'submitted' || order.status === 'approved' || order.status === 'picking'
      );
      counts.orders = needsFulfillment.length;

      // Count returns pending resolution
      const allReturns = await kv.getByPrefix('return:');
      const pendingReturns = allReturns.filter((ret: any) => 
        ret.status === 'pending' || ret.status === 'approved'
      );
      counts.returns = pendingReturns.length;

      // Count pending purchase orders
      const allPOs = await kv.getByPrefix('po:');
      const pendingPOs = allPOs.filter((po: any) => 
        po.status === 'draft' || po.status === 'submitted'
      );
      counts.purchaseOrders = pendingPOs.length;

      // Count active cycle counts
      const allCounts = await kv.getByPrefix('count:');
      const activeCounts = allCounts.filter((count: any) => 
        count.status === 'pending' || count.status === 'in_progress'
      );
      counts.cycleCounts = activeCounts.length;

      // Count pending transfers
      const allTransfers = await kv.getByPrefix('transfer:');
      const pendingTransfers = allTransfers.filter((transfer: any) => 
        transfer.status === 'pending'
      );
      counts.transfers = pendingTransfers.length;
    } else if (userProfile.role === 'approver') {
      // Count orders awaiting approval
      const needsApproval = allOrders.filter((order: any) => 
        order.status === 'submitted'
      );
      counts.approvals = needsApproval.length;

      // Count user's own orders
      const myOrders = allOrders.filter((order: any) => 
        order.submittedBy === user.id && order.status !== 'fulfilled' && order.status !== 'denied'
      );
      counts.orders = myOrders.length;

      // Count user's returns
      const allReturns = await kv.getByPrefix('return:');
      const myReturns = allReturns.filter((ret: any) => 
        ret.createdBy === user.id && ret.status !== 'completed'
      );
      counts.returns = myReturns.length;
    } else {
      // Requestor role
      // Count user's active orders
      const myOrders = allOrders.filter((order: any) => 
        order.submittedBy === user.id && order.status !== 'fulfilled' && order.status !== 'denied'
      );
      counts.orders = myOrders.length;

      // Count user's returns
      const allReturns = await kv.getByPrefix('return:');
      const myReturns = allReturns.filter((ret: any) => 
        ret.createdBy === user.id && ret.status !== 'completed'
      );
      counts.returns = myReturns.length;
    }

    return c.json({ counts });
  } catch (error) {
    console.log('Error fetching badge counts:', error);
    return c.json({ error: 'Failed to fetch badge counts' }, 500);
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

    // Query KV directly to get both key and value so we can derive id from key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error: dbError } = await supabase
      .from('kv_store_5ec3cec0')
      .select('key, value')
      .like('key', 'user:%');

    if (dbError) {
      console.log('Error querying users from KV:', dbError);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    const users = (data || [])
      .filter((row: any) => {
        // Exclude sub-keys like "user:<id>:email-prefs" — only keep "user:<id>"
        const suffix = row.key.replace(/^user:/, '');
        return !suffix.includes(':');
      })
      .map((row: any) => {
        const val = row.value || {};
        // Derive id from the key (e.g. "user:abc-123" -> "abc-123") if missing from value
        const idFromKey = row.key.replace(/^user:/, '');
        return { ...val, id: val.id || idFromKey };
      });

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

    const { name, email, role, department, tempPassword } = await c.req.json();

    if (!name || !email || !role) {
      return c.json({ error: 'Name, email, and role are required' }, 400);
    }

    // Valid roles: admin, fulfillment, requestor, approver
    const validRoles = ['admin', 'fulfillment', 'requestor', 'approver'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Invalid role. Must be one of: admin, fulfillment, requestor, approver' }, 400);
    }

    // Check if user already exists (defensive: skip entries without email)
    const existingUsers = await kv.getByPrefix('user:');
    const emailExists = existingUsers.some((u: any) => u && u.email && u.email.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      return c.json({ error: 'User with this email already exists' }, 400);
    }

    // Use admin-provided temp password or generate a secure one
    const passwordToUse = (tempPassword && tempPassword.length >= 8)
      ? tempPassword
      : crypto.randomUUID().replace(/-/g, '').substring(0, 12) + 'Aa1!';
    
    // Create user in Supabase Auth
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: passwordToUse,
      user_metadata: { name, role, department },
      email_confirm: true,
    });

    if (authError) {
      console.log('Error creating Supabase auth user:', authError);
      return c.json({ error: 'Failed to create user account: ' + authError.message }, 400);
    }

    console.log('Supabase auth user created:', authData.user.id);

    // Store user profile in KV with Supabase user ID
    const newUser = {
      id: authData.user.id,
      name,
      email,
      role,
      department: department || '',
      active: true,
      mustResetPassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`user:${authData.user.id}`, newUser);
    await createAuditLog('user', authData.user.id, 'create', user.id, null, newUser);

    // Return temp password to admin so they can share it directly with the user
    console.log('User created successfully with mustResetPassword=true:', authData.user.id);
    return c.json({ success: true, user: newUser, tempPassword: passwordToUse });
  } catch (error) {
    console.log('Error creating user:', error);
    return c.json({ error: 'Failed to create user: ' + (error?.message || String(error)) }, 500);
  }
});

// Change password for authenticated user (uses admin API so no Supabase session required on frontend)
app.put("/make-server-5ec3cec0/auth/change-password", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { newPassword, oldPassword } = await c.req.json();

    if (!newPassword || newPassword.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    // Check if this is a forced reset (mustResetPassword=true) — skip old password check
    const userProfileForCheck = await kv.get(`user:${user.id}`);
    const isForced = userProfileForCheck?.mustResetPassword === true;

    // For voluntary changes, verify the old password first
    if (!isForced) {
      if (!oldPassword) {
        return c.json({ error: 'Current password is required to change your password' }, 400);
      }
      // Verify old password by attempting a sign-in with the anon client
      const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
      const { error: verifyError } = await supabaseAnon.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });
      if (verifyError) {
        console.log('Old password verification failed:', verifyError.message);
        return c.json({ error: 'Current password is incorrect' }, 400);
      }
    }

    // Use admin API (service role key) to update the password — no live Supabase session needed
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      console.log('Error updating password via admin API:', updateError);
      return c.json({ error: 'Failed to update password: ' + updateError.message }, 400);
    }

    // Clear mustResetPassword flag in KV and record passwordLastChanged
    const existingUser = await kv.get(`user:${user.id}`);
    if (existingUser) {
      const updatedUser = {
        ...existingUser,
        mustResetPassword: false,
        passwordLastChanged: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await kv.set(`user:${user.id}`, updatedUser);
      await createAuditLog('user', user.id, 'change_password', user.id, { mustResetPassword: existingUser.mustResetPassword }, { mustResetPassword: false });
    }

    console.log('Password changed successfully for user:', user.id);
    return c.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.log('Error changing password:', error);
    return c.json({ error: 'Failed to change password: ' + (error?.message || String(error)) }, 500);
  }
});

// Force password reset for a user (admin only) — sets mustResetPassword=true and optionally updates password
app.post("/make-server-5ec3cec0/users/:id/force-password-reset", async (c) => {
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

    const { tempPassword } = await c.req.json();

    // Use provided password or generate a secure one
    const passwordToUse = (tempPassword && tempPassword.length >= 8)
      ? tempPassword
      : crypto.randomUUID().replace(/-/g, '').substring(0, 12) + 'Aa1!';

    // Update password in Supabase Auth via admin API
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: passwordToUse,
    });

    if (updateError) {
      console.log('Error updating password via admin API for force-reset:', updateError);
      return c.json({ error: 'Failed to set temporary password: ' + updateError.message }, 400);
    }

    // Mark user as needing password reset
    const updatedUser = {
      ...existingUser,
      mustResetPassword: true,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`user:${userId}`, updatedUser);
    await createAuditLog('user', userId, 'force_password_reset', user.id, existingUser, updatedUser);

    console.log('Force password reset set for user:', userId);
    return c.json({ success: true, user: updatedUser, tempPassword: passwordToUse });
  } catch (error) {
    console.log('Error forcing password reset:', error);
    return c.json({ error: 'Failed to force password reset: ' + (error?.message || String(error)) }, 500);
  }
});

// Clear mustResetPassword flag (authenticated user clears their own flag, or admin clears anyone's)
app.put("/make-server-5ec3cec0/users/:id/clear-reset-flag", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.param('id');

    // Users can only clear their own flag; admins can clear anyone's
    const userProfile = await getUserWithRole(user.id);
    if (user.id !== userId && userProfile?.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const existingUser = await kv.get(`user:${userId}`);
    if (!existingUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    const updatedUser = {
      ...existingUser,
      mustResetPassword: false,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`user:${userId}`, updatedUser);
    await createAuditLog('user', userId, 'clear_reset_flag', user.id, existingUser, updatedUser);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error clearing reset flag:', error);
    return c.json({ error: 'Failed to clear reset flag' }, 500);
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
      const emailExists = allUsers.some((u: any) => u && u.email && u.id !== userId && u.email.toLowerCase() === updates.email.toLowerCase());
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

// ========== EMAIL SETTINGS ROUTES ==========

// Get global email settings (admin only)
app.get("/make-server-5ec3cec0/email-settings", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const settings = await kv.get('settings:email');
    return c.json({ settings: settings || { enabled: false } });
  } catch (error) {
    console.log('Error fetching email settings:', error);
    return c.json({ error: 'Failed to fetch email settings' }, 500);
  }
});

// Update global email settings (admin only)
app.put("/make-server-5ec3cec0/email-settings", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const { enabled } = await c.req.json();

    const settings = {
      enabled: enabled === true,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };

    await kv.set('settings:email', settings);
    await createAuditLog('settings', 'email', 'update', user.id, null, settings);

    return c.json({ success: true, settings });
  } catch (error) {
    console.log('Error updating email settings:', error);
    return c.json({ error: 'Failed to update email settings' }, 500);
  }
});

// ========== EMAIL TEMPLATE ROUTES ==========

// Get all email templates (admin only)
app.get("/make-server-5ec3cec0/email-templates", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    // Get all template types
    const templateTypes = ['submitted', 'submitted_direct', 'submitted_confirmation', 'approved', 'denied', 'fulfilled', 'cancelled'];
    const templates: any = {};

    for (const type of templateTypes) {
      const template = await kv.get(`email-template:${type}`);
      templates[type] = template || null;
    }

    return c.json({ templates });
  } catch (error) {
    console.log('Error fetching email templates:', error);
    return c.json({ error: 'Failed to fetch email templates' }, 500);
  }
});

// Update email template (admin only)
app.put("/make-server-5ec3cec0/email-templates", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const { templateType, subject, htmlBody, textBody } = await c.req.json();

    if (!templateType || !['submitted', 'submitted_direct', 'submitted_confirmation', 'approved', 'denied', 'fulfilled', 'cancelled'].includes(templateType)) {
      return c.json({ error: 'Invalid template type' }, 400);
    }

    const template = {
      subject,
      htmlBody,
      textBody,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };

    await kv.set(`email-template:${templateType}`, template);
    await createAuditLog('settings', 'email-template', 'update', user.id, null, { templateType, ...template });

    return c.json({ success: true, template });
  } catch (error) {
    console.log('Error updating email template:', error);
    return c.json({ error: 'Failed to update email template' }, 500);
  }
});

// Reset email template to default (admin only)
app.post("/make-server-5ec3cec0/email-templates/:type/reset", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const templateType = c.req.param('type');

    if (!['submitted', 'submitted_direct', 'submitted_confirmation', 'approved', 'denied', 'fulfilled', 'cancelled'].includes(templateType)) {
      return c.json({ error: 'Invalid template type' }, 400);
    }

    // Delete the custom template to revert to default
    await kv.del(`email-template:${templateType}`);
    await createAuditLog('settings', 'email-template', 'reset', user.id, null, { templateType });

    return c.json({ success: true });
  } catch (error) {
    console.log('Error resetting email template:', error);
    return c.json({ error: 'Failed to reset email template' }, 500);
  }
});

// Get email template preview (admin only) - returns default or custom template
app.get("/make-server-5ec3cec0/email-templates/:type/preview", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const templateType = c.req.param('type');

    if (!['submitted', 'submitted_direct', 'submitted_confirmation', 'approved', 'denied', 'fulfilled', 'cancelled'].includes(templateType)) {
      return c.json({ error: 'Invalid template type' }, 400);
    }

    // Check for custom template first
    const customTemplate = await kv.get(`email-template:${templateType}`);
    
    if (customTemplate) {
      return c.json({ 
        template: {
          subject: customTemplate.subject,
          htmlBody: customTemplate.htmlBody,
          textBody: customTemplate.textBody,
          isCustom: true,
        }
      });
    }

    // Return default template
    const { getOrderSubmittedTemplate, getOrderApprovedTemplate, getOrderDeniedTemplate, getOrderFulfilledTemplate } = await import('./email-service.tsx');
    
    const sampleData = {
      orderId: 'ORD-001',
      orderDate: new Date().toISOString(),
      requestorName: 'John Doe',
      requestorEmail: 'john.doe@example.com',
      items: [
        { name: 'Sample Item 1', quantity: 5 },
        { name: 'Sample Item 2', quantity: 3 },
      ],
      status: 'pending',
      notes: 'Sample notes',
      approverName: 'Jane Smith',
    };

    let defaultTemplate;
    switch (templateType) {
      case 'submitted':
        defaultTemplate = getOrderSubmittedTemplate(sampleData);
        break;
      case 'approved':
        defaultTemplate = getOrderApprovedTemplate(sampleData);
        break;
      case 'denied':
        defaultTemplate = getOrderDeniedTemplate(sampleData);
        break;
      case 'fulfilled':
        defaultTemplate = getOrderFulfilledTemplate(sampleData);
        break;
      default:
        return c.json({ error: 'Unknown template type' }, 400);
    }

    return c.json({ 
      template: {
        subject: defaultTemplate.subject,
        htmlBody: defaultTemplate.html,
        textBody: defaultTemplate.text,
        isCustom: false,
      }
    });
  } catch (error) {
    console.log('Error fetching email template preview:', error);
    return c.json({ error: 'Failed to fetch email template preview' }, 500);
  }
});

// ========== APP NAME SETTINGS ROUTES ==========

// Get app name settings
app.get("/make-server-5ec3cec0/app-settings", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const settings = await kv.get('settings:app');
    return c.json({ settings: settings || { appName: 'SHC Inventory' } });
  } catch (error) {
    console.log('Error fetching app settings:', error);
    return c.json({ error: 'Failed to fetch app settings' }, 500);
  }
});

// Update app name settings (admin only)
app.put("/make-server-5ec3cec0/app-settings", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const { appName } = await c.req.json();

    const settings = {
      appName: appName || 'SHC Inventory',
    };

    await kv.set('settings:app', settings);
    await createAuditLog('settings', 'app', 'update', user.id, null, settings);

    return c.json({ success: true, settings });
  } catch (error) {
    console.log('Error updating app settings:', error);
    return c.json({ error: 'Failed to update app settings' }, 500);
  }
});

// ========== WORKFLOW SETTINGS ROUTES ==========

// Get workflow settings
app.get("/make-server-5ec3cec0/workflow-settings", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const settings = await kv.get('settings:workflow');
    return c.json({ settings: settings || { approvalRequired: true } });
  } catch (error) {
    console.log('Error fetching workflow settings:', error);
    return c.json({ error: 'Failed to fetch workflow settings' }, 500);
  }
});

// Update workflow settings (admin only)
app.put("/make-server-5ec3cec0/workflow-settings", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const { approvalRequired } = await c.req.json();

    const settings = {
      approvalRequired: approvalRequired !== undefined ? approvalRequired : true,
    };

    await kv.set('settings:workflow', settings);
    await createAuditLog('settings', 'workflow', 'update', user.id, null, settings);

    return c.json({ success: true, settings });
  } catch (error) {
    console.log('Error updating workflow settings:', error);
    return c.json({ error: 'Failed to update workflow settings' }, 500);
  }
});

// Get user email preferences
app.get("/make-server-5ec3cec0/users/:id/email-preferences", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.param('id');
    
    // Users can only get their own preferences, admins can get anyone's
    const userProfile = await getUserWithRole(user.id);
    if (user.id !== userId && (!userProfile || userProfile.role !== 'admin')) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const preferences = await kv.get(`user:${userId}:email-prefs`);
    
    // Default preferences if not set
    const defaultPrefs = {
      onOrderSubmitted: true,
      onOrderApproved: true,
      onOrderDenied: true,
      onOrderFulfilled: true,
    };

    return c.json({ preferences: preferences || defaultPrefs });
  } catch (error) {
    console.log('Error fetching email preferences:', error);
    return c.json({ error: 'Failed to fetch email preferences' }, 500);
  }
});

// Update user email preferences
app.put("/make-server-5ec3cec0/users/:id/email-preferences", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.param('id');
    
    // Users can only update their own preferences, admins can update anyone's
    const userProfile = await getUserWithRole(user.id);
    if (user.id !== userId && (!userProfile || userProfile.role !== 'admin')) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const preferences = await c.req.json();

    // Validate preference keys
    const validKeys = ['onOrderSubmitted', 'onOrderApproved', 'onOrderDenied', 'onOrderFulfilled'];
    const invalidKeys = Object.keys(preferences).filter(key => !validKeys.includes(key));
    if (invalidKeys.length > 0) {
      return c.json({ error: `Invalid preference keys: ${invalidKeys.join(', ')}` }, 400);
    }

    await kv.set(`user:${userId}:email-prefs`, {
      ...preferences,
      updatedAt: new Date().toISOString(),
    });

    return c.json({ success: true, preferences });
  } catch (error) {
    console.log('Error updating email preferences:', error);
    return c.json({ error: 'Failed to update email preferences' }, 500);
  }
});

// Email diagnostics endpoint (admin only)
app.get("/make-server-5ec3cec0/email-diagnostics", async (c) => {
  console.log('🔵🔵🔵 EMAIL DIAGNOSTICS ENDPOINT HIT! 🔵🔵🔵');
  console.log('Request URL:', c.req.url);
  console.log('Request method:', c.req.method);
  console.log('Query params:', c.req.query());
  console.log('All headers:', Object.fromEntries(c.req.raw.headers.entries()));
  
  try {
    console.log('=== Email Diagnostics Endpoint Called ===');
    
    // Check for token in query parameter (workaround for Supabase stripping custom headers)
    const queryToken = c.req.query('token');
    console.log('Token from query parameter:', queryToken ? `Present (${queryToken.length} chars)` : 'Missing');
    
    let user;
    if (queryToken) {
      // Manually verify token from query parameter
      try {
        const session = await kv.get(`session:${queryToken}`);
        if (session) {
          const now = Date.now();
          const sessionCreatedTime = new Date(session.createdAt).getTime();
          const sessionAge = now - sessionCreatedTime;
          const maxAge = 24 * 60 * 60 * 1000;
          
          if (sessionAge <= maxAge) {
            user = { id: session.userId, email: session.email };
            console.log('User from query token:', user);
          } else {
            console.log('Session expired (from query token)');
          }
        } else {
          console.log('No session found for query token');
        }
      } catch (error) {
        console.log('Error verifying query token:', error);
      }
    } else {
      // Fall back to standard header-based auth
      user = await verifyAuth(c);
      console.log('User from verifyAuth:', user ? `ID: ${user.id}` : 'null');
    }
    
    if (!user) {
      console.log('Email diagnostics: Unauthorized - no user');
      return c.json({ code: 401, message: 'Unauthorized: invalid or missing token' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    console.log('User profile:', userProfile ? `${userProfile.name} (${userProfile.role})` : 'null');
    
    if (!userProfile || userProfile.role !== 'admin') {
      console.log('Email diagnostics: Forbidden - user is not admin');
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    // Check Resend API key
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const apiKeyConfigured = !!apiKey;
    
    // Show partial key for verification (first 10 and last 4 chars)
    let partialKey = '';
    let keyPrefix = '';
    let keySuffix = '';
    if (apiKey && apiKey.length > 14) {
      keyPrefix = apiKey.substring(0, 10);
      keySuffix = apiKey.substring(apiKey.length - 4);
      partialKey = `${keyPrefix}...${keySuffix}`;
    }

    // Check global email settings
    const emailSettings = await kv.get('settings:email');
    const globalEnabled = emailSettings?.enabled === true;

    // Get all approvers and their email preferences
    const allUsers = await kv.getByPrefix('user:');
    const approvers = allUsers.filter((u: any) => u.role === 'approver' || u.role === 'admin');
    
    const approverList = await Promise.all(
      approvers.map(async (approver: any) => {
        const prefs = await kv.get(`user:${approver.id}:email-prefs`);
        const emailEnabled = prefs?.onOrderSubmitted !== false; // Default true if not set
        
        return {
          id: approver.id,
          name: approver.name,
          email: approver.email,
          role: approver.role,
          emailEnabled,
        };
      })
    );

    // Determine overall status
    const issues: string[] = [];
    if (!apiKeyConfigured) {
      issues.push('RESEND_API_KEY is not configured');
    }
    if (!globalEnabled) {
      issues.push('Global email notifications are disabled');
    }
    if (approvers.length === 0) {
      issues.push('No approvers configured to receive order notifications');
    }

    const ready = apiKeyConfigured && globalEnabled && approvers.length > 0;

    const result = {
      resendApiKey: {
        configured: apiKeyConfigured,
        length: apiKey?.length || 0,
        partial: partialKey,
        prefix: keyPrefix,
        suffix: keySuffix,
      },
      globalSettings: {
        enabled: globalEnabled,
        lastUpdated: emailSettings?.updatedAt || null,
      },
      approvers: {
        count: approvers.length,
        list: approverList,
      },
      overall: {
        ready,
        message: ready 
          ? 'Email system is fully configured and ready to send notifications' 
          : 'Email system has configuration issues that need to be resolved',
        issues,
      },
    };
    
    console.log('Email diagnostics result:', JSON.stringify(result, null, 2));
    return c.json(result);
  } catch (error) {
    console.log('Error running email diagnostics:', error);
    console.log('Error type:', typeof error);
    console.log('Error message:', error instanceof Error ? error.message : String(error));
    console.log('Error stack:', error instanceof Error ? error.stack : 'N/A');
    return c.json({ error: 'Failed to run diagnostics', details: error instanceof Error ? error.message : String(error) }, 500);
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

    const { locationId, aisle, rack, shelf, capacity } = await c.req.json();
    const binId = crypto.randomUUID();
    
    // Generate bin code from aisle-rack-shelf
    const binCode = `${aisle}-${rack}-${shelf}`;

    // Get location name
    const location = await kv.get(`location:${locationId}`);

    const binData = {
      id: binId,
      binCode,
      locationId,
      locationName: location?.name || '',
      aisle: aisle || '',
      rack: rack || '',
      shelf: shelf || '',
      capacity: capacity || 100,
      currentOccupancy: 0,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`bin:${binId}`, binData);
    await createAuditLog('bin', binId, 'create', user.id, null, binData);
    
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

    // Enrich with location names if not present
    const locations = await kv.getByPrefix('location:');
    const locationMap = new Map(locations.map((loc: any) => [loc.id, loc.name]));
    
    bins = bins.map((bin: any) => ({
      ...bin,
      locationName: bin.locationName || locationMap.get(bin.locationId) || 'Unknown'
    }));

    return c.json({ bins });
  } catch (error) {
    console.log('Error fetching bins:', error);
    return c.json({ error: 'Failed to fetch bins' }, 500);
  }
});

// Update bin (admin/fulfillment only)
app.put("/make-server-5ec3cec0/bins/:id", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const binId = c.req.param('id');
    const { locationId, aisle, rack, shelf, capacity, active } = await c.req.json();

    const existingBin = await kv.get(`bin:${binId}`);
    if (!existingBin) {
      return c.json({ error: 'Bin not found' }, 404);
    }

    // Generate new bin code
    const binCode = `${aisle}-${rack}-${shelf}`;

    // Get location name
    const location = await kv.get(`location:${locationId}`);

    const updatedBin = {
      ...existingBin,
      binCode,
      locationId,
      locationName: location?.name || existingBin.locationName || '',
      aisle,
      rack,
      shelf,
      capacity,
      active,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };

    await kv.set(`bin:${binId}`, updatedBin);
    await createAuditLog('bin', binId, 'update', user.id, existingBin, updatedBin);

    return c.json({ success: true, bin: updatedBin });
  } catch (error) {
    console.log('Error updating bin:', error);
    return c.json({ error: 'Failed to update bin' }, 500);
  }
});

// OPTIONS handler for bin update
app.options("/make-server-5ec3cec0/bins/:id", (c) => {
  return c.text('', 204);
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

    // Enrich lots with item name
    const item = await kv.get(`item:${itemId}`);
    const enrichedLots = itemLots.map((lot: any) => ({
      ...lot,
      itemName: item?.name || 'Unknown Item',
      quantity: lot.quantityRemaining, // Map quantityRemaining to quantity for frontend
      available: lot.quantityRemaining,
    }));

    return c.json({ lots: enrichedLots });
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
      enrichedLots.push({ 
        ...lot, 
        itemName: item?.name || 'Unknown Item',
        item 
      });
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
    await createNotification('fulfillment-team', 'lot_recall', `Lot ${lot.lotNumber} has been recalled: ${reason}`, `/lots`);

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
      poNumber: poData.customPONumber || `PO-${Date.now()}`,
      vendor: poData.vendor,
      vendorId: poData.vendorId,
      orderDate: new Date().toISOString(),
      expectedDate: poData.expectedDate || null,
      expectedDeliveryDate: poData.expectedDeliveryDate || null,
      status: poData.status || 'draft', // draft, submitted, approved, received, cancelled
      items: poData.items || [],
      totalCost: poData.totalCost || 0,
      totalAmount: poData.totalAmount || 0,
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

// Update PO
app.put("/make-server-5ec3cec0/purchase-orders/:id", async (c) => {
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
    const updateData = await c.req.json();

    const existingPO = await kv.get(`po:${poId}`);
    if (!existingPO) {
      return c.json({ error: 'Purchase order not found' }, 404);
    }

    // Only allow editing draft or submitted POs
    if (!['draft', 'submitted'].includes(existingPO.status)) {
      return c.json({ error: 'Cannot edit PO in current status' }, 400);
    }

    // Validate status if provided
    if (updateData.status) {
      const validStatuses = ['draft', 'submitted', 'approved', 'received', 'cancelled'];
      if (!validStatuses.includes(updateData.status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }
    }

    // Update PO with new data
    const updatedPO = {
      ...existingPO,
      poNumber: updateData.customPONumber || existingPO.poNumber,
      vendorId: updateData.vendorId || existingPO.vendorId,
      expectedDate: updateData.expectedDate || existingPO.expectedDate,
      status: updateData.status || existingPO.status,
      items: updateData.items || existingPO.items,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };

    await kv.set(`po:${poId}`, updatedPO);
    await createAuditLog('purchase_order', poId, 'update', user.id, existingPO, updatedPO);

    return c.json({ success: true, purchaseOrder: updatedPO });
  } catch (error) {
    console.log('Error updating purchase order:', error);
    return c.json({ error: 'Failed to update purchase order' }, 500);
  }
});

// Change PO status - OPTIONS
app.options("/make-server-5ec3cec0/purchase-orders/:id/status", (c) => {
  return c.text('', 204);
});

// Change PO status
app.patch("/make-server-5ec3cec0/purchase-orders/:id/status", async (c) => {
  try {
    console.log('PATCH /purchase-orders/:id/status - Request received');
    
    const user = await verifyAuth(c);
    if (!user) {
      console.log('PATCH /purchase-orders/:id/status - Unauthorized: no user');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('PATCH /purchase-orders/:id/status - User verified:', user.id);

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment', 'approver'].includes(userProfile.role)) {
      console.log('PATCH /purchase-orders/:id/status - Forbidden: insufficient permissions');
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const poId = c.req.param('id');
    const { status } = await c.req.json();

    console.log('PATCH /purchase-orders/:id/status - Updating PO:', { poId, status });

    const existingPO = await kv.get(`po:${poId}`);
    if (!existingPO) {
      console.log('PATCH /purchase-orders/:id/status - PO not found');
      return c.json({ error: 'Purchase order not found' }, 404);
    }

    // Validate status
    const validStatuses = ['draft', 'submitted', 'approved', 'received', 'cancelled'];
    if (!validStatuses.includes(status)) {
      console.log('PATCH /purchase-orders/:id/status - Invalid status');
      return c.json({ error: 'Invalid status' }, 400);
    }

    // Update PO status
    const updatedPO = {
      ...existingPO,
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };

    await kv.set(`po:${poId}`, updatedPO);
    await createAuditLog('purchase_order', poId, 'status_change', user.id, 
      { status: existingPO.status }, 
      { status: status }
    );

    console.log('PATCH /purchase-orders/:id/status - Success');
    return c.json({ success: true, purchaseOrder: updatedPO });
  } catch (error) {
    console.log('Error changing purchase order status:', error);
    return c.json({ error: 'Failed to change purchase order status' }, 500);
  }
});

// Receive PO - OPTIONS
app.options("/make-server-5ec3cec0/purchase-orders/:id/receive", (c) => {
  return c.text('', 204);
});

// Receive PO (full or partial)
app.post("/make-server-5ec3cec0/purchase-orders/:id/receive", async (c) => {
  try {
    console.log('POST /purchase-orders/:id/receive - Request received');
    
    const user = await verifyAuth(c);
    if (!user) {
      console.log('POST /purchase-orders/:id/receive - Unauthorized: no user');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('POST /purchase-orders/:id/receive - User verified:', user.id);

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      console.log('POST /purchase-orders/:id/receive - Forbidden: insufficient permissions');
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const poId = c.req.param('id');
    const receiptData = await c.req.json();

    console.log('POST /purchase-orders/:id/receive - Processing PO:', { poId, receiptData });

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

    console.log('POST /purchase-orders/:id/receive - Success');
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

// Delete cycle count (admin only)
app.delete("/make-server-5ec3cec0/cycle-counts/:id", async (c) => {
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

    // Delete the cycle count
    await kv.del(`count:${countId}`);
    await createAuditLog('cycle_count', countId, 'delete', user.id, cycleCount, null);

    return c.json({ success: true, message: 'Cycle count deleted successfully' });
  } catch (error) {
    console.log('Error deleting cycle count:', error);
    return c.json({ error: 'Failed to delete cycle count' }, 500);
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
    if (!userProfile || !['admin', 'approver', 'fulfillment'].includes(userProfile.role)) {
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
    if (!userProfile || !['admin', 'approver', 'fulfillment'].includes(userProfile.role)) {
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
      `Your order ${orderId} has been ${decision}: ${comments || ''}`,
      `/orders/${orderId}`
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

// Update vendor
app.put("/make-server-5ec3cec0/vendors/:id", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || !['admin', 'fulfillment'].includes(userProfile.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    const vendorId = c.req.param('id');
    const existingVendor = await kv.get(`vendor:${vendorId}`);
    
    if (!existingVendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }

    const vendorData = await c.req.json();
    
    const updatedVendor = {
      ...existingVendor,
      name: vendorData.name || existingVendor.name,
      contactName: vendorData.contactName !== undefined ? vendorData.contactName : existingVendor.contactName,
      email: vendorData.email !== undefined ? vendorData.email : existingVendor.email,
      phone: vendorData.phone !== undefined ? vendorData.phone : existingVendor.phone,
      address: vendorData.address !== undefined ? vendorData.address : existingVendor.address,
      notes: vendorData.notes !== undefined ? vendorData.notes : existingVendor.notes,
      active: vendorData.active !== undefined ? vendorData.active : existingVendor.active,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`vendor:${vendorId}`, updatedVendor);
    return c.json({ success: true, vendor: updatedVendor });
  } catch (error) {
    console.log('Error updating vendor:', error);
    return c.json({ error: 'Failed to update vendor' }, 500);
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

// Debug endpoint to check auth status
app.get("/make-server-5ec3cec0/debug/auth-check", async (c) => {
  try {
    // Check both header AND query parameter for token (query parameter workaround for Supabase infrastructure)
    const sessionTokenFromHeader = c.req.header('X-Session-Token');
    const sessionTokenFromQuery = c.req.query('token');
    const sessionToken = sessionTokenFromQuery || sessionTokenFromHeader;
    const authHeader = c.req.header('Authorization');
    
    console.log('=== DEBUG AUTH CHECK ===');
    console.log('X-Session-Token header:', sessionTokenFromHeader ? `Present (${sessionTokenFromHeader.length} chars)` : 'Missing');
    console.log('Token from query:', sessionTokenFromQuery ? `Present (${sessionTokenFromQuery.length} chars)` : 'Missing');
    console.log('Using token from:', sessionTokenFromQuery ? 'query parameter' : sessionTokenFromHeader ? 'header' : 'none');
    console.log('Token first 30 chars:', sessionToken ? sessionToken.substring(0, 30) : 'N/A');
    console.log('Token last 30 chars:', sessionToken ? sessionToken.substring(sessionToken.length - 30) : 'N/A');
    console.log('Authorization header:', authHeader || 'Missing');
    
    const result: any = {
      headers: {
        'X-Session-Token': sessionTokenFromHeader ? `Present (${sessionTokenFromHeader.length} chars, first 20: ${sessionTokenFromHeader.substring(0, 20)}...)` : 'Missing',
        'Authorization': authHeader || 'Missing',
      },
      query: {
        token: sessionTokenFromQuery ? `Present (${sessionTokenFromQuery.length} chars)` : 'Missing',
      },
      tokenUsed: sessionTokenFromQuery ? 'query parameter' : sessionTokenFromHeader ? 'header' : 'none',
      token: sessionToken || 'none',
    };
    
    if (sessionToken) {
      const lookupKey = `session:${sessionToken}`;
      console.log('Looking up session with key:', lookupKey.substring(0, 40) + '...');
      
      // Check if session exists
      const session = await kv.get(lookupKey);
      console.log('Session lookup result:', session ? 'FOUND' : 'NOT FOUND');
      
      result.sessionInKV = session ? 'Found' : 'Not Found';
      result.lookupKey = lookupKey.substring(0, 50) + '...';
      
      if (session) {
        console.log('Session data:', { userId: session.userId, email: session.email, createdAt: session.createdAt });
        result.sessionData = {
          userId: session.userId,
          email: session.email,
          createdAt: session.createdAt,
          age: `${Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 1000 / 60)} minutes`,
        };
        
        // Check user profile
        const userProfile = await kv.get(`user:${session.userId}`);
        console.log('User profile found:', !!userProfile);
        result.userProfile = userProfile ? {
          name: userProfile.name,
          email: userProfile.email,
          role: userProfile.role,
        } : 'Not Found';
      } else {
        // Try to list all session keys to see what exists
        console.log('Attempting to list existing sessions...');
        try {
          const allSessions = await kv.getByPrefix('session:');
          console.log(`Found ${allSessions?.length || 0} sessions in database`);
          result.totalSessionsInDB = allSessions?.length || 0;
          
          if (allSessions && allSessions.length > 0) {
            result.sampleSessions = allSessions.slice(0, 3).map((sessionValue: any) => ({
              userId: sessionValue.userId,
              email: sessionValue.email,
              createdAt: sessionValue.createdAt,
              age: `${Math.floor((Date.now() - new Date(sessionValue.createdAt).getTime()) / 1000 / 60)} minutes`,
            }));
          }
        } catch (listError) {
          console.error('Error listing sessions:', listError);
          result.listError = String(listError);
        }
      }
    }
    
    return c.json(result);
  } catch (error) {
    console.log('Debug auth check error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Simple KV test endpoint
app.get("/make-server-5ec3cec0/debug/kv-test", async (c) => {
  try {
    console.log('=== KV STORE TEST ===');
    
    // Test 1: Set and get a simple value
    const testKey = 'test:' + Date.now();
    const testValue = { message: 'Hello', timestamp: new Date().toISOString() };
    
    console.log('Setting test value with key:', testKey);
    await kv.set(testKey, testValue);
    console.log('Test value set successfully');
    
    console.log('Getting test value...');
    const retrieved = await kv.get(testKey);
    console.log('Retrieved value:', retrieved);
    
    // Test 2: List all sessions
    console.log('Listing all sessions...');
    const allSessions = await kv.getByPrefix('session:');
    console.log('Found sessions:', allSessions?.length || 0);
    
    // Test 3: List all users
    console.log('Listing all users...');
    const allUsers = await kv.getByPrefix('user:');
    console.log('Found users:', allUsers?.length || 0);
    
    // Clean up test
    await kv.del(testKey);
    
    return c.json({
      success: true,
      tests: {
        setAndGet: retrieved ? 'PASSED' : 'FAILED',
        sessionsCount: allSessions?.length || 0,
        usersCount: allUsers?.length || 0,
      },
      retrievedValue: retrieved,
      sampleSessions: allSessions?.slice(0, 2).map((s: any) => ({
        userId: s.userId,
        email: s.email,
        createdAt: s.createdAt,
      })),
      sampleUsers: allUsers?.slice(0, 2).map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
      })),
    });
  } catch (error) {
    console.error('KV test error:', error);
    return c.json({ error: String(error), stack: error?.stack }, 500);
  }
});

// ========== DELETE USER (admin only) ==========
app.delete("/make-server-5ec3cec0/users/:id", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const targetId = c.req.param('id');

    // Prevent admin from deleting their own account
    if (targetId === user.id) {
      return c.json({ error: 'You cannot delete your own account' }, 400);
    }

    const targetUser = await kv.get(`user:${targetId}`);
    if (!targetUser) return c.json({ error: 'User not found' }, 404);

    // Delete the user profile and related sub-keys from KV
    await kv.del(`user:${targetId}`);
    try { await kv.del(`user:${targetId}:email-prefs`); } catch (_) { /* ignore if not found */ }

    // Also delete the Supabase Auth user via admin API
    try {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
      if (authDeleteError) {
        console.log('Warning: Could not delete Supabase Auth user:', authDeleteError.message);
      }
    } catch (authErr) {
      console.log('Warning: Supabase Auth user deletion skipped:', authErr);
    }

    await createAuditLog('user', targetId, 'delete', user.id, targetUser, null);
    console.log(`Admin ${user.id} deleted user ${targetId} (${targetUser.email})`);

    return c.json({ success: true, message: `User ${targetUser.name} deleted successfully` });
  } catch (error) {
    console.log('Error deleting user:', error);
    return c.json({ error: 'Failed to delete user: ' + (error?.message || String(error)) }, 500);
  }
});

// ========== SECURITY SETTINGS ==========

// Get security settings (admin only)
app.get("/make-server-5ec3cec0/security-settings", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const settings = await kv.get('settings:security');
    return c.json({ settings: settings || { passwordExpiryDays: 0, passwordExpiryEnabled: false } });
  } catch (error) {
    console.log('Error fetching security settings:', error);
    return c.json({ error: 'Failed to fetch security settings' }, 500);
  }
});

// Update security settings (admin only)
app.put("/make-server-5ec3cec0/security-settings", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userProfile = await getUserWithRole(user.id);
    if (!userProfile || userProfile.role !== 'admin') {
      return c.json({ error: 'Forbidden: admin only' }, 403);
    }

    const updates = await c.req.json();
    const existing = await kv.get('settings:security') || {};
    const newSettings = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };
    await kv.set('settings:security', newSettings);

    console.log('Security settings updated by admin:', user.id, newSettings);
    return c.json({ success: true, settings: newSettings });
  } catch (error) {
    console.log('Error updating security settings:', error);
    return c.json({ error: 'Failed to update security settings' }, 500);
  }
});

// Check if current user's password has expired
app.get("/make-server-5ec3cec0/auth/check-password-expiry", async (c) => {
  try {
    const user = await verifyAuth(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const securitySettings = await kv.get('settings:security');
    const expiryDays = securitySettings?.passwordExpiryDays;
    const expiryEnabled = securitySettings?.passwordExpiryEnabled === true;

    if (!expiryEnabled || !expiryDays || expiryDays <= 0) {
      return c.json({ expired: false, expiryEnabled: false });
    }

    const userProfile = await kv.get(`user:${user.id}`);
    if (!userProfile) return c.json({ expired: false, expiryEnabled: true });

    // Skip expiry check for users with mustResetPassword (they're already being forced)
    if (userProfile.mustResetPassword) {
      return c.json({ expired: false, expiryEnabled: true });
    }

    const lastChanged = userProfile.passwordLastChanged || userProfile.createdAt;
    if (!lastChanged) return c.json({ expired: false, expiryEnabled: true });

    const daysSinceChange = (Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24);
    const expired = daysSinceChange > expiryDays;
    const daysRemaining = Math.max(0, expiryDays - Math.floor(daysSinceChange));

    return c.json({ expired, expiryEnabled: true, expiryDays, daysRemaining, daysSinceChange: Math.floor(daysSinceChange) });
  } catch (error) {
    console.log('Error checking password expiry:', error);
    return c.json({ expired: false, expiryEnabled: false });
  }
});

Deno.serve(app.fetch);