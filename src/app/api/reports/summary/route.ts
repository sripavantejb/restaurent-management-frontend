import { Order, type IOrder } from "@/models/Order";
import { Table, type ITable } from "@/models/Table";
import { Branch, type IBranch } from "@/models/Branch";
import { InventoryItem } from "@/models/InventoryItem";
import { Expense } from "@/models/Expense";
import { Reservation } from "@/models/Reservation";
import { Attendance } from "@/models/Attendance";
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
  const dateKey = todayStart.toISOString().slice(0, 10);

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
    lowStock,
    kitchenPending,
    todayExpenses,
    upcomingReservations,
    attendancePresent,
    aiHints,
  ] = await Promise.all([
    Order.find({ ...base, completedAt: { $gte: todayStart } }).lean() as unknown as Promise<IOrder[]>,
    Order.find({
      ...base,
      completedAt: { $gte: yesterdayStart, $lt: todayStart },
    }).lean() as unknown as Promise<IOrder[]>,
    Order.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      status: "COMPLETED",
      completedAt: { $gte: weekStart },
    }).lean() as unknown as Promise<IOrder[]>,
    Table.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    }).lean() as unknown as Promise<ITable[]>,
    user.permissions.includes("branch.switch")
      ? (Branch.find({
          restaurantId: tenant.restaurantId,
          isActive: true,
        }).lean() as unknown as Promise<IBranch[]>)
      : Promise.resolve([] as IBranch[]),
    InventoryItem.countDocuments({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      isActive: true,
      $expr: { $lte: ["$quantityOnHand", "$reorderLevel"] },
    }),
    Order.countDocuments({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      status: { $in: ["PLACED", "PREPARING"] },
    }),
    Expense.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      paidAt: { $gte: todayStart },
    }).lean(),
    Reservation.countDocuments({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      scheduledAt: { $gte: todayStart },
      status: { $in: ["BOOKED", "CONFIRMED", "WAITLIST"] },
    }),
    Attendance.countDocuments({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      date: dateKey,
      status: { $in: ["PRESENT", "LATE"] },
    }),
    Promise.resolve([] as string[]),
  ]);

  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + o.total, 0);
  const todayCount = todayOrders.length;
  const yesterdayCount = yesterdayOrders.length;
  const aov = todayCount ? Math.round(todayRevenue / todayCount) : 0;
  const yesterdayAov = yesterdayCount
    ? Math.round(yesterdayRevenue / yesterdayCount)
    : 0;
  const expensePaise = todayExpenses.reduce((s, e) => s + e.amountPaise, 0);
  const profitPaise = todayRevenue - expensePaise;

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

  const occupied = tables.filter((t) =>
    ["OCCUPIED", "BILLED", "PREPARING_BILL"].includes(t.status)
  ).length;

  const insights: string[] = [];
  if (lowStock > 0) insights.push(`${lowStock} ingredients below reorder level.`);
  if (kitchenPending > 5)
    insights.push(`Kitchen queue busy (${kitchenPending} tickets).`);
  if (todayRevenue < yesterdayRevenue * 0.8 && yesterdayRevenue > 0)
    insights.push("Sales trailing yesterday — check peak-hour staffing.");
  if (upcomingReservations > 0)
    insights.push(`${upcomingReservations} reservations today.`);
  if (!insights.length)
    insights.push("Operations look steady. Ask AI Copilot for deeper analysis.");

  let branchComparison: {
    id: string;
    name: string;
    revenue: number;
    orders: number;
  }[] = [];
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

  void aiHints;

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
      expenses: expensePaise,
      profit: profitPaise,
      kitchenQueue: kitchenPending,
      lowStock,
      reservations: upcomingReservations,
      attendance: attendancePresent,
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
    insights,
  });
}, "reports.view");
