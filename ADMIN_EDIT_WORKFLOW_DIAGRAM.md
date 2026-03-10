# Admin Edit Fulfilled Orders - Visual Workflow

## 🔄 Complete System Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ADMIN EDIT FULFILLED ORDER                       │
│                         Complete Workflow                            │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   ADMIN USER │
│  Signs In    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────┐
│  Navigate to Order List  │
│  or Dashboard            │
└──────────┬───────────────┘
           │
           ▼
     ┌─────────────┐
     │ See Orders  │────────► Orders with edits show "Edited" badge
     │ Fulfilled   │
     └──────┬──────┘
            │
            ▼
     ┌─────────────────┐
     │ Click on Order  │
     │   Details       │
     └──────┬──────────┘
            │
            ▼
┌─────────────────────────────────┐
│  ORDER DETAILS PAGE             │
│                                 │
│  ✓ Shows order info             │
│  ✓ Status: Fulfilled            │
│  ✓ "Edit Order" button visible │────► Admin only!
│    (if admin)                   │
│  ✓ Edit indicator if modified  │
└─────────────┬───────────────────┘
              │
              ▼
       ┌──────────────┐
       │ Click "Edit  │
       │    Order"    │
       └──────┬───────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│         EDIT DIALOG OPENS                   │
│                                             │
│  ⚠️ Warning Messages:                       │
│     - Inventory will be adjusted            │
│     - Changes will be audited               │
│     - Requestor will be notified            │
│                                             │
│  📋 Edit Form:                              │
│     - Item list with quantities             │
│     - Current stock displayed               │
│     - Fulfillment notes editor              │
│     - Validation indicators                 │
└─────────────┬───────────────────────────────┘
              │
              ▼
       ┌──────────────┐
       │ Make Changes │
       │ to Quantities│
       │ and Notes    │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │ Click Update │
       │    Order     │
       └──────┬───────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND PROCESSING                            │
│                                                                  │
│  1. VALIDATE                                                     │
│     ├─ Check user is Admin ✓                                    │
│     ├─ Verify order is fulfilled ✓                              │
│     └─ Validate request data ✓                                  │
│                                                                  │
│  2. REVERSE OLD FULFILLMENT                                      │
│     ├─ For each item in old order:                              │
│     │   ├─ Get stock: stock:{itemId}:{locationId}              │
│     │   ├─ Add back quantities to stock                         │
│     │   │   ├─ onHand += oldQty                                 │
│     │   │   └─ available += oldQty                              │
│     │   └─ Create reversal movement record                      │
│     │       └─ reason: "fulfillment reversal (admin edit)"      │
│                                                                  │
│  3. APPLY NEW FULFILLMENT                                        │
│     ├─ For each item in new order:                              │
│     │   ├─ Get stock: stock:{itemId}:{locationId}              │
│     │   ├─ Deduct quantities from stock                         │
│     │   │   ├─ onHand -= newQty                                 │
│     │   │   └─ available -= newQty                              │
│     │   └─ Create new movement record                           │
│     │       └─ reason: "fulfillment (admin edited)"             │
│                                                                  │
│  4. UPDATE ORDER                                                 │
│     ├─ items = newItems                                         │
│     ├─ fulfillmentNotes = updatedNotes                          │
│     ├─ lastEditedAt = now()                                     │
│     └─ lastEditedBy = admin.id                                  │
│                                                                  │
│  5. AUDIT & NOTIFY                                               │
│     ├─ Create audit log entry                                   │
│     │   ├─ Capture before state                                 │
│     │   ├─ Capture after state                                  │
│     │   └─ Record admin user ID                                 │
│     └─ Send notification to requestor                           │
│         └─ "Your order {id} was modified by admin"              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  Return Success │
                  │  with Updated   │
                  │  Order Data     │
                  └────────┬────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND RESPONSE                             │
│                                                                  │
│  1. Close edit dialog                                           │
│  2. Show success toast                                          │
│  3. Reload order data                                           │
│  4. Display updated information:                                │
│     ├─ New quantities shown                                     │
│     ├─ "Edited" badge appears                                   │
│     ├─ Edit timestamp in header                                 │
│     └─ Admin modification banner in status card                 │
└─────────────────────────────────────────────────────────────────┘

                           │
                           ▼
                  ┌────────────────┐
                  │   COMPLETE!    │
                  │                │
                  │  ✓ Order edited│
                  │  ✓ Stock fixed │
                  │  ✓ Audit logged│
                  │  ✓ User notified│
                  └────────────────┘
```

---

## 📊 Inventory Impact Example

### Scenario: Admin Corrects Fulfillment Quantity

**Original Order**:
- Item: Bandages (SKU: BDG-001)
- Requested: 10 boxes
- Fulfilled: 10 boxes
- Stock before: 50 boxes

**After Original Fulfillment**:
- Stock on hand: 40 boxes (50 - 10)
- Stock available: 40 boxes

**Admin Discovers Error**: Only 8 boxes were actually shipped

**Admin Edit Action**:
- Changes fulfilled quantity from 10 to 8
- Adds note: "Corrected - actual shipment was 8 boxes"

**Backend Processing**:

```
Step 1: Reverse old fulfillment
  ├─ Stock onHand: 40 + 10 = 50
  └─ Stock available: 40 + 10 = 50

Step 2: Apply new fulfillment
  ├─ Stock onHand: 50 - 8 = 42
  └─ Stock available: 50 - 8 = 42

Step 3: Create movement records
  ├─ Movement 1: +10 (reversal)
  └─ Movement 2: -8 (new fulfillment)

Net Effect: +2 boxes back in inventory
```

**After Edit**:
- Stock on hand: 42 boxes (correct!)
- Stock available: 42 boxes
- Order shows: "Last edited on March 4, 2026 at 3:45 PM"
- Requestor notified of change

---

## 🔐 Security Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY CHECKS                           │
└─────────────────────────────────────────────────────────────┘

Request ──► Backend Endpoint
            │
            ▼
      ┌──────────────┐
      │ Check Auth   │──► No session? → 401 Unauthorized
      │ Token        │
      └─────┬────────┘
            │ Valid session
            ▼
      ┌──────────────┐
      │ Get User     │──► User not found? → 401 Unauthorized
      │ Profile      │
      └─────┬────────┘
            │ User found
            ▼
      ┌──────────────┐
      │ Check Role   │──► Not admin? → 403 Forbidden
      │ = Admin?     │
      └─────┬────────┘
            │ Is admin
            ▼
      ┌──────────────┐
      │ Get Order    │──► Order not found? → 404 Not Found
      │              │
      └─────┬────────┘
            │ Order exists
            ▼
      ┌──────────────┐
      │ Check Status │──► Not fulfilled? → 400 Bad Request
      │ = Fulfilled? │
      └─────┬────────┘
            │ Is fulfilled
            ▼
      ┌──────────────┐
      │ ALLOW EDIT   │──► Process the edit request
      └──────────────┘
```

---

## 📝 Audit Trail Structure

```
Audit Log Entry
│
├─ id: "audit-uuid"
├─ type: "order"
├─ entityId: "order-uuid"
├─ action: "update_fulfilled"
├─ userId: "admin-user-uuid"
├─ timestamp: "2026-03-04T15:45:00.000Z"
│
├─ before: {
│    status: "fulfilled",
│    items: [
│      {
│        itemId: "item-uuid",
│        quantityFulfilled: 10
│      }
│    ],
│    fulfillmentNotes: "Original notes"
│  }
│
└─ after: {
     status: "fulfilled",
     items: [
       {
         itemId: "item-uuid",
         quantityFulfilled: 8
       }
     ],
     fulfillmentNotes: "Corrected - actual shipment was 8",
     lastEditedAt: "2026-03-04T15:45:00.000Z",
     lastEditedBy: "admin-user-uuid"
   }
```

---

## 🎯 UI State Flow

```
Order Details Page
│
├─ If user.role === 'admin' && order.status === 'fulfilled'
│  └─ Show "Edit Order" button
│
├─ If order.lastEditedAt exists
│  ├─ Show "Edited" badge in order list
│  ├─ Show edit timestamp in header
│  └─ Show admin modification banner in status card
│
└─ Edit Dialog
   ├─ Load current order items
   ├─ Pre-fill quantities
   ├─ Pre-fill fulfillment notes
   ├─ Show warnings about impact
   ├─ On submit:
   │  ├─ Validate quantities
   │  ├─ Call updateFulfilledOrder() API
   │  ├─ Show loading state
   │  ├─ Handle success/error
   │  └─ Reload order data
   └─ On cancel: Close dialog
```

---

**Diagram Version**: 1.0  
**Last Updated**: March 4, 2026  
**Purpose**: Visual reference for admin edit fulfilled orders workflow
