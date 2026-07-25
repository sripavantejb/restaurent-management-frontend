import { StockMovement } from "@/models/StockMovement";
import { InventoryItem } from "@/models/InventoryItem";
import { withAuth, json } from "@/lib/api";

/** Stock ledger / movement history */
export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  const type = url.searchParams.get("type");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);

  const filter: Record<string, unknown> = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  };
  if (itemId) filter.inventoryItemId = itemId;
  if (type) filter.type = type;

  const moves = await StockMovement.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const itemIds = [...new Set(moves.map((m) => m.inventoryItemId.toString()))];
  const items = await InventoryItem.find({ _id: { $in: itemIds } })
    .select("name unit")
    .lean();
  const nameById = new Map(items.map((i) => [i._id.toString(), i]));

  return json({
    movements: moves.map((m) => {
      const inv = nameById.get(m.inventoryItemId.toString());
      return {
        id: m._id.toString(),
        date: m.createdAt,
        type: m.type,
        quantity: m.quantity,
        itemName: inv?.name ?? "—",
        unit: inv?.unit ?? "",
        note: m.note,
        wasteReason: m.wasteReason ?? null,
        reference: m.reference || "",
        menuItemName: m.menuItemName || "",
        unitCostPaise: m.unitCostPaise || 0,
        batchId: m.batchId?.toString() ?? null,
      };
    }),
  });
}, "inventory.view");
