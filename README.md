# IMS Requisition-to-Issue System

This repository starts the system from your blueprint in the same order you laid out:

1. Auth and users
2. Requisition form
3. Approval engine
4. Inventory engine
5. Procurement and purchase orders
6. GRN and receiving
7. Finance 3-way match
8. Notifications

Modules 1, 2, 3, 4, 5, and 6 are now implemented here as the foundation for the rest of the workflow.

## Current structure

```text
backend/
  database/
  src/
frontend/
  src/
docs/
```

## Module 1 includes

- JWT login and logout endpoints
- Five role model: Employee, Line Manager, Inventory Officer, Procurement Officer, Finance
- MySQL schema for roles, users, and JWT-backed sessions
- Seed data with one demo user per role
- React login screen and protected dashboard shell
- Manager directory endpoint for future requisition assignment logic

## Module 2 includes

- Requisition header, line-item, and approval log schema
- `POST /api/requisitions` for employee submission
- `GET /api/requisitions/my` for employee history
- `GET /api/requisitions/:id` for full requisition detail
- Employee dashboard form with persisted request history and detail view

## Module 3 includes

- `GET /api/requisitions/manager` for the assigned line manager queue
- `POST /api/requisitions/:id/approve` for manager approval
- `POST /api/requisitions/:id/reject` for manager rejection
- Approval history with manager decision remarks
- Email-style notification hooks triggered after approve and reject actions
- React line manager workspace for review and decisioning

## Module 4 includes

- Inventory stock master and issue transaction tables
- `GET /api/inventory/queue` for approved requisitions awaiting stock decisions
- `GET /api/inventory/stock` for on-hand inventory visibility
- `POST /api/inventory/requisitions/:id/process` for inventory branching
- Requisition detail enriched with inventory allocation results
- React inventory officer workspace for full issue, partial procurement, or full procurement routing

## Module 5 includes

- Vendor master and purchase order schema
- `GET /api/procurement/queue` for requisitions with procurement balances
- `GET /api/procurement/vendors` for active vendor lookup
- `POST /api/procurement/requisitions/:id/purchase-orders` for purchase order creation
- Requisition detail enriched with linked purchase orders and PO lines
- React procurement workspace for converting balances into vendor-backed orders

## Module 6 includes

- Goods receipt note schema with GRN header and line records
- `GET /api/receiving/queue` for issued and partially received purchase orders
- `POST /api/receiving/purchase-orders/:id/receive` for GRN capture and stock updates
- Purchase-order line receipt tracking plus requisition detail enriched with GRN history
- React receiving workspace for inventory officers to post receipts back into stock

## Backend setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Create a MySQL database, for example `ims_db`.
3. Run `backend/database/schema.sql`.
   Existing Module 1 databases can be upgraded with `backend/database/module2.sql`, `backend/database/module4.sql`, `backend/database/module5.sql`, and `backend/database/module6.sql`.
4. Install dependencies in `backend`.
5. Seed demo users with `npm run seed:users`.
6. Start the API with `npm run dev`.

## Frontend setup

1. Copy `frontend/.env.example` to `frontend/.env`.
2. Install dependencies in `frontend`.
3. Start the client with `npm run dev`.

## Seeded users

- `employee@ims.local`
- `manager@ims.local`
- `inventory@ims.local`
- `procurement@ims.local`
- `finance@ims.local`

Default password for all demo users: `Password123!`

## Next module handoff

Module 7 should branch from Modules 5 and 6 outcomes by using:

- purchase orders and GRNs as the finance match target
- ordered versus received quantities at the PO-line level
- inventory receipt evidence for invoice validation and payable release

The backend already has vendor-backed purchase orders, receipt history, and stock-updated GRNs needed to gate those flows.
