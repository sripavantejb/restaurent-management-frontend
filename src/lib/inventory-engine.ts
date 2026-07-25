/**
 * Inventory engine — FIFO batch consumption, receive, waste, transfers.
 * Amounts in ingredient units; costs in paise.
 */
import { Types } from "mongoose";
import { InventoryItem } from "@/models/InventoryItem";
import { InventoryBatch } from "@/models/InventoryBatch";
import { StockMovement, type WasteReason } from "@/models/StockMovement";
import { Warehouse } from "@/models/Warehouse";
import { Notification } from "@/models/Notification";

type TenantIds = {
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
};

export async function ensureDefaultWarehouse(tenant: TenantIds) {
  let wh = await Warehouse.findOne({
    ...tenant,
    isDefault: true,
    isActive: true,
  });
  if (!wh) {
    wh = await Warehouse.create({
      ...tenant,
      name: "Main Store",
      code: "MAIN",
      isDefault: true,
    });
  }
  return wh;
}

function nextBatchCode(prefix: string) {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  return `${prefix}-${stamp}`;
}

/** Receive stock → create batch + PURCHASE/IN ledger + update avg cost. */
export async function receiveStock(input: {
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
  inventoryItemId: Types.ObjectId;
  qty: number;
  unitCostPaise: number;
  supplierId?: Types.ObjectId | null;
  purchaseOrderId?: Types.ObjectId | null;
  warehouseId?: Types.ObjectId | null;
  expiryDate?: Date | null;
  batchCode?: string;
  note?: string;
  reference?: string;
  createdBy?: Types.ObjectId | null;
  menuItemName?: string;
}) {
  if (input.qty <= 0) throw new Error("qty must be positive");

  const warehouseId =
    input.warehouseId ??
    (await ensureDefaultWarehouse({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
    }))._id;

  const item = await InventoryItem.findOne({
    _id: input.inventoryItemId,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
  });
  if (!item) throw new Error("Inventory item not found");

  const prefix = item.sku?.slice(0, 3).toUpperCase() || item.name.slice(0, 2).toUpperCase() || "BT";
  const batchCode = input.batchCode || nextBatchCode(prefix);

  const batch = await InventoryBatch.create({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    warehouseId,
    inventoryItemId: item._id,
    batchCode,
    supplierId: input.supplierId ?? null,
    purchaseOrderId: input.purchaseOrderId ?? null,
    receivedQty: input.qty,
    remainingQty: input.qty,
    unitCostPaise: input.unitCostPaise,
    receivedAt: new Date(),
    expiryDate: input.expiryDate ?? null,
  });

  const prevQty = item.quantityOnHand;
  const prevCost = item.costPerUnit;
  const newQty = prevQty + input.qty;
  const avgCost =
    newQty > 0
      ? Math.round(
          (prevQty * prevCost + input.qty * input.unitCostPaise) / newQty
        )
      : input.unitCostPaise;

  item.quantityOnHand = newQty;
  item.costPerUnit = avgCost;
  item.lastMovementAt = new Date();
  if (!item.warehouseId) item.warehouseId = warehouseId;
  if (!item.qrPayload) {
    item.qrPayload = `ros:inv:${item._id.toString()}`;
  }
  if (!item.barcode && item.sku) item.barcode = item.sku;
  await item.save();

  await StockMovement.create({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    warehouseId,
    inventoryItemId: item._id,
    batchId: batch._id,
    type: input.purchaseOrderId ? "PURCHASE" : "IN",
    quantity: input.qty,
    unitCostPaise: input.unitCostPaise,
    note: input.note || `Received ${batchCode}`,
    reference: input.reference || batchCode,
    purchaseOrderId: input.purchaseOrderId ?? null,
    supplierId: input.supplierId ?? null,
    createdBy: input.createdBy ?? null,
    menuItemName: input.menuItemName || "",
  });

  if (input.supplierId) {
    const { SupplierPriceHistory } = await import(
      "@/models/SupplierPriceHistory"
    );
    await SupplierPriceHistory.create({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      supplierId: input.supplierId,
      inventoryItemId: item._id,
      unitCostPaise: input.unitCostPaise,
      purchaseOrderId: input.purchaseOrderId ?? null,
      recordedAt: new Date(),
    }).catch(() => undefined);
  }

  if (item.maxStock > 0 && item.quantityOnHand > item.maxStock) {
    await Notification.create({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      type: "OVERSTOCK",
      title: `Overstock: ${item.name}`,
      body: `${item.quantityOnHand} ${item.unit} exceeds max ${item.maxStock}`,
      href: "/inventory",
    }).catch(() => undefined);
  }

  if (item.quantityOnHand <= item.reorderLevel) {
    await Notification.create({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      type: "LOW_STOCK",
      title: `Still low: ${item.name}`,
      body: `${item.quantityOnHand} ${item.unit} on hand (reorder ${item.reorderLevel})`,
      href: "/inventory",
    }).catch(() => undefined);
  }

  return { batch, item };
}

/**
 * Consume batches using item costingMethod: FIFO (default), LIFO, or AVG (FIFO layers, avg cost reporting).
 */
export async function consumeFifo(input: {
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
  inventoryItemId: Types.ObjectId;
  qty: number;
  type:
    | "SALE"
    | "WASTE"
    | "OUT"
    | "TRANSFER_OUT"
    | "ADJUST"
    | "INTERNAL"
    | "RETURN"
    | "COUNT";
  note?: string;
  wasteReason?: WasteReason | null;
  orderId?: Types.ObjectId | null;
  transferId?: Types.ObjectId | null;
  createdBy?: Types.ObjectId | null;
  menuItemName?: string;
  reference?: string;
}) {
  if (input.qty <= 0) return { consumed: 0, costPaise: 0 };

  const itemMeta = await InventoryItem.findById(input.inventoryItemId)
    .select("costingMethod")
    .lean();
  const method = itemMeta?.costingMethod || "FIFO";
  const sort =
    method === "LIFO"
      ? ({ receivedAt: -1, expiryDate: -1 } as const)
      : ({ expiryDate: 1, receivedAt: 1 } as const);

  let remaining = input.qty;
  let costPaise = 0;

  const batches = await InventoryBatch.find({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    inventoryItemId: input.inventoryItemId,
    remainingQty: { $gt: 0 },
    isActive: true,
  })
    .sort(sort)
    .exec();

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.remainingQty, remaining);
    batch.remainingQty -= take;
    if (batch.remainingQty <= 0) batch.isActive = false;
    await batch.save();

    costPaise += Math.round(take * batch.unitCostPaise);
    remaining -= take;

    await StockMovement.create({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      warehouseId: batch.warehouseId,
      inventoryItemId: input.inventoryItemId,
      batchId: batch._id,
      type: input.type,
      quantity: -take,
      unitCostPaise: batch.unitCostPaise,
      note: input.note || "",
      wasteReason: input.wasteReason ?? null,
      orderId: input.orderId ?? null,
      transferId: input.transferId ?? null,
      createdBy: input.createdBy ?? null,
      menuItemName: input.menuItemName || "",
      reference: input.reference || batch.batchCode,
    });
  }

  if (remaining > 0) {
    await StockMovement.create({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      inventoryItemId: input.inventoryItemId,
      type: input.type,
      quantity: -remaining,
      unitCostPaise: 0,
      note: `${input.note || ""} (unbatched)`.trim(),
      wasteReason: input.wasteReason ?? null,
      orderId: input.orderId ?? null,
      transferId: input.transferId ?? null,
      createdBy: input.createdBy ?? null,
      menuItemName: input.menuItemName || "",
      reference: input.reference || "",
    });
    remaining = 0;
  }

  const item = await InventoryItem.findOneAndUpdate(
    {
      _id: input.inventoryItemId,
      restaurantId: input.restaurantId,
      branchId: input.branchId,
    },
    {
      $inc: { quantityOnHand: -input.qty },
      $set: { lastMovementAt: new Date() },
    },
    { new: true }
  );

  if (item && item.quantityOnHand <= item.reorderLevel) {
    await Notification.create({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      type: "LOW_STOCK",
      title: `Low stock: ${item.name}`,
      body: `${item.quantityOnHand} ${item.unit} left · reorder at ${item.reorderLevel}`,
      href: "/inventory",
      meta: { inventoryItemId: item._id.toString() },
    }).catch(() => undefined);
  }

  return { consumed: input.qty, costPaise, item };
}

/** Return goods to supplier — reverse qty from newest batches (LIFO for returns). */
export async function returnToSupplier(input: {
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
  inventoryItemId: Types.ObjectId;
  qty: number;
  supplierId?: Types.ObjectId | null;
  note?: string;
  createdBy?: Types.ObjectId | null;
}) {
  return consumeFifo({
    ...input,
    type: "RETURN",
    note: input.note || "Purchase return",
    reference: "RETURN",
  });
}

export async function getExpirySummary(tenant: TenantIds) {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  const in3 = new Date(startToday);
  in3.setDate(in3.getDate() + 3);
  const in7 = new Date(startToday);
  in7.setDate(in7.getDate() + 7);

  const active = {
    ...tenant,
    remainingQty: { $gt: 0 },
    isActive: true,
    expiryDate: { $ne: null },
  };

  const [expired, expiringToday, within3, withinWeek] = await Promise.all([
    InventoryBatch.countDocuments({
      ...active,
      expiryDate: { $lt: startToday },
    }),
    InventoryBatch.countDocuments({
      ...active,
      expiryDate: { $gte: startToday, $lte: endToday },
    }),
    InventoryBatch.countDocuments({
      ...active,
      expiryDate: { $gt: endToday, $lte: in3 },
    }),
    InventoryBatch.countDocuments({
      ...active,
      expiryDate: { $gt: endToday, $lte: in7 },
    }),
  ]);

  const batches = await InventoryBatch.find({
    ...tenant,
    remainingQty: { $gt: 0 },
    isActive: true,
    expiryDate: { $ne: null, $lte: in7 },
  })
    .sort({ expiryDate: 1 })
    .limit(50)
    .populate("inventoryItemId", "name unit")
    .lean();

  return {
    counts: { expired, expiringToday, within3Days: within3, withinWeek },
    batches: batches.map((b) => {
      const inv = b.inventoryItemId as unknown as {
        name?: string;
        unit?: string;
      } | null;
      return {
        id: b._id.toString(),
        batchCode: b.batchCode,
        remainingQty: b.remainingQty,
        expiryDate: b.expiryDate,
        itemName: inv?.name ?? "—",
        unit: inv?.unit ?? "",
      };
    }),
  };
}
