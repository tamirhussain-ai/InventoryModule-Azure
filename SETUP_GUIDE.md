# SHC Inventory Management System - Setup Guide

## Overview
This is a fully functional enterprise inventory management system designed for healthcare organizations like Stanford Health Care (SHC). It includes role-based access control, comprehensive order workflows, stock tracking, approval processes, and extensive reporting capabilities.

## Quick Start

### 1. Create Initial Admin User
Start by signing up with an admin account:
- Navigate to `/signup`
- Fill in the form:
  - **Name:** Admin User
  - **Email:** admin@example.com
  - **Password:** password123
  - **Role:** Admin (Financial Operations)
  - **Department:** Financial Operations

### 2. Create Additional Users
Create test users for different roles:

**Fulfillment User:**
- Name: Fulfillment Staff
- Email: fulfillment@example.com
- Password: password123
- Role: Fulfillment (Inventory Admin)
- Department: Inventory Operations

**Approver User:**
- Name: Department Approver
- Email: approver@example.com
- Password: password123
- Role: Approver
- Department: Medical

**Requestor User:**
- Name: Regular User
- Email: requestor@example.com
- Password: password123
- Role: Requestor (Regular User)
- Department: CAPS

### 3. Initial Configuration (Admin)

#### Create Categories
1. Navigate to Settings → Categories
2. Add categories:
   - Medical Supplies
   - Pharmaceuticals
   - Office Supplies
   - PT Equipment
   - CAPS Materials

#### Create Locations
1. Navigate to Settings → Locations
2. Add locations:
   - Main Storeroom (storeroom)
   - Clinic Supply Closet (clinic)
   - Pharmacy Storage (pharmacy)
   - PT Supply Room (clinic)

#### Add Inventory Items
1. Navigate to Item Catalog
2. Click "Add Item"
3. Example items to create:
   - **Surgical Gloves** (Medical Supplies, 100 units, reorder at 20)
   - **Aspirin 100mg** (Pharmaceuticals, 500 units, reorder at 100)
   - **Bandages** (Medical Supplies, 200 units, reorder at 40)
   - **Office Paper** (Office Supplies, 50 reams, reorder at 10)

#### Receive Initial Stock
1. Navigate to Stock Management
2. Click "Receive Stock"
3. Add stock for each item created

## User Workflows

### Requestor Workflow
1. Sign in as requestor
2. Browse catalog
3. Add items to cart
4. Submit order with delivery details
5. Track order status

### Approver Workflow
1. Sign in as approver
2. View pending approvals
3. Review order details
4. Approve or deny with notes

### Fulfillment Workflow
1. Sign in as fulfillment user
2. View work queue
3. Start picking orders
4. Complete fulfillment with quantities
5. Mark as delivered

### Admin Workflow
1. Manage all items, categories, locations
2. View comprehensive reports
3. Manage user accounts
4. Monitor low stock alerts
5. Review audit logs

## Features Implemented

### ✅ User Roles and Access Control
- Admin (Financial Operations)
- Fulfillment (Inventory Admin)
- Approver
- Requestor (Regular User)
- Role-based permissions enforced

### ✅ Inventory Catalog Management
- Full CRUD operations
- Required attributes: name, description, category, unit, pack size, SKU, vendor, cost
- Reorder thresholds, max par, lead time
- Active/inactive status
- Multi-location support

### ✅ Stock Tracking and Control
- Real-time on-hand, reserved, available quantities
- Stock adjustments with reason codes
- Inventory movements tracking
- Receiving workflow

### ✅ Shopping Experience
- Browse/search/filter catalog
- Shopping cart
- Order submission with delivery details
- Department and cost center tracking

### ✅ Order Workflow
- Status flow: Submitted → Approved → Picking → Fulfilled
- Automatic routing
- Optional approval process

### ✅ Fulfillment Operations
- Work queue dashboard
- Pick/pack workflow
- Partial fulfillment support
- Delivery confirmation

### ✅ Notifications
- Order status changes
- New order alerts
- Low stock warnings
- Unread notification tracking

### ✅ Reporting and Auditing
- Low stock report
- Inventory summary
- Stock movements history
- Order reports
- Complete audit trail
- CSV export for all reports

### ✅ Replenishment Support
- Reorder point alerts
- Recommended purchase list
- Receiving workflow

### ✅ Administration
- User management
- Categories and locations
- System configuration
- Data integrity (deactivate vs delete)

### ✅ Technical Features
- Responsive mobile-friendly UI
- Fast search and filtering
- Concurrency handling via reservations
- Role-based navigation
- Toast notifications
- Comprehensive error handling

## Important Notes

**⚠️ Prototype Disclaimer:**
This is a demonstration/prototype system built with Figma Make and Supabase. For production use in a healthcare environment:

1. **SSO Integration:** Replace the current auth with your institutional SSO (SAML, OAuth, etc.)
2. **HIPAA Compliance:** Implement proper security controls, encryption, and audit trails
3. **Data Validation:** Add comprehensive input validation and sanitization
4. **Database Schema:** Migrate from KV store to proper relational database with foreign keys
5. **Email Notifications:** Configure SMTP and notification templates
6. **Access Controls:** Implement department-level and item-level restrictions
7. **Workflow Customization:** Add configurable approval thresholds and routing rules

## Testing the System

### End-to-End Order Flow
1. **Requestor:** Create and submit an order
2. **Approver:** Approve the order
3. **Fulfillment:** Pick and fulfill the order
4. **Admin:** Review reports and audit logs

### Stock Management Flow
1. **Admin:** Receive new stock
2. **System:** Track movements
3. **Fulfillment:** Adjust stock with reason codes
4. **Admin:** View stock movements report

### Low Stock Flow
1. **System:** Detect low stock items
2. **Admin:** View low stock alert on dashboard
3. **Admin:** Review low stock report
4. **Admin:** Plan reorders based on lead time

## Support
For questions or issues, refer to the Figma Make documentation or review the code comments in the source files.
