# Server Routes Implementation Guide

This document contains all the additional route handlers that need to be added to `/supabase/functions/server/index.tsx` to complete the enterprise inventory management system.

## Instructions

Add these routes **before** the final `Deno.serve(app.fetch);` line in your server file.

---

## 1. BIN MANAGEMENT ROUTES

```typescript
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
```

---

## 2. LOT/EXPIRATION TRACKING ROUTES

```typescript
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
```

---

## 3. PURCHASE ORDER ROUTES

```typescript
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
```

---

## 4. STOCK TRANSFER ROUTES

```typescript
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
```

---

## 5. CYCLE COUNT ROUTES

```typescript
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
```

---

## 6. APPROVAL WORKFLOW ROUTES

```typescript
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
```

---

## 7. VENDOR MANAGEMENT ROUTES

```typescript
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
```

---

## 8. ADDITIONAL REPORTS

```typescript
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
```

---

## ✅ COMPLETION CHECKLIST

After adding these routes to your server file, you will have:

- [x] Bin management (location sub-units)
- [x] Lot and expiration tracking with FEFO
- [x] Lot recall workflow
- [x] Purchase order creation and management
- [x] Receiving workflow (against POs)
- [x] Stock transfers between locations
- [x] Cycle counts with variance review and approval
- [x] Approval workflows for controlled items
- [x] Vendor management
- [x] Advanced reports (usage, turnover, SLA)

All of these features are already integrated with the frontend API service (`/src/app/services/api.ts`), so once you add these routes to the server, the full system will be operational.

---

*Implementation Guide Version: 1.0*  
*For: Enterprise Inventory Management System*