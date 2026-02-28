# Role Workflows - Enterprise Inventory Management System

## Table of Contents
1. [System Overview](#system-overview)
2. [Administrator](#administrator)
3. [Fulfillment Staff](#fulfillment-staff)
4. [Approver](#approver)
5. [Requestor](#requestor)
6. [Cross-Role Workflows](#cross-role-workflows)

---

## System Overview

This enterprise inventory management system uses a custom session-based authentication system with 24-hour sessions managed through a KV store. The system features four distinct roles, each with specific permissions and responsibilities designed to support comprehensive warehouse operations.

### Authentication
- All users authenticate via login page with email/password
- Sessions are managed via custom `X-Session-Token` header
- Sessions expire after 24 hours of inactivity
- All API calls to `/make-server-5ec3cec0/*` require valid session token

### Key Features
- Item master catalog with SKU search and one-click import
- Bin-level location tracking
- Lot/expiration tracking with FEFO (First Expired, First Out) logic
- Purchase order management
- Multi-level approval workflows
- Cycle count management
- Stock transfer capabilities
- Receiving workflows with put-away
- Comprehensive reporting and analytics
- Real-time notifications

---

## Administrator

### Role Overview
Administrators have full system access and are responsible for overall system configuration, user management, data integrity, and high-level oversight of all warehouse operations.

### Key Responsibilities
- System configuration and maintenance
- User account management
- Master data management (items, locations, vendors)
- Purchase order creation and management
- Advanced reporting and analytics
- Approval of critical workflows
- System security and compliance

### Dashboard Access
- **Home Dashboard**: `/admin`
- Full navigation access to all system modules

### Daily Workflows

#### 1. System Monitoring
**Frequency**: Throughout the day

**Steps**:
1. Navigate to Admin Dashboard (`/admin`)
2. Review key metrics:
   - Total inventory value
   - Active purchase orders
   - Pending approvals
   - Low stock alerts
   - Items approaching expiration
3. Check notification bell for system alerts
4. Review recent activity logs

---

#### 2. User Management
**Frequency**: As needed

**Steps**:
1. Navigate to Settings (`/settings`)
2. Select "User Management" tab
3. To add a new user:
   - Click "Add User" button
   - Enter user details (name, email, role)
   - Assign appropriate role: Admin, Fulfillment, Approver, or Requestor
   - Set initial password
   - Save user
4. To modify existing users:
   - Search for user by name or email
   - Update role or permissions as needed
   - Reset password if requested
5. To deactivate users:
   - Select user
   - Change status to "Inactive"
   - Confirm deactivation

---

#### 3. Item Catalog Management
**Frequency**: As needed

**Steps**:
1. Navigate to Item Catalog (`/catalog`)
2. Switch between Grid/List view for optimal viewing
3. To add new item:
   - Click "Add Item" button
   - Enter item details:
     - SKU (unique identifier)
     - Name and description
     - Category and unit of measure
     - Reorder point and reorder quantity
     - Vendor information
     - Pricing details
   - Alternative: Use "Search SKU" feature to import from UPCitemdb or Open Food Facts
   - Save item
4. To edit existing item:
   - Search for item using filters
   - Click item card or row
   - Update necessary fields
   - Save changes
5. To manage item images:
   - Upload product images via item detail page
   - Images stored in Supabase Storage

---

#### 4. Bin & Location Management
**Frequency**: Weekly or as warehouse layout changes

**Steps**:
1. Navigate to Bins & Locations (`/bins`)
2. To create new bin:
   - Click "Add Bin" button
   - Enter bin details:
     - Bin code (e.g., A-01-A)
     - Zone/warehouse section
     - Bin type (standard, cold, hazmat, etc.)
     - Capacity information
   - Save bin
3. To view bin contents:
   - Click on bin in list view
   - See all items, lots, and quantities in that location
4. To reorganize:
   - Use Stock Transfer workflow to move items between bins
   - Update bin types as needed

---

#### 5. Purchase Order Creation & Management
**Frequency**: Daily or weekly based on inventory levels

**Steps**:
1. Navigate to Purchase Orders (`/purchase-orders`)
2. Review system-generated reorder recommendations
3. To create new PO:
   - Click "Create PO" button
   - Select vendor from dropdown
   - Add line items:
     - Select item from catalog
     - Enter quantity needed
     - Verify unit price
     - Add expected delivery date
   - Review PO totals
   - Add notes or special instructions
   - Submit PO for processing
4. To track existing POs:
   - View all POs in table format
   - Filter by status: Draft, Submitted, Approved, Receiving, Completed
   - Click PO number to view details
   - Check receiving progress
5. To close or cancel PO:
   - Open PO detail page
   - Click "Close" or "Cancel" button
   - Add reason for cancellation
   - Confirm action

---

#### 6. Receiving Workflow Management
**Frequency**: When shipments arrive

**Steps**:
1. When shipment arrives, navigate to Purchase Orders (`/purchase-orders`)
2. Find corresponding PO (use PO# or vendor name)
3. Click "Receive" button
4. Enter receiving details:
   - Confirm quantities received
   - Enter lot numbers
   - Enter expiration dates
   - Note any damages or discrepancies
5. For each line item:
   - Assign to bin location for put-away
   - Use bin picker to select optimal location
   - System suggests locations based on FEFO and available space
6. Submit receiving transaction
7. System automatically:
   - Updates inventory quantities
   - Creates lot records
   - Triggers put-away tasks for Fulfillment team
   - Updates PO status
8. Generate receiving report if needed

---

#### 7. Stock Transfer Approval
**Frequency**: As needed

**Steps**:
1. Navigate to Stock Transfers (`/transfers`)
2. Review pending transfer requests from Fulfillment staff
3. For each transfer:
   - Verify source and destination bins
   - Check quantities
   - Review reason for transfer
4. Approve or reject with comments
5. Monitor transfer completion

---

#### 8. Cycle Count Planning
**Frequency**: Monthly or quarterly

**Steps**:
1. Navigate to Cycle Counts (`/cycle-counts`)
2. Click "Create Cycle Count" button
3. Select count type:
   - Full physical count
   - ABC cycle count
   - Random sample count
   - Location-specific count
4. Configure count parameters:
   - Select bins/zones to count
   - Assign to Fulfillment team member
   - Set due date
5. Submit cycle count task
6. Monitor count progress
7. Review variance reports when complete
8. Approve adjustments or request recounts

---

#### 9. Approval Workflow Management
**Frequency**: Daily

**Steps**:
1. Check notification bell for pending approvals
2. Navigate to Pending Approvals
3. Review internal requests from Requestors:
   - View requested items and quantities
   - Check requestor information
   - Verify business justification
   - Check inventory availability
4. Approve or reject requests:
   - Add approval comments
   - Set fulfillment priority if approved
5. Approved requests automatically create fulfillment tasks
6. Review purchase order approvals if over threshold
7. Review credit/return approvals

---

#### 10. Vendor Management
**Frequency**: As needed

**Steps**:
1. Navigate to Vendors (`/vendors`)
2. To add new vendor:
   - Click "Add Vendor" button
   - Enter vendor details:
     - Vendor name and code
     - Contact information
     - Payment terms
     - Lead times
     - Minimum order quantities
   - Save vendor
3. To manage existing vendors:
   - Update contact information
   - Track vendor performance metrics
   - Review purchase history
   - Manage vendor item catalogs

---

#### 11. Lot & Expiration Management
**Frequency**: Daily or weekly

**Steps**:
1. Navigate to Lot Management (`/lots`)
2. Review lots approaching expiration
3. For items near expiration:
   - Check current location
   - Verify quantity on hand
   - Create internal alert or request
   - Consider markdown or disposal
4. Run FEFO compliance report
5. Audit lot traceability for regulated items

---

#### 12. Advanced Reporting
**Frequency**: Weekly, monthly, or as needed

**Steps**:
1. Navigate to Reports (`/reports`)
2. Select report type:
   - **Inventory Valuation**: Total value by category, location, or vendor
   - **Stock Movement**: Inbound, outbound, and transfer activity
   - **ABC Analysis**: Items ranked by value and velocity
   - **Expiration Report**: Items expiring in next 30/60/90 days
   - **Purchase Order Report**: PO status, vendor performance, lead times
   - **Cycle Count Variance**: Accuracy metrics and discrepancies
   - **Fulfillment Metrics**: Request turnaround time, fill rates
   - **User Activity**: Audit trail by user and date range
3. Configure report parameters:
   - Date range
   - Filters (category, vendor, location, etc.)
   - Sort order
4. Generate report
5. Export to CSV or PDF
6. Share with stakeholders

---

#### 13. Returns & Credits Processing
**Frequency**: As needed

**Steps**:
1. Receive return request from Requestor or external source
2. Review return reason and condition
3. Approve or reject return
4. If approved:
   - Generate return authorization (RA) number
   - Coordinate with Fulfillment for receiving
   - Determine disposition: restock, vendor return, dispose
5. For vendor returns:
   - Create vendor return shipment
   - Track credit status
6. Update inventory once returned item inspected

---

### Permissions Summary
- ✅ Full system access
- ✅ Create, read, update, delete all records
- ✅ User management
- ✅ System configuration
- ✅ All approval authorities
- ✅ Purchase order creation
- ✅ Vendor management
- ✅ Advanced reporting
- ✅ Data export capabilities

---

## Fulfillment Staff

### Role Overview
Fulfillment staff are responsible for day-to-day warehouse operations including receiving, put-away, picking, packing, cycle counts, and stock transfers. They execute the physical work of inventory management.

### Key Responsibilities
- Order fulfillment (picking and packing)
- Receiving and put-away operations
- Stock transfers between bins
- Cycle count execution
- Physical inventory management
- Bin-level accuracy maintenance

### Dashboard Access
- **Home Dashboard**: `/fulfillment`
- Access to operational modules

### Daily Workflows

#### 1. Morning Setup & Task Review
**Frequency**: Daily at shift start

**Steps**:
1. Log in to system
2. Navigate to Fulfillment Dashboard (`/fulfillment`)
3. Review daily priorities:
   - Pending fulfillment orders (approved internal requests)
   - Scheduled cycle counts
   - Put-away tasks from recent receiving
   - Pending stock transfers
4. Check notification bell for urgent tasks
5. Note any high-priority or time-sensitive orders

---

#### 2. Internal Request Fulfillment (Picking)
**Frequency**: Continuous throughout shift

**Steps**:
1. From Dashboard, click on pending order
2. Review order details:
   - Requestor name and department
   - Items and quantities needed
   - Delivery location
   - Priority level
3. Generate pick list
4. For each item on pick list:
   - System shows optimal bin location (FEFO logic)
   - Navigate to bin location
   - Verify item SKU and lot number
   - Pick quantity needed
   - Scan barcode if available
   - Update system with actual quantity picked
5. If item not available in suggested bin:
   - Check alternate locations
   - Note discrepancy for cycle count
6. Stage picked items in packing area
7. Pack items securely for internal delivery
8. Update order status to "Packed"
9. Deliver to requestor or staging area
10. Mark order as "Completed"
11. System automatically decrements inventory

---

#### 3. Receiving & Put-Away Workflow
**Frequency**: When shipments arrive

**Steps**:
1. Receive notification of incoming shipment
2. Navigate to Purchase Orders (`/purchase-orders`)
3. Locate corresponding PO
4. Click "Start Receiving"
5. Physical receiving:
   - Count quantities received
   - Inspect for damage or defects
   - Verify SKUs match PO
   - Note discrepancies (over/under shipments)
6. Enter receiving data into system:
   - Actual quantities received
   - Lot numbers from packaging
   - Expiration dates (if applicable)
   - Condition notes
   - Photos of any damage
7. System generates put-away task
8. For each item:
   - Review suggested bin location
   - System prioritizes based on:
     - FEFO rules (earlier expiry dates)
     - Available bin capacity
     - Item velocity (fast movers near shipping)
   - Transport item to assigned bin
   - Place item in bin
   - Update system confirming put-away
   - Scan bin barcode if available
9. Complete receiving transaction
10. System automatically:
    - Updates inventory quantities
    - Creates lot records
    - Updates PO status to "Received"

---

#### 4. Stock Transfer Execution
**Frequency**: As needed

**Steps**:
1. Navigate to Stock Transfers (`/transfers`)
2. To create new transfer:
   - Click "Create Transfer" button
   - Select item and lot
   - Enter source bin location
   - Enter destination bin location
   - Specify quantity to transfer
   - Add reason (replenishment, consolidation, relocation, etc.)
   - Submit transfer request
3. To execute approved transfer:
   - View approved transfer from list
   - Go to source bin location
   - Pick specified quantity
   - Verify lot number
   - Transport to destination bin
   - Place items in destination
   - Complete transfer in system
4. System automatically updates bin quantities
5. Reasons for transfers:
   - Bin consolidation
   - Replenishment to primary pick location
   - Reorganization/slotting optimization
   - Quarantine or hold items
   - Prepare for shipment

---

#### 5. Cycle Count Execution
**Frequency**: Per assigned schedule (daily, weekly, or monthly)

**Steps**:
1. Navigate to Cycle Counts (`/cycle-counts`)
2. View assigned cycle count tasks
3. Select cycle count to perform
4. Review scope:
   - Bins to count
   - Items to count
   - Due date
5. Print count sheet or use mobile device
6. For each location:
   - Go to physical bin location
   - Count all items in bin
   - Record each item:
     - SKU
     - Lot number
     - Quantity on hand
     - Condition notes
   - Enter counts into system
7. System compares actual vs. system quantities
8. If variances detected:
   - Review discrepancies
   - Perform recount if significant
   - Add comments explaining variance
9. Submit completed count
10. Admin reviews and approves adjustments
11. System updates inventory quantities after approval

---

#### 6. Item Search & Lookup
**Frequency**: Throughout shift as needed

**Steps**:
1. Navigate to Item Catalog (`/catalog`)
2. Use search and filter:
   - Search by SKU, name, or description
   - Filter by category
   - Toggle Grid/List view
3. Click item to view details:
   - Current stock level
   - All bin locations
   - All lot numbers and expiration dates
   - Recent transaction history
4. Use this information to:
   - Locate items for picking
   - Answer requestor questions
   - Verify inventory accuracy

---

#### 7. Lot Tracking & FEFO Compliance
**Frequency**: During all picking operations

**Steps**:
1. When picking items with expiration dates:
   - System automatically shows lots in FEFO order
   - Always pick from earliest expiration date first
2. Navigate to Lot Management (`/lots`) to:
   - View all lots for an item
   - Check expiration dates
   - Identify lots approaching expiration
3. Flag items nearing expiration:
   - Create note in system
   - Notify Admin for disposition
4. Ensure FEFO compliance in put-away:
   - Place newer lots behind older lots
   - Update system with precise lot locations

---

#### 8. Problem Resolution
**Frequency**: As issues arise

**Steps**:
1. **Inventory Discrepancies**:
   - If item not found in expected location
   - Search alternate bins
   - Check recent transactions
   - Create cycle count task for that location
   - Notify Admin if unable to locate

2. **Damaged Items**:
   - Quarantine damaged items
   - Create transfer to "Damaged" bin
   - Take photos
   - Update system with damage notes
   - Notify Admin for disposition

3. **Receiving Discrepancies**:
   - Document over/short quantities
   - Photo evidence of damage
   - Complete receiving with actual quantities
   - Add detailed notes in system
   - Admin handles vendor communication

---

#### 9. End of Shift Procedures
**Frequency**: End of each shift

**Steps**:
1. Review all assigned tasks:
   - Ensure all picks are completed or noted
   - Verify all put-aways finished
   - Close out cycle counts
2. Update any pending transfers
3. Note any incomplete tasks and reason
4. Log out of system

---

### Permissions Summary
- ✅ View item catalog
- ✅ View and update stock levels
- ✅ Execute receiving transactions
- ✅ Create and execute stock transfers (subject to approval for some transfers)
- ✅ Execute cycle counts
- ✅ Fulfill approved internal requests
- ✅ Update bin-level inventory
- ✅ View purchase orders (receiving context)
- ✅ Access to operational reports
- ❌ Cannot create users
- ❌ Cannot approve requests or POs
- ❌ Cannot create purchase orders
- ❌ Cannot modify item master data
- ❌ Cannot manage vendors

---

## Approver

### Role Overview
Approvers are responsible for reviewing and approving internal inventory requests from Requestors. They ensure that requests are justified, inventory is available, and business rules are followed. Approvers may be department managers, budget owners, or designated procurement staff.

### Key Responsibilities
- Review internal inventory requests
- Approve or reject requests with justification
- Ensure budget compliance
- Verify business need
- Prioritize approved requests

### Dashboard Access
- **Home Dashboard**: `/approver`
- Limited navigation focused on approval workflows

### Daily Workflows

#### 1. Dashboard Review
**Frequency**: Multiple times daily

**Steps**:
1. Log in and navigate to Approver Dashboard (`/approver`)
2. Review key metrics:
   - Number of pending approvals
   - Total value of pending requests
   - Recently approved requests
   - Fulfillment status of approved requests
3. Check notification bell for new approval requests
4. Review any urgent or time-sensitive requests

---

#### 2. Internal Request Approval Workflow
**Frequency**: As requests are submitted

**Steps**:
1. Navigate to Pending Approvals (`/approvals`)
2. View list of requests awaiting approval:
   - Sorted by submission date (oldest first)
   - Filter by requestor, date range, or value
3. Click on a request to review details:
   - **Requestor Information**:
     - Name and department
     - Contact information
   - **Request Details**:
     - List of items requested
     - Quantities for each item
     - Total estimated value
     - Business justification/reason
     - Delivery location
     - Requested delivery date
   - **Inventory Availability**:
     - Current stock levels
     - Available quantity
     - Backorder status if insufficient
4. Review business justification:
   - Is the request reasonable?
   - Is it within budget guidelines?
   - Is inventory available?
   - Is quantity appropriate?
5. Make approval decision:
   - **To Approve**:
     - Click "Approve" button
     - Add approval comments (optional)
     - Set priority level:
       - High (urgent, same-day fulfillment)
       - Normal (standard 1-2 day fulfillment)
       - Low (fulfill when convenient)
     - Submit approval
   - **To Reject**:
     - Click "Reject" button
     - **Must** add rejection reason:
       - Out of budget
       - Inventory not available
       - Insufficient justification
       - Duplicate request
       - Other (explain)
     - Submit rejection
   - **To Request More Information**:
     - Add comment asking for clarification
     - Request is held in "Pending" status
     - Requestor receives notification
6. System automatically:
   - Notifies requestor of decision
   - If approved: Creates fulfillment task for Fulfillment team
   - If rejected: Returns request to requestor with explanation
   - Updates request status in audit trail

---

#### 3. Monitoring Approved Requests
**Frequency**: Daily

**Steps**:
1. From Dashboard, view "Recently Approved" section
2. Click to see approved request details
3. Monitor fulfillment status:
   - Approved (awaiting fulfillment)
   - In Progress (being picked)
   - Packed (ready for delivery)
   - Completed (delivered)
4. If approved request is delayed:
   - Check with Fulfillment team
   - Investigate inventory issues
   - Communicate with requestor
5. Review completed requests for record-keeping

---

#### 4. Browse Catalog (Self-Service)
**Frequency**: As needed

**Steps**:
1. Navigate to Browse Catalog (`/catalog`)
2. Search for items:
   - Use search bar for SKU or name
   - Use category filters
   - Toggle Grid/List view
3. View item details:
   - Current availability
   - Pricing information
   - Description and specifications
4. Can also use this to verify inventory for approval decisions

---

#### 5. Submit Own Requests (Shopping Cart)
**Frequency**: As needed

**Steps**:
1. Navigate to My Cart (`/cart`)
2. Add items to cart:
   - Search catalog
   - Click "Add to Cart"
   - Specify quantity needed
3. Review cart:
   - Verify items and quantities
   - Check total estimated value
   - Add delivery location
4. Add business justification
5. Submit request
6. **Note**: As an Approver, you cannot approve your own requests
   - Your request requires approval from Admin or another Approver
   - This prevents self-approval and maintains audit trail

---

#### 6. Reporting & Analysis
**Frequency**: Weekly or monthly

**Steps**:
1. Review approval patterns:
   - Average approval time
   - Approval vs. rejection rate
   - Top requestors
   - Most requested items
2. Use insights to:
   - Identify training needs
   - Optimize approval policies
   - Forecast inventory needs
   - Improve request guidelines

---

### Permissions Summary
- ✅ View and approve/reject internal requests
- ✅ View item catalog (read-only)
- ✅ Submit own inventory requests
- ✅ View approval history and reports
- ✅ Set fulfillment priority for approved requests
- ❌ Cannot manage users
- ❌ Cannot access warehouse operations (receiving, transfers, cycle counts)
- ❌ Cannot create purchase orders
- ❌ Cannot modify inventory quantities
- ❌ Cannot approve own requests
- ❌ Cannot manage vendors or bins
- ❌ Limited reporting access

---

## Requestor

### Role Overview
Requestors are end users who need inventory items for their work. They browse the catalog, submit internal requests for items, and track their request status. This is the most common role for general employees.

### Key Responsibilities
- Browse item catalog
- Submit internal inventory requests
- Track request status
- Receive approved items

### Dashboard Access
- **Home Dashboard**: `/requestor`
- Minimal navigation focused on browsing and requesting

### Daily Workflows

#### 1. Dashboard Review
**Frequency**: When checking request status

**Steps**:
1. Log in and navigate to Requestor Dashboard (`/requestor`)
2. View personal request summary:
   - Active requests (pending approval or fulfillment)
   - Recent completed requests
   - Request history
3. Check notification bell for:
   - Approval decisions
   - Fulfillment updates
   - Delivery confirmations

---

#### 2. Browse Item Catalog
**Frequency**: When searching for items to request

**Steps**:
1. Navigate to Browse Catalog (`/catalog`)
2. Browse available items:
   - View all items in Grid or List view
   - Use category filters to narrow search
   - Use search bar to find specific items by:
     - SKU
     - Item name
     - Keywords in description
3. Click on item card to view details:
   - Full item description
   - Technical specifications
   - Current availability status
   - Estimated delivery time
   - Item image (if available)
4. Identify items needed for request

---

#### 3. Create Internal Request (Shopping Cart Workflow)
**Frequency**: As items are needed

**Steps**:
1. Navigate to My Cart (`/cart`)
2. Add items to cart:
   - From catalog, click "Add to Cart" button
   - Or search for item directly in cart page
3. For each item in cart:
   - Adjust quantity as needed
   - Verify item details
4. Review cart contents:
   - Verify all items are correct
   - Check total quantity
5. Enter request details:
   - **Delivery Location**: Where items should be delivered
     - Office location
     - Department
     - Room number
   - **Business Justification**: Why items are needed
     - Be specific and clear
     - Examples:
       - "Monthly office supply replenishment for HR department"
       - "Materials for client presentation on 3/15"
       - "Replacement for damaged equipment"
       - "New employee onboarding supplies"
   - **Requested Delivery Date**: When items are needed by
6. Submit request
7. System creates request and notifies Approver
8. Receive confirmation with request number

---

#### 4. Track Request Status
**Frequency**: After submitting requests

**Steps**:
1. From Dashboard or Notifications, view request status:
   - **Pending Approval**: Awaiting approver review
   - **Approved**: Approved and queued for fulfillment
   - **In Progress**: Fulfillment team is picking items
   - **Packed**: Items ready for delivery
   - **Completed**: Items delivered
   - **Rejected**: Request denied (see reason)
2. Click on request to view details:
   - All items and quantities
   - Current status
   - Approval decision and comments
   - Fulfillment progress
   - Estimated delivery
3. If request is rejected:
   - Review rejection reason
   - Make necessary changes
   - Resubmit if appropriate
4. If request is delayed:
   - Check status notes
   - Contact Approver or Fulfillment if needed

---

#### 5. Receive Items
**Frequency**: When items are delivered

**Steps**:
1. Receive notification that items are delivered
2. Physically receive items at delivery location
3. Verify items received:
   - Check items match request
   - Verify quantities
   - Inspect for damage
4. If there are issues:
   - Report short shipments
   - Report damaged items
   - Contact Fulfillment team via notification or Admin
5. Acknowledge receipt in system (if implemented)
6. Store items appropriately

---

#### 6. Request History & Reordering
**Frequency**: As needed

**Steps**:
1. From Dashboard, view request history
2. See all past requests:
   - Date submitted
   - Items requested
   - Approval status
   - Delivery date
3. To reorder same items:
   - Click on previous request
   - Select "Reorder" or "Copy to Cart"
   - Adjust quantities if needed
   - Update justification and delivery date
   - Submit new request

---

#### 7. Internet SKU Search (One-Click Import)
**Frequency**: When requesting items not in catalog

**Steps**:
1. Navigate to Browse Catalog (`/catalog`)
2. Click "Search SKU" button
3. Enter SKU, UPC, or barcode number
4. System searches external databases:
   - UPCitemdb.com
   - Open Food Facts
5. Review search results:
   - Item name
   - Description
   - Category
   - Image (if available)
6. Click "Import" to add to catalog
7. Item becomes available for immediate request
8. Add imported item to cart and submit request

**Note**: One-click import feature allows requestors to request new items without waiting for Admin to add them to catalog. Admin can later enhance item details.

---

### Permissions Summary
- ✅ View item catalog (read-only)
- ✅ Submit internal inventory requests
- ✅ View own request history and status
- ✅ Add items to cart and checkout
- ✅ Search external SKU databases and import items
- ✅ Receive notifications about own requests
- ❌ Cannot view other users' requests
- ❌ Cannot approve requests
- ❌ Cannot access warehouse operations
- ❌ Cannot view or modify inventory quantities
- ❌ Cannot create purchase orders
- ❌ Cannot access admin functions
- ❌ No access to system reports
- ❌ Cannot manage users or system settings

---

## Cross-Role Workflows

These workflows involve multiple roles working together to complete business processes.

### Workflow A: Internal Request → Approval → Fulfillment

**Purpose**: Process internal requests for inventory items from employees

**Roles Involved**: Requestor → Approver → Fulfillment Staff

#### Step-by-Step Process

**1. Request Creation (Requestor)**
- Requestor logs in and browses catalog
- Adds items to cart
- Enters delivery location and business justification
- Submits request
- Receives request confirmation with request number

**2. Approval Review (Approver)**
- Approver receives notification of new request
- Reviews request details, inventory availability, and justification
- Makes decision:
  - If approved: Sets priority level and adds comments
  - If rejected: Provides detailed rejection reason
- System notifies Requestor of decision

**3. Fulfillment Execution (Fulfillment Staff)**
- Fulfillment receives approved request in task queue
- Generates pick list with bin locations (FEFO optimized)
- Picks items from warehouse bins
- Packs items for delivery
- Delivers to requestor location
- Marks request as completed

**4. Completion & Receipt (Requestor)**
- Requestor receives items
- Verifies items and quantities
- Reports any issues
- Request marked complete in system

**Timeline**: Typically 1-3 business days depending on priority

---

### Workflow B: Reorder → Purchase → Receive → Put-Away

**Purpose**: Replenish inventory when stock levels reach reorder points

**Roles Involved**: Admin → Vendor → Fulfillment Staff → Admin

#### Step-by-Step Process

**1. Reorder Identification (Admin)**
- Admin monitors inventory levels via dashboard
- System flags items below reorder point
- Reviews reorder recommendations
- Verifies need based on:
  - Current stock level
  - Pending orders
  - Historical usage
  - Upcoming needs

**2. Purchase Order Creation (Admin)**
- Admin navigates to Purchase Orders
- Creates new PO
- Selects vendor
- Adds line items with quantities
- Verifies pricing and terms
- Adds expected delivery date
- Submits PO to vendor
- System sends PO to vendor (if integrated) or admin emails manually

**3. Vendor Processing (External Vendor)**
- Vendor receives and acknowledges PO
- Prepares shipment
- Ships items with packing slip
- Provides tracking information

**4. Receiving (Fulfillment Staff)**
- Fulfillment notified of incoming shipment
- Locates PO in system
- Physically receives shipment
- Counts and inspects items
- Enters receiving data:
  - Actual quantities
  - Lot numbers
  - Expiration dates
  - Condition notes
- System updates PO status to "Received"

**5. Put-Away (Fulfillment Staff)**
- System generates put-away task
- Reviews suggested bin locations (FEFO optimized)
- Transports items to assigned bins
- Places items in bins
- Updates system confirming put-away
- System updates inventory quantities and creates lot records

**6. Verification (Admin)**
- Admin reviews completed receiving
- Verifies all items accounted for
- Investigates any discrepancies
- Closes PO in system
- Archives documentation

**Timeline**: Varies by vendor lead time (typically 3-14 days)

---

### Workflow C: Returns / Exchanges / Credits

**Purpose**: Process returns of items, either internal returns or returns to vendors

**Roles Involved**: Requestor/Fulfillment → Admin → Fulfillment Staff → (Vendor)

#### Internal Return Process

**1. Return Initiation (Requestor or Fulfillment)**
- User determines item needs to be returned:
  - No longer needed
  - Wrong item received
  - Damaged or defective
- Contacts Admin via notification or email
- Provides return details:
  - Original request number
  - Items to return
  - Quantity
  - Reason for return
  - Item condition

**2. Return Authorization (Admin)**
- Admin reviews return request
- Verifies original transaction
- Approves or denies return
- If approved:
  - Creates return authorization (RA) number
  - Provides instructions for return
  - Assigns disposition:
    - Restock to inventory
    - Return to vendor
    - Dispose/scrap
    - Quarantine for inspection

**3. Return Processing (Fulfillment Staff)**
- Receives physical item from requestor
- Inspects item condition
- Matches to RA number
- Based on disposition:
  - **Restock**: Put-away to appropriate bin, update lot if needed
  - **Vendor Return**: Set aside for vendor return shipment
  - **Dispose**: Document and remove from inventory
  - **Quarantine**: Transfer to hold bin for Admin review
- Updates system with actual return
- System adjusts inventory quantities

**4. Completion (Admin)**
- Reviews completed return
- Closes RA in system
- Archives documentation

#### Vendor Return Process

**1. Vendor Return Initiation (Admin)**
- Admin determines item needs vendor return:
  - Damaged/defective items
  - Overshipment
  - Wrong items received
- Contacts vendor for RMA (Return Merchandise Authorization)
- Creates vendor return record in system

**2. Return Shipment (Fulfillment Staff)**
- Gathers items for return
- Packages securely
- Includes vendor RMA documentation
- Ships to vendor
- Updates system with tracking info

**3. Credit Processing (Admin)**
- Monitors vendor credit status
- Receives credit memo or replacement
- Updates vendor records
- If replacement received: Follow receiving workflow
- Closes vendor return in system

**Timeline**: Internal returns 1-3 days; vendor returns 2-6 weeks

---

### Workflow D: Cycle Count

**Purpose**: Verify physical inventory matches system records and maintain accuracy

**Roles Involved**: Admin → Fulfillment Staff → Admin

#### Step-by-Step Process

**1. Cycle Count Planning (Admin)**
- Admin navigates to Cycle Counts
- Creates new cycle count task
- Configures parameters:
  - Select count type:
    - Full warehouse count
    - ABC cycle count (high-value items)
    - Random sample count
    - Specific bins/zones
    - Item-specific count
  - Select bins/items to count
  - Assign to Fulfillment team member
  - Set due date
  - Add special instructions
- Submits cycle count task
- System notifies assigned Fulfillment staff

**2. Count Preparation (Fulfillment Staff)**
- Reviews cycle count assignment
- Notes scope and due date
- Prints count sheets or prepares mobile device
- Plans route through warehouse for efficiency
- Ensures counting tools ready (barcode scanner, clipboard, etc.)

**3. Physical Count Execution (Fulfillment Staff)**
- Goes to each assigned location
- For each bin:
  - Physically counts all items
  - Records for each item:
    - SKU
    - Lot number (if applicable)
    - Quantity on hand
    - Condition notes (damage, disorganization, etc.)
  - Enters counts into system as they go or at end
- Does NOT reference system quantities during count (blind count for accuracy)
- Completes all assigned locations
- Marks cycle count as "Count Complete" in system

**4. Variance Review (Admin)**
- System calculates variances (actual vs. system)
- Admin reviews variance report:
  - Items with differences
  - Amount of variance
  - Variance value
  - Location information
- For significant variances:
  - May request recount
  - Investigates root cause:
    - Data entry errors
    - Picking errors
    - Theft/shrinkage
    - Receiving errors
    - Process issues
- Adds notes to variance report

**5. Adjustment Approval (Admin)**
- Admin approves inventory adjustments
- System updates inventory quantities to match physical count
- Creates audit trail of adjustment
- Lot records updated if needed
- Bin quantities updated

**6. Follow-Up Actions (Admin)**
- Reviews cycle count accuracy metrics
- Identifies problem locations or items
- Implements corrective actions:
  - Additional training
  - Process improvements
  - More frequent counts for problem areas
  - Bin reorganization
- Documents lessons learned
- Schedules next cycle count

**Frequency**: 
- High-value items (A): Monthly
- Medium-value items (B): Quarterly  
- Low-value items (C): Annually
- Problem locations: As needed

**Timeline**: Small counts 1-2 hours; full warehouse counts 1-3 days

---

### Workflow E: Expiration Management (FEFO)

**Purpose**: Ensure items with expiration dates are used before they expire, minimizing waste and maintaining safety/compliance

**Roles Involved**: Admin → Fulfillment Staff → Approver/Requestor

**FEFO = First Expired, First Out**: Always use items with earliest expiration date first

#### Step-by-Step Process

**1. Expiration Monitoring (Admin)**
- Admin navigates to Lot Management or runs Expiration Report
- System shows items expiring in next 30/60/90 days
- Reviews upcoming expirations:
  - Item name and SKU
  - Lot number
  - Expiration date
  - Quantity on hand
  - Current location
  - Days until expiration
- Prioritizes items by urgency and value

**2. Action Planning (Admin)**
- For items nearing expiration, determines action:
  - **30+ days**: Normal priority, promote usage
  - **15-30 days**: High priority, aggressive promotion
  - **< 15 days**: Urgent, consider markdown or disposal
  - **Expired**: Immediate removal required
- Creates action plan per item:
  - Promote to internal users
  - Discount pricing (if applicable)
  - Return to vendor (if allowed)
  - Donate (if appropriate)
  - Dispose/destroy (last resort)

**3. Internal Promotion (Admin)**
- Sends notification to all users:
  - "Items expiring soon - request now"
  - List of items with expiration dates
  - Encourages requests for items nearing expiration
- May create special "expiring soon" section in catalog
- Contacts departments likely to use items

**4. FEFO-Optimized Fulfillment (Fulfillment Staff)**
- When picking items with expiration dates:
  - System automatically shows lots in FEFO order (earliest expiration first)
  - ALWAYS picks from earliest expiration lot first
  - Only picks from later lots if earlier lots exhausted
- When receiving new stock:
  - Enters expiration dates accurately
  - System assigns bin locations:
    - Newer lots go to back or different bin
    - Ensures older lots picked first
  - Physical put-away matches system logic

**5. Physical FEFO Management (Fulfillment Staff)**
- Organizes warehouse for FEFO:
  - Older lots in front, newer lots in back
  - Clear lot labels visible
  - Expiration dates marked prominently
- During put-away:
  - Places items behind existing stock
  - Rotates stock physically
  - Verifies lot order matches FEFO

**6. Expiration Response (Admin + Fulfillment)**
- For items reaching critical expiration:
  - **Option 1 - Vendor Return**: 
    - Contact vendor for return authorization
    - Follow vendor return workflow
    - Coordinate with Fulfillment for return shipment
  - **Option 2 - Donation**:
    - Coordinate with approved charity/donation program
    - Ensure items still safe and usable
    - Document donation for records
    - Fulfillment packages and ships
  - **Option 3 - Disposal**:
    - Follow proper disposal procedures (especially for regulated items)
    - Document disposal for compliance
    - Fulfillment removes items from inventory
    - Take photos for documentation
- System updates inventory:
  - Removes expired lot from system
  - Documents disposal method
  - Creates audit trail

**7. Compliance & Reporting (Admin)**
- Runs regular expiration compliance reports:
  - No expired items in sellable inventory
  - FEFO adherence rate
  - Items removed before expiration
  - Value of expired items (waste metric)
- Reviews metrics to improve:
  - Reorder quantities (don't over-order)
  - Lead times
  - Internal promotion efforts
  - FEFO process compliance
- Documents for regulatory compliance (especially for food, pharma, chemicals)

**Critical Rules**:
- ❌ **NEVER** pick from a later expiration lot if earlier lot available
- ❌ **NEVER** allow expired items to remain in active inventory
- ✅ **ALWAYS** enter accurate expiration dates during receiving
- ✅ **ALWAYS** verify lot numbers during picking
- ✅ **ALWAYS** rotate stock during put-away (old in front)

**Special Considerations**:
- **Food items**: Strict FEFO, health code compliance
- **Pharmaceuticals**: Regulatory requirements, documentation critical
- **Chemicals**: Safety requirements, proper disposal
- **Cosmetics**: Quality concerns, batch tracking
- **Medical supplies**: Patient safety, traceability

**Timeline**: Continuous monitoring; daily for critical items

---

## Quick Reference: Role Comparison Matrix

| Capability | Admin | Fulfillment | Approver | Requestor |
|-----------|-------|-------------|----------|-----------|
| View Catalog | ✅ Full | ✅ Full | ✅ Read-only | ✅ Read-only |
| Edit Items | ✅ | ❌ | ❌ | ❌ |
| Submit Requests | ✅ | ✅ | ✅ | ✅ |
| Approve Requests | ✅ | ❌ | ✅ | ❌ |
| Fulfill Orders | ✅ | ✅ | ❌ | ❌ |
| Create POs | ✅ | ❌ | ❌ | ❌ |
| Receive Stock | ✅ | ✅ | ❌ | ❌ |
| Stock Transfers | ✅ | ✅ | ❌ | ❌ |
| Cycle Counts | ✅ (Assign) | ✅ (Execute) | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| Manage Bins | ✅ | ❌ | ❌ | ❌ |
| Manage Vendors | ✅ | ❌ | ❌ | ❌ |
| Advanced Reports | ✅ | ✅ (Limited) | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ | ❌ |

---

## System Features Summary

### Notifications
All roles receive real-time notifications via the notification bell icon in top navigation:
- **Requestor**: Request approval status, fulfillment updates, delivery confirmations
- **Approver**: New requests awaiting approval, requestor responses
- **Fulfillment**: New fulfillment tasks, receiving notifications, cycle count assignments
- **Admin**: All system alerts, approvals needed, low stock alerts, expiration warnings, variance reports

### Internet SKU Search
All roles can search external databases (UPCitemdb.com, Open Food Facts) to find and import new items to the catalog with one click. Imported items include name, description, category, and image when available.

### View Modes
Item Catalog supports both Grid and List views. Users can toggle between views for optimal browsing experience.

### Session Management
- All users authenticate with email/password
- Sessions last 24 hours
- Sessions managed via custom `X-Session-Token` header
- Automatic logout after 24 hours or manual logout

### Mobile Responsive
System is fully responsive and works on tablets and mobile devices for on-the-go warehouse operations.

---

## Best Practices

### For All Users
1. **Log out** when finished or when leaving workstation
2. **Double-check** all data entries before saving
3. **Add comments** to transactions for audit trail
4. **Report issues** immediately via notifications or to admin
5. **Verify** physical items match system data

### For Requestors
1. Provide **clear business justification** for all requests
2. **Plan ahead** - submit requests with adequate lead time
3. Only request **quantities actually needed**
4. **Check availability** before submitting large requests
5. **Inspect items** when received and report issues promptly

### For Approvers
1. Review requests **promptly** (within 24 hours)
2. Provide **clear rejection reasons** if denying
3. Set appropriate **priority levels** for time-sensitive requests
4. **Verify inventory availability** before approving
5. **Communicate** with requestors when more information needed

### For Fulfillment Staff
1. **Always follow FEFO** rules for items with expiration dates
2. **Update system immediately** after physical transactions
3. **Report variances** discovered during picking
4. **Keep bins organized** and clearly labeled
5. **Double-check** quantities during receiving and cycle counts
6. **Verify lot numbers** during picking

### For Administrators
1. **Review dashboards daily** for alerts and issues
2. **Monitor expiration reports weekly**
3. **Schedule cycle counts** regularly
4. **Train users** on proper system usage
5. **Audit transactions** regularly for compliance
6. **Maintain vendor relationships** for reliable supply chain
7. **Optimize reorder points** based on usage patterns
8. **Document** process improvements and system changes

---

## Troubleshooting Common Issues

### Login Issues
- **Symptom**: Cannot log in, session expired
- **Solution**: 
  - Verify email and password
  - Sessions expire after 24 hours - log in again
  - Contact Admin if account locked or password forgotten

### Inventory Discrepancy
- **Symptom**: Item not found in expected location, quantity doesn't match system
- **Solution**:
  - Check alternate bins for the item
  - Review recent transaction history
  - Create cycle count task for that location
  - Notify Admin for investigation

### Request Stuck in Pending
- **Symptom**: Request not approved or fulfilled after several days
- **Solution**:
  - Check notifications for approver feedback
  - Contact Approver for status update
  - Verify inventory availability
  - Admin can investigate workflow bottleneck

### Cannot Add Item to Cart
- **Symptom**: Item appears in catalog but won't add to cart
- **Solution**:
  - Check if item is marked as inactive
  - Verify user has permission to request items
  - Clear browser cache and retry
  - Contact Admin if issue persists

### FEFO Not Working
- **Symptom**: System showing wrong lot order for picking
- **Solution**:
  - Verify expiration dates entered correctly
  - Check lot creation dates
  - Report to Admin for system check
  - Manually verify FEFO order and pick correctly

### Receiving Error
- **Symptom**: Cannot complete receiving transaction
- **Solution**:
  - Verify PO exists and is in correct status
  - Check all required fields completed (lots, expiration dates)
  - Verify quantities are positive numbers
  - Check bin assignments are valid
  - Contact Admin if error persists

---

## Glossary

- **Bin**: Physical storage location in warehouse (e.g., A-01-A)
- **Cycle Count**: Periodic physical count of inventory to verify accuracy
- **FEFO**: First Expired, First Out - pick items with earliest expiration first
- **Fulfillment**: Process of picking, packing, and delivering requested items
- **KV Store**: Key-Value store database for session management
- **Lot**: Batch of items received together with same expiration date
- **PO**: Purchase Order - document authorizing purchase from vendor
- **Put-away**: Process of moving received items to storage locations
- **RA**: Return Authorization - approval to return items
- **Reorder Point**: Inventory level that triggers replenishment
- **RMA**: Return Merchandise Authorization - vendor approval for return
- **SKU**: Stock Keeping Unit - unique identifier for each item
- **Stock Transfer**: Moving inventory between bin locations
- **Variance**: Difference between physical count and system quantity

---

## Support & Contact

For technical issues, workflow questions, or system enhancements, contact your System Administrator.

**System Information**:
- Authentication: Custom session-based with 24-hour tokens
- Database: Supabase with KV store
- Session Management: X-Session-Token header
- API Base: `/make-server-5ec3cec0/*`

---

**Document Version**: 1.0  
**Last Updated**: February 21, 2026  
**System**: Enterprise Inventory Management System  
**Organization**: SHC Inventory

---

*This document is confidential and intended for authorized users only.*