# RestaurantOS — Full ERP Catalog (24 modules)

Honest coverage vs your master feature list.  
**Shipped** = production path in this codebase · **Partial** = core works, polish remaining · **Next** = modeled/API-ready or queued.

| # | Module | Status |
|---|--------|--------|
| 2 | Restaurant Setup | **Partial** profile, branches, floors, tables, QR, tax, hours, receipt, theme, currency (`/settings`) |
| 3 | Dashboard | **Shipped** revenue, orders, profit, expenses, kitchen, low stock, reservations, attendance, AI insights |
| 4 | POS | **Partial** new bill, discount, print, **hold/resume**, refund API; split/merge bill & offline next |
| 5 | Billing & Tax | **Shipped** GST CGST/SGST/IGST/CESS, invoice, thermal; WhatsApp/email send next |
| 6 | Orders | **Shipped** dine-in/takeaway/delivery/QR; scheduled/phone/bulk partial |
| 7 | KDS | **Shipped** queue, ready, delayed; chef assign/stations next |
| 8 | Menu | **Partial** variants/addons in model+POS; happy hour/allergens UI expanding |
| 9 | Tables | **Shipped** floor plan, merge, status, QR, auto status |
| 10 | Inventory | **Shipped** 70+ (see inventory PRD matrix) |
| 11 | Procurement | **Shipped** PR/PO/GRN/approvals inside inventory |
| 12 | Supplier Portal | **Next** vendor login (API foundation) |
| 13 | CRM | **Partial** `/crm` customers, loyalty, wallet |
| 14 | Reservations | **Partial** `/reservations` booking + waitlist |
| 15 | Employees | **Partial** staff + `/hr` attendance; payroll next |
| 16 | Finance | **Partial** `/finance` expenses + P&L snapshot |
| 17 | Analytics | **Partial** dashboard + inventory + AI |
| 18 | AI Copilot | **Shipped** chat, tools, voice, charts |
| 19 | Marketing | **Partial** `/marketing` campaigns + coupons |
| 20 | Integrations | **Partial** Razorpay SaaS; OpenAI; more connectors next |
| 21 | Reports | **Partial** `/reports` hub + inventory/GST/AI |
| 22 | Notifications | **Partial** API + in-app bell |
| 23 | Mobile Apps | **Partial** responsive web waiter/guest/owner |
| 24 | Platform Admin | **Shipped** tenants, plans, billing |

## Live workflow (shipped)

Registration → Branch → Floor/Tables → Menu+Recipes → Inventory+Suppliers → Staff → QR Live → Order → KDS → Bill → Pay → Inventory deduct → GST → Reports/AI → Table reset.

## Still queued (honest gaps)

Offline POS · bill split/merge · native mobile apps · supplier portal UI · Swiggy/Zomato/Uber · Tally/Zoho/QuickBooks · WhatsApp/SMS/email auto-send · payroll · happy-hour UI · station KDS routing.
