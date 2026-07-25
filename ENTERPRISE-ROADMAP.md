# RestaurantOS — Enterprise roadmap

World-class Restaurant ERP vision (beyond Petpooja / Toast / Square).  
This document tracks **shipped vs planned**. The full megaspec is delivered in phased vertical slices — not one monolithic dump.

## Shipped (production verticals)

| Module | Status |
|--------|--------|
| Multi-tenant auth + RBAC | Shipped |
| POS / KDS / Orders / Menu | Shipped |
| QR guest ordering + service alerts + waiter approval | Shipped |
| Inventory + recipes + auto-deduct + low stock | Shipped |
| Platform admin + Razorpay billing scaffolding | Shipped |
| Soft delete plugin | Shipped (`lib/soft-delete.ts`) |
| Audit log writer | Shipped (`AuditLog` + `writeAudit`) |
| Notifications API | Shipped (`/api/notifications`) |
| Floors / Sections API | Shipped (`/api/floors`) |
| Expanded table statuses + merge/split + soft delete | Shipped |
| Floor plan: VIP / outdoor / Cleaning→Available / merge picks | Shipped |
| GST engine (CGST/SGST/IGST/CESS) | Shipped (`lib/tax.ts`) |
| Invoice builder + thermal print + POS print after pay | Shipped (`lib/invoice.ts`, `/api/orders/[id]/invoice`) |
| Dark mode + theme toggle | Shipped |
| Socket.IO custom server | Shipped (`server.mjs` + `RealtimeProvider`) — polling fallback on Vercel |
| **Restaurant AI Copilot** | Shipped — tool registry, RBAC gateway, streaming chat, dashboard widgets (`/ai`) |
| **Inventory OS (FIFO)** | Shipped — batches, expiry, ledger, suppliers, PR→PO→GRN+QC, transfers, counts, reports, LIFO/AVG, labels (see `modules/inventory/PRD-MATRIX.md`) |

## Phase A — Table & floor ops (remaining)

- Visual resize / rotate handles on floor plan UI
- Floor / section switcher on floor plan
- QR download pack (PDF/ZIP)
- Waiter one-tap Cleaning → Available

## Phase B — Billing & GST

- Line-item HSN on menu
- Inclusive/exclusive tax per branch
- PDF invoice (pdfkit), email / WhatsApp send
- Split / partial / advance payments

## Phase C — Supply chain

- Warehouse transfers
- Purchase request → PO → GRN (low-stock automation)
- Supplier portal
- Batch / expiry / FIFO

## Phase D — People & CRM

- Full HRMS + attendance + payroll
- Customer loyalty + wallet + campaigns
- Reservations + waitlist

## Phase E — Intelligence

- AI copilot, demand/waste forecast, dynamic pricing
- Real-time dashboards over Socket.IO everywhere

## Architecture rules

1. Money always integer **paise**
2. Tenant filter on every business collection
3. Mutations write **audit** + emit **realtime** when possible
4. Soft-delete preferred over hard delete
5. Modules live under `src/modules/*` with README when extracted
6. Ship vertical slices — never placeholder stubs in production paths

## Run with Socket.IO (local)

```bash
npm install
npm run seed
npm run dev:socket   # uses server.mjs
```

Standard `npm run dev` keeps Next-only + polling.
