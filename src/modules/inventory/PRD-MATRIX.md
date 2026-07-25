# Inventory PRD coverage matrix

Best-in-class restaurant inventory features vs RestaurantOS status.

| Feature | Status | Notes |
|---------|--------|-------|
| Inventory Dashboard | **Shipped** | `/inventory` Overview KPIs |
| Inventory Items | **Shipped** | SKU, barcode, brand, category, image URL, costing method |
| Categories / Subcategories | **Shipped** | `/api/inventory/categories` + item fields |
| Units of Measure | **Shipped** | KG,G,L,ML,PCS,BOX,CARTON,BOTTLE,PACK,DOZEN |
| SKU Management | **Shipped** | |
| Barcode Management | **Shipped** | Field + labels report |
| QR Code Labels | **Shipped** | `qrPayload` + Labels print UI |
| Image Management | **Partial** | `imageUrl` field (URL); upload CDN next |
| Brand Management | **Shipped** | `brand` on item |
| Warehouse Management | **Shipped** | Model + reports API + UI |
| Multi-Branch Inventory | **Shipped** | Transfers with accept |
| Batch/Lot Tracking | **Shipped** | Every receive creates batch |
| FIFO Consumption | **Shipped** | Default |
| LIFO (Optional) | **Shipped** | Per-item `costingMethod` |
| Weighted Average Cost | **Shipped** | Updated on receive |
| Expiry Date Tracking | **Shipped** | Batch expiry + alerts |
| Stock Ledger | **Shipped** | Ledger tab |
| Stock Movement | **Shipped** | |
| Opening Stock | **Shipped** | Create with qty → batch |
| Stock Adjustment | **Shipped** | Adjust modal |
| Physical Stock Count | **Shipped** | Counts API + reconcile |
| Cycle Counting | **Shipped** | `cycle: true` on count |
| Stock Transfers | **Shipped** | Branch transfers |
| Recipe / Menu Mapping | **Shipped** | Recipes tab |
| Auto Deduction on Pay | **Shipped** | FIFO/LIFO engine |
| Wastage Management | **Shipped** | Reason enum |
| Damaged / Internal use | **Shipped** | WASTE reasons + INTERNAL type |
| Supplier Management | **Shipped** | |
| Purchase Requests | **Shipped** | |
| Approval Workflow | **Shipped** | |
| Purchase Orders | **Shipped** | |
| GRN + Quality Check | **Shipped** | Receive with `qualityOk` |
| Supplier Invoice | **Partial** | `invoiceNumber` on PO |
| Purchase Returns | **Shipped** | Reports API `return` |
| Vendor Payments | **Partial** | `outstandingPaise` on supplier |
| Reorder Levels | **Shipped** | |
| Auto Reorder Suggestions | **Shipped** | PR from low stock + AI |
| Purchase / Inventory Forecast | **Partial** | AI Copilot forecasts |
| Consumption Report | **Shipped** | Analytics + ledger |
| Food Cost Analysis | **Shipped** | Finance permission |
| Inventory Valuation | **Shipped** | |
| Price History | **Shipped** | SupplierPriceHistory |
| Supplier Comparison | **Shipped** | `report=supplierCompare` |
| Inventory Analytics | **Shipped** | Overview charts |
| Low / Expiry / Overstock Alerts | **Shipped** | Notifications |
| Dead Stock Report | **Shipped** | `report=dead` |
| Inventory Reports | **Shipped** | Reports API |
| Export PDF/Excel | **Partial** | CSV export (Excel-ready) |
| Print Labels | **Shipped** | Browser print labels |
| Mobile Inventory | **Partial** | Responsive UI; PWA offline next |
| Offline Support | **Planned** | Queue + sync |
| Audit Logs | **Shipped** | writeAudit on key actions |
| RBAC | **Shipped** | Incl. Inventory Manager |
| Real-Time Sync | **Partial** | Socket infra; inventory emit next |
| API Integration | **Partial** | REST APIs ready for BI |
| AI Insights | **Shipped** | Copilot + overview suggestions |

## Workflow status

`Supplier → PR → Approve → PO → Delivery → GRN (quality) → Batches → Recipe → Paid order → FIFO/LIFO deduct → Ledger → Food cost → Low stock → Auto PR` — **operational**.
