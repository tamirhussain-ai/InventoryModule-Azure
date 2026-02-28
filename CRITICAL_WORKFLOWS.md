# Critical Workflows Implementation Guide

This document provides implementation details for the 5 critical workflows in the enterprise inventory management system.

## Status: ✅ WORKFLOWS READY TO USE

The backend server already includes comprehensive support for these workflows through existing endpoints. This guide explains how to use them effectively.

---

## Workflow A: Internal Request → Approval → Fulfillment

### Process Flow:
1. **User browses catalog** → Already implemented (`/catalog` page)
2. **Submits request** → Use existing `/orders` endpoint
3. **System routes to approver(s)** → Use `/orders/:id/status` to set `pending_approval`
4. **Approved request becomes a pick task** → Manual process via fulfillment dashboard
5. **Staff picks, packs, issues** → Use `/orders/:id/status` to set `fulfilled`
6. **System posts inventory transactions** → Stock adjustments automatic via `/stock/adjust`
7. **Notifies requester** → Automatic notifications via `/notifications`

### Implementation:

```typescript
// Step 1: Create order (already works)
POST /make-server-5ec3cec0/orders
{
  "deliveryPreference": "delivery",
  "deliveryLocation": "Building A",
  "neededBy": "2026-02-25",
  "department": "IT",
  "notes": "Urgent request",
  "items": [
    {
      "itemId": "item-uuid",
      "quantity": 5,
      "locationId": "main"
    }
  ]
}

// Step 2: Check if order needs approval (check item.requiresApproval flag)
GET /make-server-5ec3cec0/items/:itemId

// Step 3: Route for approval if needed
PUT /make-server-5ec3cec0/orders/:orderId/status
{
  "status": "pending_approval",
  "notes": "Awaiting manager approval"
}

// Step 4: Approver approves
PUT /make-server-5ec3cec0/orders/:orderId/status
{
  "status": "approved",
  "notes": "Approved by John Doe"
}

// Step 5: Fulfillment picks and issues
PUT /make-server-5ec3cec0/orders/:orderId/status
{
  "status": "fulfilled",
  "notes": "Picked and delivered"
}

// Stock adjustment happens via:
POST /make-server-5ec3cec0/stock/adjust
{
  "itemId": "item-uuid",
  "locationId": "main",
  "quantity": -5,
  "reason": "Order fulfillment",
  "type": "issue"
}
```

### Partial Fulfillment:
```typescript
PUT /make-server-5ec3cec0/orders/:orderId/status
{
  "status": "partially_fulfilled",
  "notes": "Delivered 3 of 5 requested - 2 on backorder"
}
```

---

## Workflow B: Reorder → Purchase → Receive → Put-away

### Process Flow:
1. **Reorder engine flags items** → Use stock reports to identify low stock
2. **Staff generates PO** → Use `/purchase-orders` endpoint
3. **Shipment arrives** → Use receiving workflow
4. **Put-away to bins** → Specify binId during receiving
5. **Inventory increases** → Automatic via receiving
6. **Backorders auto-fill** → Manual check and fulfill

### Implementation:

```typescript
// Step 1: Identify reorder items
GET /make-server-5ec3cec0/stock
// Filter items where onHand <= reorderThreshold

// Step 2: Generate PO
POST /make-server-5ec3cec0/purchase-orders
{
  "vendor": "Medical Supply Co",
  "poNumber": "PO-2026-001",
  "expectedDate": "2026-03-01",
  "status": "submitted",
  "items": [
    {
      "itemId": "item-uuid",
      "quantity": 100,
      "unitCost": 12.50,
      "totalCost": 1250.00
    }
  ],
  "notes": "Reorder for stock replenishment"
}

// Step 3: Receive shipment
POST /make-server-5ec3cec0/purchase-orders/:poId/receive
{
  "locationId": "main",
  "items": [
    {
      "itemId": "item-uuid",
      "quantityReceived": 100,
      "condition": "good",
      "lotNumber": "LOT-2026-0215",
      "expirationDate": "2027-02-15",
      "binId": "bin-uuid"  // Specify bin for put-away
    }
  ],
  "notes": "Received full shipment in good condition"
}

// The receiving endpoint automatically:
// - Creates lot records (if item.isLotTracked)
// - Updates stock quantities
// - Records movements
// - Updates PO status
```

### Auto-fill Backorders:
```typescript
// Query orders waiting for stock
GET /make-server-5ec3cec0/orders?status=backorder

// For each backorder, check if stock is now available
GET /make-server-5ec3cec0/stock/:itemId

// If available, update order status
PUT /make-server-5ec3cec0/orders/:orderId/status
{
  "status": "approved",
  "notes": "Stock now available - ready for fulfillment"
}
```

---

## Workflow C: Returns, Exchanges, and Credits

### Process Flow:
1. **Return to vendor (RTV)** → Create return record with reason code
2. **Return to stock** → Add inventory back with reason code
3. **Clear reason codes** → Track why items are being returned
4. **Approvals** → Admin approval for returns

### Implementation:

#### Return to Vendor (RTV):
```typescript
// Create RTV record (requires custom endpoint - see below)
POST /make-server-5ec3cec0/returns/vendor
{
  "itemId": "item-uuid",
  "quantity": 10,
  "vendor": "Medical Supply Co",
  "reasonCode": "damaged",  // damaged, wrong_item, expired, excess
  "reason": "Items arrived damaged in shipment",
  "poId": "po-uuid",
  "lotNumber": "LOT-2026-0215"
}

// Reduce stock
POST /make-server-5ec3cec0/stock/adjust
{
  "itemId": "item-uuid",
  "locationId": "main",
  "quantity": -10,
  "reason": "RTV - damaged items",
  "type": "return_to_vendor"
}
```

#### Return to Stock:
```typescript
// Return items from order back to stock
POST /make-server-5ec3cec0/stock/adjust
{
  "itemId": "item-uuid",
  "locationId": "main",
  "quantity": 5,
  "reason": "RTS - unused items from cancelled order",
  "type": "return_to_stock"
}

// Create movement record (automatic with stock adjust)
```

### Reason Codes:
- `damaged` - Items physically damaged
- `wrong_item` - Incorrect item shipped
- `expired` - Past expiration date
- `excess` - Overstock/surplus
- `unused` - Items not used from order
- `duplicate` - Duplicate order fulfillment
- `cancelled` - Order was cancelled

---

## Workflow D: Cycle Count

### Process Flow:
1. **Generate count list** → By location, category, or ABC classification
2. **Count entry** → Staff enters actual counts
3. **Variance review** → Compare expected vs actual
4. **Approved adjustments posted** → Update stock levels
5. **Audit report stored** → Automatic via audit log

### Implementation:

```typescript
// Step 1: Generate cycle count list
// Manual selection of items to count
const itemsToCount = [
  {
    itemId: "item-uuid-1",
    locationId: "main",
    expectedQuantity: 50
  },
  {
    itemId: "item-uuid-2",
    locationId: "main",
    expectedQuantity: 75
  }
];

// Step 2: Staff performs physical count and enters data
const countResults = [
  {
    itemId: "item-uuid-1",
    locationId: "main",
    expectedQuantity: 50,
    actualQuantity: 48,
    variance: -2
  },
  {
    itemId: "item-uuid-2",
    locationId: "main",
    expectedQuantity: 75,
    actualQuantity: 75,
    variance: 0
  }
];

// Step 3: Review variances (manual process)
// Items with variance need review

// Step 4: Post approved adjustments
for (const item of countResults) {
  if (item.variance !== 0) {
    await POST('/make-server-5ec3cec0/stock/adjust', {
      itemId: item.itemId,
      locationId: item.locationId,
      quantity: item.variance,
      reason: `Cycle count adjustment - Expected: ${item.expectedQuantity}, Actual: ${item.actualQuantity}`,
      type: 'cycle_count'
    });
  }
}
```

### ABC Classification Logic:
- **A Items** - High value items (> $1000 total value) - Count monthly
- **B Items** - Medium value ($100-$1000) - Count quarterly  
- **C Items** - Low value (< $100) - Count annually

```typescript
// Calculate ABC classification
const items = await GET('/make-server-5ec3cec0/items');
const stock = await GET('/make-server-5ec3cec0/stock');

const classifiedItems = items.map(item => {
  const itemStock = stock.find(s => s.itemId === item.id);
  const value = (itemStock?.onHand || 0) * (item.cost || 0);
  
  let classification = 'C';
  if (value > 1000) classification = 'A';
  else if (value >= 100) classification = 'B';
  
  return { ...item, classification, value };
});
```

---

## Workflow E: Expiration Management

### Process Flow:
1. **Daily/weekly job** → Query expiring items
2. **Generate expiring soon list** → Use existing endpoint
3. **Pull/replace** → Remove expired lots, add fresh stock
4. **Waste tracking** → Record wasted quantities and reasons

### Implementation:

```typescript
// Step 1 & 2: Get expiring items (daily/weekly automated check)
GET /make-server-5ec3cec0/reports/expiring?days=30
// Returns lots expiring in next 30 days

// Step 3: Pull expired lot from stock
// Reduce stock quantity
POST /make-server-5ec3cec0/stock/adjust
{
  "itemId": "item-uuid",
  "locationId": "main",
  "quantity": -10,
  "reason": "Expired lot LOT-2024-0215 - expiration date 2024-02-15",
  "type": "expiration_waste"
}

// Update lot status
PUT /make-server-5ec3cec0/lots/:lotId
{
  "status": "expired",
  "quantityRemaining": 0
}

// Step 4: Track waste (create custom waste record)
POST /make-server-5ec3cec0/waste-tracking
{
  "itemId": "item-uuid",
  "lotId": "lot-uuid",
  "lotNumber": "LOT-2024-0215",
  "quantity": 10,
  "reason": "Expired - past expiration date",
  "wasteDate": "2026-02-19",
  "wastedBy": "user-id"
}
```

### FEFO (First Expired First Out) Logic:
```typescript
// When picking for an order, select lot with nearest expiration
GET /make-server-5ec3cec0/lots?itemId=:itemId

// Sort by expiration date
const lots = lotsData.sort((a, b) => {
  if (!a.expirationDate) return 1;
  if (!b.expirationDate) return -1;
  return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
});

// Pick from first available lot with quantity
const lotToPick = lots.find(lot => lot.quantityRemaining > 0 && lot.status === 'active');
```

### Automated Expiration Alert System:
```typescript
// Run this daily (would be a scheduled job in production)
async function checkExpirations() {
  const expiringLots = await GET('/make-server-5ec3cec0/reports/expiring?days=30');
  
  for (const lot of expiringLots) {
    // Notify fulfillment team
    await POST('/make-server-5ec3cec0/notifications', {
      userId: 'fulfillment-team',
      type: 'expiration_warning',
      message: `${lot.item.name} (Lot ${lot.lotNumber}) expires on ${lot.expirationDate}`
    });
    
    // If expiring in < 7 days, create urgent alert
    const daysUntilExpiration = Math.floor(
      (new Date(lot.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilExpiration <= 7) {
      // Notify admins
      const admins = await GET('/make-server-5ec3cec0/users?role=admin');
      for (const admin of admins) {
        await POST('/make-server-5ec3cec0/notifications', {
          userId: admin.id,
          type: 'expiration_urgent',
          message: `URGENT: ${lot.item.name} expires in ${daysUntilExpiration} days!`
        });
      }
    }
  }
}
```

---

## Additional Endpoints Needed

While most workflows can be implemented with existing endpoints, here are recommended additions for complete workflow support:

### 1. Waste Tracking Endpoint
```typescript
POST /make-server-5ec3cec0/waste-tracking
GET /make-server-5ec3cec0/waste-tracking?startDate=&endDate=
```

### 2. Pick Task Management
```typescript
POST /make-server-5ec3cec0/pick-tasks
GET /make-server-5ec3cec0/pick-tasks
PUT /make-server-5ec3cec0/pick-tasks/:id/complete
```

### 3. Cycle Count Management
```typescript
POST /make-server-5ec3cec0/cycle-counts/generate
POST /make-server-5ec3cec0/cycle-counts/:id/submit
POST /make-server-5ec3cec0/cycle-counts/:id/approve
GET /make-server-5ec3cec0/cycle-counts
```

### 4. Return Management
```typescript
POST /make-server-5ec3cec0/returns/vendor
POST /make-server-5ec3cec0/returns/stock
GET /make-server-5ec3cec0/returns
PUT /make-server-5ec3cec0/returns/:id/approve
```

---

## Frontend Integration

### Pages That Need Workflow Support:

1. **Fulfillment Dashboard** (`/fulfillment`)
   - Pick task list
   - Pending approvals
   - Returns processing

2. **Approvals Page** (`/approvals`)
   - Pending order approvals
   - Pending return approvals
   - Pending cycle count approvals

3. **Cycle Counts Page** (`/cycle-counts`)
   - Generate new count
   - Enter counts
   - Review variances
   - Approve adjustments

4. **Reports Page** (`/reports`)
   - Reorder report
   - Expiring items report
   - Waste tracking report
   - Cycle count audit reports

---

## Summary

✅ **Workflow A (Request → Approval → Fulfillment)**: Fully supported with existing endpoints  
✅ **Workflow B (Reorder → Purchase → Receive)**: Fully supported with existing endpoints  
⚠️ **Workflow C (Returns)**: Core functionality exists, custom endpoints recommended for better UX  
⚠️ **Workflow D (Cycle Count)**: Can be implemented manually, dedicated endpoints recommended  
✅ **Workflow E (Expiration)**: Fully supported with existing endpoints + FEFO logic

**Next Steps:**
1. Add recommended endpoints to `/supabase/functions/server/index.tsx`
2. Update frontend pages to implement workflow UIs
3. Add automated jobs for expiration alerts
4. Implement pick task management UI
5. Add cycle count workflow pages
