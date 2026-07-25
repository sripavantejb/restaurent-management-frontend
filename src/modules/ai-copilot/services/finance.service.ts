import { Order, type IOrder } from "@/models/Order";
import { Payment, type IPayment } from "@/models/Payment";
import type { AiTenantCtx, ToolResult } from "../types";
import {
  addDays,
  endOfDay,
  formatInr,
  startOfDay,
} from "./date-utils";

function base(ctx: AiTenantCtx) {
  return { restaurantId: ctx.restaurantId, branchId: ctx.branchId };
}

export async function getGSTCollected(ctx: AiTenantCtx): Promise<ToolResult> {
  const orders = (await Order.find({
    ...base(ctx),
    status: "COMPLETED",
    completedAt: { $gte: startOfDay(), $lte: endOfDay() },
  }).lean()) as unknown as IOrder[];
  const tax = orders.reduce((s, o) => s + (o.taxAmount || 0), 0);
  const half = Math.round(tax / 2);
  const cgst = half;
  const sgst = tax - half;
  return {
    ok: true,
    summary: `GST today ${formatInr(tax)} (CGST ${formatInr(cgst)} + SGST ${formatInr(sgst)}).`,
    blocks: [
      {
        type: "kpi",
        title: "GST today",
        data: [
          { label: "Total GST", value: formatInr(tax) },
          { label: "CGST", value: formatInr(cgst) },
          { label: "SGST", value: formatInr(sgst) },
          { label: "IGST", value: formatInr(0) },
        ],
      },
    ],
    followUps: ["Weekly GST report", "Generate GST report summary"],
  };
}

export async function getCGST(ctx: AiTenantCtx) {
  return getGSTCollected(ctx);
}
export async function getSGST(ctx: AiTenantCtx) {
  return getGSTCollected(ctx);
}
export async function getIGST(_ctx: AiTenantCtx): Promise<ToolResult> {
  return {
    ok: true,
    summary: "IGST is 0 for intra-state branch sales (default mode).",
    blocks: [{ type: "kpi", data: [{ label: "IGST", value: "₹0" }] }],
  };
}

export async function getExpenses(_ctx: AiTenantCtx): Promise<ToolResult> {
  return {
    ok: true,
    summary:
      "Expense ledger module is Phase D. No expense documents yet for this branch.",
    blocks: [
      {
        type: "insight",
        data: { text: "Connect expense entries to unlock cash-flow AI." },
      },
    ],
  };
}

export async function getCashFlow(ctx: AiTenantCtx): Promise<ToolResult> {
  const payments = (await Payment.find({
    ...base(ctx),
    paidAt: { $gte: startOfDay(), $lte: endOfDay() },
  }).lean()) as unknown as IPayment[];
  const byMethod: Record<string, number> = {};
  let total = 0;
  for (const p of payments) {
    byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
    total += p.amount;
  }
  return {
    ok: true,
    summary: `Cash collected today ${formatInr(total)} across ${payments.length} payments.`,
    blocks: [
      {
        type: "kpi",
        data: Object.entries(byMethod).map(([label, value]) => ({
          label,
          value: formatInr(value),
        })),
      },
      {
        type: "chart",
        title: "Payment mix",
        data: {
          kind: "pie",
          points: Object.entries(byMethod).map(([x, y]) => ({
            x,
            y: y / 100,
          })),
        },
      },
    ],
  };
}

export async function getProfitReport(ctx: AiTenantCtx): Promise<ToolResult> {
  const { getProfit } = await import("./sales.service");
  return getProfit(ctx);
}

export async function generateSalesReport(
  ctx: AiTenantCtx
): Promise<ToolResult> {
  const { getWeeklySales, getTopSellingItems } = await import(
    "./sales.service"
  );
  const week = await getWeeklySales(ctx);
  const top = await getTopSellingItems(ctx, { days: 7, limit: 5 });
  return {
    ok: true,
    summary: `Sales report ready. ${week.summary}`,
    blocks: [...(week.blocks ?? []), ...(top.blocks ?? [])],
    followUps: ["Export GST report", "Inventory value"],
  };
}

export async function generateGSTReport(ctx: AiTenantCtx): Promise<ToolResult> {
  const days = 7;
  const orders = (await Order.find({
    ...base(ctx),
    status: "COMPLETED",
    completedAt: { $gte: addDays(startOfDay(), -days) },
  }).lean()) as unknown as IOrder[];
  const tax = orders.reduce((s, o) => s + (o.taxAmount || 0), 0);
  return {
    ok: true,
    summary: `GST last ${days} days: ${formatInr(tax)} on ${orders.length} invoices.`,
    blocks: [
      {
        type: "table",
        title: "GST summary",
        data: {
          columns: ["period", "invoices", "gst"],
          rows: [
            {
              period: `Last ${days} days`,
              invoices: orders.length,
              gst: formatInr(tax),
            },
          ],
        },
      },
    ],
  };
}

export async function generateInventoryReport(
  ctx: AiTenantCtx
): Promise<ToolResult> {
  const { getCurrentStock, getLowStockItems, getInventoryValue } = await import(
    "./inventory.service"
  );
  const [stock, low, value] = await Promise.all([
    getCurrentStock(ctx),
    getLowStockItems(ctx),
    getInventoryValue(ctx),
  ]);
  return {
    ok: true,
    summary: `Inventory report: ${value.summary} ${low.summary}`,
    blocks: [
      ...(value.blocks ?? []),
      ...(low.blocks ?? []),
      ...(stock.blocks ?? []).slice(0, 1),
    ],
  };
}

export async function generateProfitReport(ctx: AiTenantCtx) {
  return getProfitReport(ctx);
}
