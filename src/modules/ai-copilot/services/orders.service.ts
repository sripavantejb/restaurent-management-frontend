import { Order, type IOrder } from "@/models/Order";
import type { AiTenantCtx, ToolResult } from "../types";
import { endOfDay, formatInr, startOfDay } from "./date-utils";

function base(ctx: AiTenantCtx) {
  return { restaurantId: ctx.restaurantId, branchId: ctx.branchId };
}

function mapOrders(orders: IOrder[]) {
  return orders.map((o) => ({
    orderNumber: o.orderNumber,
    status: o.status,
    type: o.type,
    total: formatInr(o.total),
    items: o.items.length,
    placedAt: o.placedAt,
  }));
}

export async function getOrdersToday(ctx: AiTenantCtx): Promise<ToolResult> {
  const orders = (await Order.find({
    ...base(ctx),
    placedAt: { $gte: startOfDay(), $lte: endOfDay() },
  })
    .sort({ placedAt: -1 })
    .limit(100)
    .lean()) as unknown as IOrder[];
  return {
    ok: true,
    summary: `${orders.length} orders placed today.`,
    blocks: [
      {
        type: "table",
        title: "Today's orders",
        data: {
          columns: ["orderNumber", "status", "type", "total", "items"],
          rows: mapOrders(orders).map(({ placedAt: _p, ...r }) => r),
        },
      },
    ],
  };
}

export async function getPendingOrders(ctx: AiTenantCtx): Promise<ToolResult> {
  const orders = (await Order.find({
    ...base(ctx),
    status: { $in: ["PLACED", "PREPARING"] },
  })
    .sort({ placedAt: 1 })
    .limit(50)
    .lean()) as unknown as IOrder[];
  return {
    ok: true,
    summary: `${orders.length} pending / preparing orders.`,
    blocks: [
      {
        type: "table",
        title: "Pending orders",
        data: {
          columns: ["orderNumber", "status", "type", "total", "items"],
          rows: mapOrders(orders).map(({ placedAt: _p, ...r }) => r),
        },
      },
    ],
    followUps: ["Show delayed kitchen orders", "Mark oldest ready?"],
  };
}

export async function getCancelledOrders(ctx: AiTenantCtx): Promise<ToolResult> {
  const orders = (await Order.find({
    ...base(ctx),
    status: "CANCELLED",
    placedAt: { $gte: startOfDay() },
  })
    .limit(50)
    .lean()) as unknown as IOrder[];
  return {
    ok: true,
    summary: `${orders.length} cancelled orders today.`,
    blocks: [
      {
        type: "table",
        title: "Cancelled",
        data: {
          columns: ["orderNumber", "type", "total"],
          rows: orders.map((o) => ({
            orderNumber: o.orderNumber,
            type: o.type,
            total: formatInr(o.total),
          })),
        },
      },
    ],
  };
}

export async function getCompletedOrders(ctx: AiTenantCtx): Promise<ToolResult> {
  const orders = (await Order.find({
    ...base(ctx),
    status: "COMPLETED",
    completedAt: { $gte: startOfDay() },
  })
    .limit(100)
    .lean()) as unknown as IOrder[];
  return {
    ok: true,
    summary: `${orders.length} completed orders today.`,
    data: { count: orders.length },
  };
}

export async function getAveragePreparationTime(
  ctx: AiTenantCtx
): Promise<ToolResult> {
  const orders = (await Order.find({
    ...base(ctx),
    status: { $in: ["READY", "SERVED", "COMPLETED"] },
    placedAt: { $gte: startOfDay() },
    readyAt: { $ne: null },
  }).lean()) as unknown as IOrder[];
  const mins = orders
    .filter((o) => o.placedAt && o.readyAt)
    .map(
      (o) =>
        (new Date(o.readyAt!).getTime() - new Date(o.placedAt!).getTime()) /
        60000
    );
  const avg =
    mins.length > 0
      ? Math.round((mins.reduce((a, b) => a + b, 0) / mins.length) * 10) / 10
      : 0;
  return {
    ok: true,
    summary: `Average prep time today: ${avg} minutes (${mins.length} samples).`,
    blocks: [
      {
        type: "kpi",
        data: [{ label: "Avg prep (min)", value: String(avg) }],
      },
    ],
  };
}
