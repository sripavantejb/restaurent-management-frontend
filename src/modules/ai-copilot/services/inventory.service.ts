import { InventoryItem, type IInventoryItem } from "@/models/InventoryItem";
import { StockMovement } from "@/models/StockMovement";
import type { AiTenantCtx, ToolResult } from "../types";
import { addDays, formatInr, startOfDay } from "./date-utils";

function base(ctx: AiTenantCtx) {
  return { restaurantId: ctx.restaurantId, branchId: ctx.branchId };
}

export async function getCurrentStock(ctx: AiTenantCtx): Promise<ToolResult> {
  const items = (await InventoryItem.find({
    ...base(ctx),
    isActive: true,
  })
    .sort({ name: 1 })
    .lean()) as unknown as IInventoryItem[];
  return {
    ok: true,
    summary: `${items.length} active inventory SKUs.`,
    blocks: [
      {
        type: "table",
        title: "Current stock",
        data: {
          columns: ["name", "qty", "unit", "reorder", "value"],
          rows: items.map((i) => ({
            name: i.name,
            qty: i.quantityOnHand,
            unit: i.unit,
            reorder: i.reorderLevel,
            value: formatInr(Math.round(i.quantityOnHand * i.costPerUnit)),
          })),
        },
      },
    ],
  };
}

export async function getLowStockItems(ctx: AiTenantCtx): Promise<ToolResult> {
  const items = (await InventoryItem.find({
    ...base(ctx),
    isActive: true,
  }).lean()) as unknown as IInventoryItem[];
  const low = items.filter((i) => i.quantityOnHand <= i.reorderLevel);
  return {
    ok: true,
    summary: `${low.length} low-stock item(s).`,
    blocks: [
      {
        type: "table",
        title: "Low stock",
        data: {
          columns: ["name", "onHand", "reorder", "unit"],
          rows: low.map((i) => ({
            name: i.name,
            onHand: i.quantityOnHand,
            reorder: i.reorderLevel,
            unit: i.unit,
          })),
        },
      },
      {
        type: "insight",
        title: "Automation",
        data: {
          text: low.length
            ? "Suggest creating a purchase order for these SKUs."
            : "Stock levels look healthy vs reorder points.",
        },
      },
    ],
    followUps: ["Create purchase suggestion", "Inventory value"],
  };
}

export async function getInventoryValue(ctx: AiTenantCtx): Promise<ToolResult> {
  const items = (await InventoryItem.find({
    ...base(ctx),
    isActive: true,
  }).lean()) as unknown as IInventoryItem[];
  const value = items.reduce(
    (s, i) => s + Math.round(i.quantityOnHand * i.costPerUnit),
    0
  );
  return {
    ok: true,
    summary: `Inventory on-hand value: ${formatInr(value)}.`,
    blocks: [
      {
        type: "kpi",
        data: [{ label: "Stock value", value: formatInr(value) }],
      },
    ],
  };
}

export async function getIngredientConsumption(
  ctx: AiTenantCtx
): Promise<ToolResult> {
  const since = addDays(startOfDay(), -7);
  const moves = await StockMovement.find({
    ...base(ctx),
    type: "SALE",
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  const byItem = new Map<string, number>();
  for (const m of moves) {
    const key = String(m.inventoryItemId);
    byItem.set(key, (byItem.get(key) ?? 0) + Math.abs(m.quantity));
  }
  return {
    ok: true,
    summary: `${moves.length} consumption movements in 7 days.`,
    data: { movementCount: moves.length, uniqueSkus: byItem.size },
    followUps: ["Low stock items?", "Forecast inventory needs"],
  };
}

/** Expiry tracking via InventoryBatch. */
export async function getExpiringItems(ctx: AiTenantCtx): Promise<ToolResult> {
  const { getExpirySummary } = await import("@/lib/inventory-engine");
  const summary = await getExpirySummary({
    restaurantId: ctx.restaurantId,
    branchId: ctx.branchId,
  });
  return {
    ok: true,
    summary: `Expired ${summary.counts.expired} · today ${summary.counts.expiringToday} · 3d ${summary.counts.within3Days} · week ${summary.counts.withinWeek}.`,
    blocks: [
      {
        type: "kpi",
        title: "Expiry",
        data: [
          { label: "Expired", value: String(summary.counts.expired) },
          { label: "Today", value: String(summary.counts.expiringToday) },
          { label: "3 days", value: String(summary.counts.within3Days) },
          { label: "Week", value: String(summary.counts.withinWeek) },
        ],
      },
      {
        type: "table",
        title: "Upcoming expiry",
        data: {
          columns: ["batchCode", "itemName", "remainingQty", "expiryDate"],
          rows: summary.batches.map((b) => ({
            batchCode: b.batchCode,
            itemName: b.itemName,
            remainingQty: b.remainingQty,
            expiryDate: b.expiryDate
              ? new Date(b.expiryDate).toLocaleDateString("en-IN")
              : "—",
          })),
        },
      },
    ],
    followUps: ["Suggest purchase order", "Record waste for expired"],
  };
}

export async function getExpiredItems(ctx: AiTenantCtx): Promise<ToolResult> {
  return getExpiringItems(ctx);
}
