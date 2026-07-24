import { Order, type IOrder } from "@/models/Order";
import { Table, type ITable } from "@/models/Table";
import { Branch, type IBranch } from "@/models/Branch";
import { withAuth, json } from "@/lib/api";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function pctChange(today: number, yesterday: number): number {
  if (yesterday === 0) return today === 0 ? 0 : 100;
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10;
}

export const GET = withAuth(async ({ tenant, user }) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const base = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    status: "COMPLETED" as const,
  };

  const [
    todayOrders,
    yesterdayOrders,
    weekOrders,
    tables,
    branches,
  ] = (await Promise.all([
    Order.find({
      ...base,
      completedAt: { $gte: todayStart },
    }).lean(),
    Order.find({
      ...base,
      completedAt: { $gte: yesterdayStart, $lt: todayStart },
    }).lean(),
    Order.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      status: "COMPLETED",
      completedAt: { $gte: weekStart },
    }).lean(),
    Table.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    }).lean(),
    user.permissions.includes("branch.switch")
      ? Branch.find({ restaurantId: tenant.restaurantId, isActive: true }).lean()
      : Promise.resolve([]),
  ])) as unknown as [IOrder[], IOrder[], IOrder[], ITable[], IBranch[]];

  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + o.total, 0);
  const todayCount = todayOrders.length;
  const yesterdayCount = yesterdayOrders.length;
  const aov = todayCount ? Math.round(todayRevenue / todayCount) : 0;
  const yesterdayAov = yesterdayCount
    ? Math.round(yesterdayRevenue / yesterdayCount)
    : 0;

  const prepTimes = todayOrders
    .filter((o) => o.placedAt && o.readyAt)
    .map(
      (o) =>
        (new Date(o.readyAt!).getTime() - new Date(o.placedAt!).getTime()) /
        60000
    );
  const avgPrep =
    prepTimes.length > 0
      ? Math.round((prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) * 10) /
        10
      : 0;

  const yPrep = yesterdayOrders
    .filter((o) => o.placedAt && o.readyAt)
    .map(
      (o) =>
        (new Date(o.readyAt!).getTime() - new Date(o.placedAt!).getTime()) /
        60000
    );
  const yAvgPrep =
    yPrep.length > 0
      ? Math.round((yPrep.reduce((a, b) => a + b, 0) / yPrep.length) * 10) / 10
      : 0;

  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0 }));
  for (const o of todayOrders) {
    if (!o.completedAt) continue;
    const h = new Date(o.completedAt).getHours();
    hourly[h].revenue += o.total;
  }

  const itemMap = new Map<string, { name: string; qty: number }>();
  for (const o of weekOrders) {
    for (const it of o.items) {
      const cur = itemMap.get(it.name) ?? { name: it.name, qty: 0 };
      cur.qty += it.qty;
      itemMap.set(it.name, cur);
    }
  }
  const topItems = [...itemMap.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  const occupied = tables.filter((t) => t.status === "OCCUPIED" || t.status === "BILLED").length;

  let branchComparison: { id: string; name: string; revenue: number; orders: number }[] = [];
  if (user.role === "OWNER" && branches.length) {
    const allToday = (await Order.find({
      restaurantId: tenant.restaurantId,
      status: "COMPLETED",
      completedAt: { $gte: todayStart },
    }).lean()) as unknown as IOrder[];
    branchComparison = branches.map((b) => {
      const list = allToday.filter(
        (o) => o.branchId.toString() === b._id.toString()
      );
      return {
        id: b._id.toString(),
        name: b.name,
        revenue: list.reduce((s, o) => s + o.total, 0),
        orders: list.length,
      };
    });
  }

  return json({
    kpis: {
      revenue: todayRevenue,
      revenueChange: pctChange(todayRevenue, yesterdayRevenue),
      orderCount: todayCount,
      orderCountChange: pctChange(todayCount, yesterdayCount),
      aov,
      aovChange: pctChange(aov, yesterdayAov),
      avgPrepMins: avgPrep,
      avgPrepChange: pctChange(avgPrep, yAvgPrep),
    },
    hourly,
    topItems,
    occupancy: {
      occupied,
      total: tables.length,
      tables: tables.map((t) => ({
        id: t._id.toString(),
        number: t.number,
        x: t.x,
        y: t.y,
        status: t.status,
      })),
    },
    branchComparison,
  });
}, "reports.view");
