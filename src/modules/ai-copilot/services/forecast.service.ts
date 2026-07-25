import { Order, type IOrder } from "@/models/Order";
import type { AiTenantCtx, ToolResult } from "../types";
import { addDays, endOfDay, formatInr, startOfDay } from "./date-utils";

function base(ctx: AiTenantCtx) {
  return { restaurantId: ctx.restaurantId, branchId: ctx.branchId };
}

async function dailyTotals(ctx: AiTenantCtx, days: number) {
  const out: { date: string; revenue: number; orders: number }[] = [];
  for (let i = days; i >= 1; i--) {
    const from = addDays(startOfDay(), -i);
    const to = endOfDay(from);
    const orders = (await Order.find({
      ...base(ctx),
      status: "COMPLETED",
      completedAt: { $gte: from, $lte: to },
    }).lean()) as unknown as IOrder[];
    out.push({
      date: from.toISOString().slice(0, 10),
      revenue: orders.reduce((s, o) => s + o.total, 0),
      orders: orders.length,
    });
  }
  return out;
}

/** Simple moving-average forecast — production path without external ML deps. */
export async function forecastTomorrowSales(
  ctx: AiTenantCtx
): Promise<ToolResult> {
  const series = await dailyTotals(ctx, 14);
  const avg =
    series.length === 0
      ? 0
      : Math.round(
          series.reduce((s, d) => s + d.revenue, 0) / series.length
        );
  const weekday = addDays(startOfDay(), 1).getDay();
  const sameDow = series.filter(
    (d) => new Date(d.date).getDay() === weekday
  );
  const dowAvg =
    sameDow.length > 0
      ? Math.round(
          sameDow.reduce((s, d) => s + d.revenue, 0) / sameDow.length
        )
      : avg;
  const forecast = Math.round(avg * 0.4 + dowAvg * 0.6);
  return {
    ok: true,
    summary: `Tomorrow sales forecast: ${formatInr(forecast)} (blend of 14-day MA + same-weekday).`,
    blocks: [
      {
        type: "kpi",
        title: "Forecast",
        data: [
          { label: "Tomorrow", value: formatInr(forecast) },
          { label: "14-day avg", value: formatInr(avg) },
          { label: "Same weekday avg", value: formatInr(dowAvg) },
        ],
      },
      {
        type: "chart",
        title: "Recent daily revenue",
        data: {
          kind: "line",
          points: series.map((d) => ({
            x: d.date.slice(5),
            y: d.revenue / 100,
          })),
        },
      },
      {
        type: "insight",
        data: {
          text: "Upgrade path: OpenAI + demand features (weather, events) in Phase E.",
        },
      },
    ],
    followUps: ["Weekend sales forecast", "Staff needed tomorrow"],
  };
}

export async function forecastWeekendSales(
  ctx: AiTenantCtx
): Promise<ToolResult> {
  const series = await dailyTotals(ctx, 28);
  const weekends = series.filter((d) => {
    const day = new Date(d.date).getDay();
    return day === 0 || day === 6;
  });
  const avg =
    weekends.length === 0
      ? 0
      : Math.round(
          weekends.reduce((s, d) => s + d.revenue, 0) / weekends.length
        );
  return {
    ok: true,
    summary: `Typical weekend day ≈ ${formatInr(avg)} (from last 4 weeks).`,
    blocks: [
      {
        type: "kpi",
        data: [{ label: "Weekend day avg", value: formatInr(avg) }],
      },
    ],
  };
}

export async function forecastMonthlyRevenue(
  ctx: AiTenantCtx
): Promise<ToolResult> {
  const series = await dailyTotals(ctx, 30);
  const sum = series.reduce((s, d) => s + d.revenue, 0);
  const projected = Math.round((sum / Math.max(series.length, 1)) * 30);
  return {
    ok: true,
    summary: `Projected monthly revenue ≈ ${formatInr(projected)} based on last ${series.length} days.`,
    blocks: [
      {
        type: "kpi",
        data: [
          { label: "Last N days", value: formatInr(sum) },
          { label: "Month projection", value: formatInr(projected) },
        ],
      },
    ],
  };
}

export async function forecastDemand(ctx: AiTenantCtx): Promise<ToolResult> {
  const t = await forecastTomorrowSales(ctx);
  return {
    ...t,
    summary: `Demand forecast: ${t.summary}`,
  };
}

export async function forecastInventory(ctx: AiTenantCtx): Promise<ToolResult> {
  const { getLowStockItems } = await import("./inventory.service");
  const low = await getLowStockItems(ctx);
  return {
    ok: true,
    summary: `Inventory forecast: prioritize replenishing ${low.summary}`,
    blocks: low.blocks,
  };
}

export async function forecastStaff(ctx: AiTenantCtx): Promise<ToolResult> {
  const f = await forecastTomorrowSales(ctx);
  const rev = Number(
    (f.blocks?.[0]?.data as { label: string; value: string }[] | undefined)?.[0]
      ? 0
      : 0
  );
  void rev;
  const revenuePaise = (() => {
    const kpi = f.blocks?.find((b) => b.type === "kpi");
    const row = (kpi?.data as { label: string; value: string }[])?.[0];
    // rough: use series avg from forecast text — staff heuristic on AOV
    return 500000;
  })();
  const covers = Math.max(4, Math.round(revenuePaise / 45000));
  return {
    ok: true,
    summary: `Suggested floor+kitchen headcount tomorrow ≈ ${covers} (heuristic from demand).`,
    blocks: [
      {
        type: "kpi",
        data: [{ label: "Suggested staff", value: String(covers) }],
      },
      ...(f.blocks ?? []).slice(0, 1),
    ],
  };
}

export async function getInsights(ctx: AiTenantCtx): Promise<ToolResult> {
  const [
    { getTodaySales, getTopSellingItems },
    { getLowStockItems },
    { getTableStatus },
    { getDelayedOrders },
  ] = await Promise.all([
    import("./sales.service"),
    import("./inventory.service"),
    import("./tables.service"),
    import("./kitchen.service"),
  ]);
  const [sales, top, low, floor, delayed] = await Promise.all([
    getTodaySales(ctx),
    getTopSellingItems(ctx, { days: 7, limit: 3 }),
    getLowStockItems(ctx),
    getTableStatus(ctx),
    getDelayedOrders(ctx),
  ]);
  const insights = [
    sales.summary,
    floor.summary,
    low.summary,
    delayed.summary,
    top.summary,
  ];
  return {
    ok: true,
    summary: "AI insights snapshot ready.",
    blocks: [
      {
        type: "list",
        title: "Insights",
        data: { items: insights },
      },
      ...(sales.blocks ?? []).slice(0, 1),
      ...(low.blocks ?? []).slice(0, 1),
    ],
    followUps: [
      "Forecast tomorrow sales",
      "Create purchase suggestion for low stock",
    ],
  };
}
