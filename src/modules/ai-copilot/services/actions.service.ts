import { Table } from "@/models/Table";
import { Notification } from "@/models/Notification";
import type { AiTenantCtx, ToolResult } from "../types";
import { writeAudit } from "@/lib/audit";

function base(ctx: AiTenantCtx) {
  return { restaurantId: ctx.restaurantId, branchId: ctx.branchId };
}

export async function closeTable(
  ctx: AiTenantCtx,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const number = Number(args.tableNumber);
  if (!number) {
    return { ok: false, summary: "tableNumber required", error: "validation" };
  }
  const table = await Table.findOne({ ...base(ctx), number });
  if (!table) return { ok: false, summary: "Table not found", error: "not_found" };
  table.status = "CLEANING";
  table.currentSessionId = null;
  await table.save();
  await writeAudit({
    restaurantId: ctx.restaurantId,
    branchId: ctx.branchId,
    actorId: ctx.userId,
    actorType: "USER",
    action: "ai.closeTable",
    entityType: "Table",
    entityId: table._id.toString(),
    after: { status: "CLEANING" },
  });
  return {
    ok: true,
    summary: `Table ${number} moved to CLEANING.`,
    blocks: [
      { type: "action", data: { tableNumber: number, status: "CLEANING" } },
    ],
  };
}

export async function markTableAvailable(
  ctx: AiTenantCtx,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const number = Number(args.tableNumber);
  if (!number) {
    return { ok: false, summary: "tableNumber required", error: "validation" };
  }
  const table = await Table.findOne({ ...base(ctx), number });
  if (!table) return { ok: false, summary: "Table not found", error: "not_found" };
  table.status = "AVAILABLE";
  table.currentSessionId = null;
  await table.save();
  return {
    ok: true,
    summary: `Table ${number} is AVAILABLE.`,
    blocks: [
      { type: "action", data: { tableNumber: number, status: "AVAILABLE" } },
    ],
  };
}

export async function suggestPurchaseOrder(
  ctx: AiTenantCtx
): Promise<ToolResult> {
  const { getLowStockItems } = await import("./inventory.service");
  const low = await getLowStockItems(ctx);
  const rows =
    (
      low.blocks?.find((b) => b.type === "table")?.data as {
        rows?: { name: string; onHand: number; reorder: number; unit: string }[];
      }
    )?.rows ?? [];

  const suggestion = rows.map((r) => ({
    item: r.name,
    suggestedQty: Math.max(r.reorder * 2 - r.onHand, r.reorder),
    unit: r.unit,
  }));

  await Notification.create({
    restaurantId: ctx.restaurantId,
    branchId: ctx.branchId,
    userId: ctx.userId,
    type: "AI_PURCHASE_SUGGESTION",
    title: "AI purchase suggestion",
    body: `${suggestion.length} SKUs need replenishment`,
    href: "/inventory",
    meta: { suggestion },
  });

  return {
    ok: true,
    summary: `Purchase suggestion created for ${suggestion.length} SKUs (notification saved). Full PO docs land in Phase C.`,
    blocks: [
      {
        type: "table",
        title: "Suggested PO lines",
        data: {
          columns: ["item", "suggestedQty", "unit"],
          rows: suggestion,
        },
      },
      {
        type: "action",
        data: { kind: "PURCHASE_SUGGESTION", count: suggestion.length },
      },
    ],
  };
}

export async function createDiscountNote(
  ctx: AiTenantCtx,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const name = String(args.name || "AI discount").slice(0, 80);
  const percent = Number(args.percent) || 10;
  await Notification.create({
    restaurantId: ctx.restaurantId,
    branchId: ctx.branchId,
    role: "MANAGER",
    type: "AI_DISCOUNT_DRAFT",
    title: `Discount draft: ${name}`,
    body: `${percent}% — review in CRM/offers (Phase D)`,
    href: "/settings",
    meta: { name, percent },
  });
  return {
    ok: true,
    summary: `Draft discount "${name}" at ${percent}% queued for manager review.`,
    blocks: [{ type: "action", data: { name, percent } }],
  };
}

/** Stubs for domains not yet in ERP — honest, audited responses */
export async function notYetAvailable(
  feature: string
): Promise<ToolResult> {
  return {
    ok: true,
    summary: `${feature} is on the enterprise roadmap and not wired to live data yet.`,
    blocks: [
      {
        type: "insight",
        data: { text: `Track progress in ENTERPRISE-ROADMAP.md — ${feature}.` },
      },
    ],
  };
}
