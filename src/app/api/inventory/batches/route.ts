import { InventoryBatch } from "@/models/InventoryBatch";
import { InventoryItem } from "@/models/InventoryItem";
import { Supplier } from "@/models/Supplier";
import { withAuth, json } from "@/lib/api";
import { getExpirySummary } from "@/lib/inventory-engine";

export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "list";

  if (mode === "expiry") {
    const summary = await getExpirySummary({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    return json(summary);
  }

  const itemId = url.searchParams.get("itemId");
  const filter: Record<string, unknown> = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    remainingQty: { $gt: 0 },
    isActive: true,
  };
  if (itemId) filter.inventoryItemId = itemId;

  const batches = await InventoryBatch.find(filter)
    .sort({ expiryDate: 1, receivedAt: 1 })
    .limit(200)
    .lean();

  const itemIds = [...new Set(batches.map((b) => b.inventoryItemId.toString()))];
  const supplierIds = [
    ...new Set(
      batches
        .map((b) => b.supplierId?.toString())
        .filter(Boolean) as string[]
    ),
  ];
  const [items, suppliers] = await Promise.all([
    InventoryItem.find({ _id: { $in: itemIds } }).select("name unit").lean(),
    Supplier.find({ _id: { $in: supplierIds } }).select("company").lean(),
  ]);
  const itemMap = new Map(items.map((i) => [i._id.toString(), i]));
  const supMap = new Map(suppliers.map((s) => [s._id.toString(), s]));

  return json({
    batches: batches.map((b) => {
      const inv = itemMap.get(b.inventoryItemId.toString());
      const sup = b.supplierId
        ? supMap.get(b.supplierId.toString())
        : null;
      return {
        id: b._id.toString(),
        batchCode: b.batchCode,
        itemName: inv?.name ?? "—",
        unit: inv?.unit ?? "",
        inventoryItemId: b.inventoryItemId.toString(),
        receivedQty: b.receivedQty,
        remainingQty: b.remainingQty,
        unitCostPaise: b.unitCostPaise,
        receivedAt: b.receivedAt,
        expiryDate: b.expiryDate,
        supplier: sup?.company ?? null,
      };
    }),
  });
}, "inventory.view");
