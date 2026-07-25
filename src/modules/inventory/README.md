# Inventory OS

Enterprise inventory for RestaurantOS.

## Flow

```
Purchase / Receive → InventoryBatch (FIFO) → StockMovement ledger
Recipe sale on pay → consumeFifo (oldest expiry first)
Waste → reason enum + FIFO
Transfer branch → TRANSFER_OUT / accept → receiveStock
```

## Permissions

| Permission | Who |
|------------|-----|
| `inventory.view` | Owner, Manager, Inventory Manager, Chef, Cashier |
| `inventory.edit` | Owner, Manager, Inventory Manager |
| `inventory.purchase` | Owner, Manager, Inventory Manager |
| `inventory.approve` | Owner, Manager, Inventory Manager |
| `inventory.transfer` | Owner, Manager, Inventory Manager |
| `inventory.finance` | Owner, Manager only (food cost %) |

Role `INVENTORY_MANAGER` — full inventory, no finance/POS.

## APIs

- `GET/POST /api/inventory`
- `PATCH /api/inventory/[id]` · `POST .../waste`
- `GET /api/inventory/ledger`
- `GET /api/inventory/batches?mode=expiry`
- `GET/POST /api/inventory/suppliers`
- `GET/POST /api/inventory/purchases` (`fromLowStock`, `request`, `approve`, `order`, `receive` + quality check)
- `GET/POST /api/inventory/transfers`
- `GET /api/inventory/analytics`
- `GET/POST /api/inventory/recipes`
- `GET/POST /api/inventory/categories`
- `GET/POST /api/inventory/counts` (physical / cycle + reconcile)
- `GET/POST /api/inventory/reports` (dead, overstock, prices, labels, warehouses, CSV export, returns)

See [PRD-MATRIX.md](./PRD-MATRIX.md) for full feature coverage vs Petpooja-class ERP.
