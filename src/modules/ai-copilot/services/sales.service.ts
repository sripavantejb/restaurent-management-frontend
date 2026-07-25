import { Order, type IOrder } from "@/models/Order";
import type { AiTenantCtx, ToolResult } from "../types";
import {
  addDays,
  endOfDay,
  formatInr,
  parseDateOrNull,
  startOfDay,
} from "./date-utils";

function tenantFilter(ctx: AiTenantCtx) {
  return {
    restaurantId: ctx.restaurantId,
    branchId: ctx.branchId,
  };
}

async function completedBetween(
  ctx: AiTenantCtx,
  from: Date,
  to: Date
): Promise<IOrder[]> {
  return Order.find({
    ...tenantFilter(ctx),
    status: "COMPLETED",
    completedAt: { $gte: from, $lte: to },
  }).lean() as unknown as Promise<IOrder[]>;
}

function salesResult(
  label: string,
  orders: IOrder[],
  chart?: { hour: number; revenue: number }[]
): ToolResult {
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const tax = orders.reduce((s, o) => s + (o.taxAmount || 0), 0);
  const count = orders.length;
  const aov = count ? Math.round(revenue / count) : 0;
  return {
    ok: true,
    summary: `${label}: ${formatInr(revenue)} across ${count} orders (AOV ${formatInr(aov)}).`,
    data: {
      label,
      revenuePaise: revenue,
      revenueInr: revenue / 100,
      orderCount: count,
      aovPaise: aov,
      taxPaise: tax,
    },
    blocks: [
      {
        type: "kpi",
        title: label,
        data: [
          { label: "Revenue", value: formatInr(revenue) },
          { label: "Orders", value: String(count) },
          { label: "AOV", value: formatInr(aov) },
          { label: "Tax", value: formatInr(tax) },
        ],
      },
      ...(chart
        ? [
            {
              type: "chart" as const,
              title: "Hourly revenue",
              data: {
                kind: "bar",
                points: chart.map((c) => ({
                  x: `${c.hour}:00`,
                  y: c.revenue / 100,
                })),
              },
            },
          ]
        : []),
    ],
    followUps: [
      "Show top selling items",
      "Compare to yesterday",
      "What are peak hours?",
    ],
  };
}

export async function getSalesRange(
  ctx: AiTenantCtx,
  from: Date,
  to: Date,
  label: string
): Promise<ToolResult> {
  const orders = await completedBetween(ctx, from, to);
  return salesResult(label, orders);
}

export async function getTodaySales(ctx: AiTenantCtx): Promise<ToolResult> {
  const from = startOfDay();
  const orders = await completedBetween(ctx, from, endOfDay());
  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0 }));
  for (const o of orders) {
    if (!o.completedAt) continue;
    hourly[new Date(o.completedAt).getHours()].revenue += o.total;
  }
  return salesResult("Today's sales", orders, hourly);
}

export async function getYesterdaySales(ctx: AiTenantCtx): Promise<ToolResult> {
  const to = startOfDay();
  const from = addDays(to, -1);
  return getSalesRange(ctx, from, to, "Yesterday's sales");
}

export async function getWeeklySales(ctx: AiTenantCtx): Promise<ToolResult> {
  return getSalesRange(
    ctx,
    addDays(startOfDay(), -7),
    endOfDay(),
    "Last 7 days sales"
  );
}

export async function getMonthlySales(ctx: AiTenantCtx): Promise<ToolResult> {
  return getSalesRange(
    ctx,
    addDays(startOfDay(), -30),
    endOfDay(),
    "Last 30 days sales"
  );
}

export async function getYearlySales(ctx: AiTenantCtx): Promise<ToolResult> {
  return getSalesRange(
    ctx,
    addDays(startOfDay(), -365),
    endOfDay(),
    "Last 365 days sales"
  );
}

export async function getSalesBetweenDates(
  ctx: AiTenantCtx,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const from = parseDateOrNull(args.from) ?? addDays(startOfDay(), -7);
  const to = parseDateOrNull(args.to) ?? endOfDay();
  return getSalesRange(
    ctx,
    startOfDay(from),
    endOfDay(to),
    `Sales ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`
  );
}

export async function getTopSellingItems(
  ctx: AiTenantCtx,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const days = Number(args.days) || 7;
  const orders = await completedBetween(
    ctx,
    addDays(startOfDay(), -days),
    endOfDay()
  );
  const map = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const cur = map.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.qty * it.unitPrice;
      map.set(it.name, cur);
    }
  }
  const rows = [...map.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, Number(args.limit) || 10)
    .map((r) => ({
      item: r.name,
      qty: r.qty,
      revenue: formatInr(r.revenue),
    }));
  return {
    ok: true,
    summary: `Top ${rows.length} items by qty (last ${days} days).`,
    blocks: [
      {
        type: "table",
        title: "Top selling items",
        data: { columns: ["item", "qty", "revenue"], rows },
      },
      {
        type: "chart",
        title: "Top items by qty",
        data: {
          kind: "bar",
          points: rows.map((r) => ({ x: r.item, y: r.qty })),
        },
      },
    ],
    followUps: ["Least selling items?", "Food cost on top sellers?"],
  };
}

export async function getLeastSellingItems(
  ctx: AiTenantCtx,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const days = Number(args.days) || 30;
  const orders = await completedBetween(
    ctx,
    addDays(startOfDay(), -days),
    endOfDay()
  );
  const map = new Map<string, number>();
  for (const o of orders) {
    for (const it of o.items) {
      map.set(it.name, (map.get(it.name) ?? 0) + it.qty);
    }
  }
  const rows = [...map.entries()]
    .map(([item, qty]) => ({ item, qty }))
    .sort((a, b) => a.qty - b.qty)
    .slice(0, Number(args.limit) || 10);
  return {
    ok: true,
    summary: `Least selling items over ${days} days (${rows.length} shown).`,
    blocks: [
      {
        type: "table",
        title: "Least selling",
        data: { columns: ["item", "qty"], rows },
      },
      {
        type: "insight",
        title: "Menu tip",
        data: {
          text: rows.length
            ? `Consider promoting or trimming "${rows[0].item}" (${rows[0].qty} sold).`
            : "Not enough sales data yet.",
        },
      },
    ],
  };
}

export async function getPeakHours(ctx: AiTenantCtx): Promise<ToolResult> {
  const orders = await completedBetween(ctx, startOfDay(), endOfDay());
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    orders: 0,
    revenue: 0,
  }));
  for (const o of orders) {
    if (!o.completedAt) continue;
    const h = new Date(o.completedAt).getHours();
    hourly[h].orders += 1;
    hourly[h].revenue += o.total;
  }
  const peak = [...hourly].sort((a, b) => b.revenue - a.revenue)[0];
  return {
    ok: true,
    summary: peak
      ? `Peak hour today: ${peak.hour}:00 with ${formatInr(peak.revenue)}.`
      : "No completed sales yet today.",
    blocks: [
      {
        type: "chart",
        title: "Peak hours",
        data: {
          kind: "area",
          points: hourly
            .filter((h) => h.orders > 0)
            .map((h) => ({ x: `${h.hour}:00`, y: h.revenue / 100 })),
        },
      },
    ],
    followUps: ["Staff needed for peak hour?", "Compare to yesterday peak"],
  };
}

export async function getAverageOrderValue(
  ctx: AiTenantCtx
): Promise<ToolResult> {
  const orders = await completedBetween(ctx, startOfDay(), endOfDay());
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const aov = orders.length ? Math.round(revenue / orders.length) : 0;
  return {
    ok: true,
    summary: `Today's AOV is ${formatInr(aov)} (${orders.length} orders).`,
    blocks: [
      {
        type: "kpi",
        title: "AOV",
        data: [{ label: "Average order value", value: formatInr(aov) }],
      },
    ],
  };
}

export async function getRevenue(ctx: AiTenantCtx): Promise<ToolResult> {
  return getTodaySales(ctx);
}

export async function getProfit(ctx: AiTenantCtx): Promise<ToolResult> {
  const sales = await getTodaySales(ctx);
  const revenue = Number(sales.data?.revenuePaise ?? 0);
  /** Approx food cost 32% until recipe costing is linked per order */
  const cogs = Math.round(revenue * 0.32);
  const profit = revenue - cogs;
  return {
    ok: true,
    summary: `Estimated today profit ${formatInr(profit)} (COGS ≈32% of sales).`,
    blocks: [
      {
        type: "kpi",
        title: "Profit estimate",
        data: [
          { label: "Revenue", value: formatInr(revenue) },
          { label: "Est. COGS", value: formatInr(cogs) },
          { label: "Est. profit", value: formatInr(profit) },
          {
            label: "Margin",
            value: revenue ? `${Math.round((profit / revenue) * 100)}%` : "0%",
          },
        ],
      },
      {
        type: "insight",
        data: {
          text: "Profit uses estimated food cost until full recipe costing is attached to every SKU.",
        },
      },
    ],
    followUps: ["Show low stock", "Inventory value"],
  };
}

export async function getLoss(ctx: AiTenantCtx): Promise<ToolResult> {
  const p = await getProfit(ctx);
  const revenue = Number(p.data?.revenuePaise ?? 0);
  if (!revenue) {
    return {
      ok: true,
      summary: "No completed revenue today — loss not applicable yet.",
    };
  }
  return {
    ok: true,
    summary: "No operating loss flagged on estimated COGS model for today.",
    blocks: p.blocks,
  };
}
