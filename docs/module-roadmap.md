# Build Roadmap

## Module 1: Auth and users

Completed foundation:

- MySQL role and user schema
- Self-referencing manager relationship
- JWT session table for revocation and auditing
- Login, me, logout routes
- Role-aware frontend shell

## Module 2: Requisition form

Completed foundation:

- `requisitions`, `requisition_items`, and `approval_logs` schema
- Employee requisition submission endpoint
- Employee requisition history endpoint
- Requisition detail endpoint with line items and approval trail
- Frontend dashboard requisition form and status view

## Module 3: Approval engine

Completed foundation:

- Manager approve and reject actions
- Approval history
- Email trigger hooks for approved and rejected states

## Module 4: Inventory engine

Completed foundation:

- Full issue
- Partial issue plus procurement balance
- No stock plus full procurement

## Module 5: Procurement and purchase orders

Completed foundation:

- Turn procurement balances into purchase work
- Track vendor and order state separately from stock issue state

## Module 6: GRN and receiving

Completed foundation:

- Receive against purchase order lines
- Push accepted stock back into inventory balances
- Persist GRN headers and lines for downstream finance evidence

## Module 7: Finance 3-way match

Completed foundation:

- Queue fully received purchase orders into finance review
- Capture invoice data against PO and GRN evidence
- Record line-by-line 3-way match results with mismatch visibility

## Module 8: Centralized notification service

Completed foundation:

- Centralize downstream notifications across approval, procurement, receiving, and finance
