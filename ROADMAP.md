# RestaurantOS — Roadmap (13 unbuilt modules)

Dependency order for the remaining product surface. Inventory must land before procurement. Offline POS needs an IndexedDB write-ahead queue with idempotent server-side order IDs.

1. **Inventory** — stock levels, units, wastage, recipe → menu item links  
2. **Warehouse** — multi-location stock, transfers between branch stores  
3. **Procurement** — POs against inventory; suppliers; goods receipt  
4. **Supplier portal** — external login for vendors to accept POs and upload invoices  
5. **Finance** — GL, P&L by branch, GST returns export (depends on payments + procurement)  
6. **Reservations** — table booking calendar tied to floor plan status  
7. **CRM** — guests, visits, preferences, loyalty points from completed orders  
8. **QR ordering** — guest menu → draft orders; reuses Order model  
9. **HRMS** — staff profiles, attendance, shifts (extends User)  
10. **Payroll** — salaries, tips pooling; depends on HRMS attendance  
11. **AI** — demand forecasting, 86 suggestions, prep-time predictions  
12. **Offline POS** — IndexedDB WAL + idempotent order IDs + sync worker  
13. **Delivery integrations** — aggregator webhooks mapped to Order type DELIVERY  

## Deliberately out of hour-one scope

| Cut | Reason |
|---|---|
| Offline POS | IndexedDB queue + idempotent sync is a multi-week problem |
| Websockets | 2s polling is enough at demo scale |
| Inventory / recipes | Needs menu + order models stable first |
| Procurement, HRMS, payroll, finance | Each is a full product |
| QR ordering, CRM, reservations, AI | Depend on settled Order model |
