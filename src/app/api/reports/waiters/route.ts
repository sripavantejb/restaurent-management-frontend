import { Types } from "mongoose";
import { User } from "@/models/User";
import { Order } from "@/models/Order";
import { withAuth, json } from "@/lib/api";

export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") || 7)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const waiters = (await User.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    role: "WAITER",
  })
    .select("name email isActive")
    .lean()) as unknown as {
    _id: Types.ObjectId;
    name: string;
    email: string;
    isActive: boolean;
  }[];

  const waiterIds = waiters.map((w) => w._id);

  const stats = await Order.aggregate([
    {
      $match: {
        restaurantId: new Types.ObjectId(String(tenant.restaurantId)),
        branchId: new Types.ObjectId(String(tenant.branchId)),
        waiterId: { $in: waiterIds },
        status: { $ne: "CANCELLED" },
        placedAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: "$waiterId",
        orders: { $sum: 1 },
        revenue: { $sum: "$total" },
        items: {
          $sum: {
            $reduce: {
              input: "$items",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.qty"] },
            },
          },
        },
        completed: {
          $sum: {
            $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0],
          },
        },
      },
    },
  ]);

  const byId = new Map(
    stats.map((s: { _id: Types.ObjectId; orders: number; revenue: number; items: number; completed: number }) => [
      s._id.toString(),
      s,
    ])
  );

  const rows = waiters.map((w) => {
    const s = byId.get(w._id.toString());
    const orders = s?.orders ?? 0;
    const revenue = s?.revenue ?? 0;
    return {
      id: w._id.toString(),
      name: w.name,
      email: w.email,
      isActive: w.isActive,
      orders,
      completed: s?.completed ?? 0,
      items: s?.items ?? 0,
      revenue,
      avgTicket: orders ? Math.round(revenue / orders) : 0,
    };
  });

  rows.sort((a, b) => b.revenue - a.revenue);

  return json({
    days,
    since: since.toISOString(),
    waiters: rows,
    totals: {
      waiters: rows.length,
      orders: rows.reduce((n, r) => n + r.orders, 0),
      revenue: rows.reduce((n, r) => n + r.revenue, 0),
    },
  });
}, "reports.view");
