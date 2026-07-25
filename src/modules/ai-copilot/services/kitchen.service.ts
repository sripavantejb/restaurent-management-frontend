import { Order, type IOrder } from "@/models/Order";
import type { AiTenantCtx, ToolResult } from "../types";
import { formatInr, startOfDay } from "./date-utils";

function base(ctx: AiTenantCtx) {
  return { restaurantId: ctx.restaurantId, branchId: ctx.branchId };
}

export async function getKitchenQueue(ctx: AiTenantCtx): Promise<ToolResult> {
  const orders = (await Order.find({
    ...base(ctx),
    status: { $in: ["PLACED", "PREPARING"] },
  })
    .sort({ placedAt: 1 })
    .limit(40)
    .lean()) as unknown as IOrder[];

  const rows = orders.map((o) => {
    const waitMin = o.placedAt
      ? Math.round((Date.now() - new Date(o.placedAt).getTime()) / 60000)
      : 0;
    return {
      order: o.orderNumber,
      status: o.status,
      waitMin,
      items: o.items.map((i) => `${i.qty}× ${i.name}`).join(", "),
    };
  });

  return {
    ok: true,
    summary: `${rows.length} tickets in kitchen queue.`,
    blocks: [
      {
        type: "table",
        title: "Kitchen queue",
        data: { columns: ["order", "status", "waitMin", "items"], rows },
      },
    ],
    followUps: ["Show delayed orders", "Average prep time"],
  };
}

export async function getDelayedOrders(ctx: AiTenantCtx): Promise<ToolResult> {
  const threshold = 20;
  const orders = (await Order.find({
    ...base(ctx),
    status: { $in: ["PLACED", "PREPARING"] },
    placedAt: { $lte: new Date(Date.now() - threshold * 60000) },
  })
    .limit(30)
    .lean()) as unknown as IOrder[];
  return {
    ok: true,
    summary: `${orders.length} orders delayed over ${threshold} minutes.`,
    blocks: [
      {
        type: "table",
        title: "Delayed",
        data: {
          columns: ["orderNumber", "status", "waitMin"],
          rows: orders.map((o) => ({
            orderNumber: o.orderNumber,
            status: o.status,
            waitMin: o.placedAt
              ? Math.round(
                  (Date.now() - new Date(o.placedAt).getTime()) / 60000
                )
              : 0,
          })),
        },
      },
    ],
  };
}

export async function getCookingTime(ctx: AiTenantCtx): Promise<ToolResult> {
  const { getAveragePreparationTime } = await import("./orders.service");
  return getAveragePreparationTime(ctx);
}

export async function getChefPerformance(
  ctx: AiTenantCtx
): Promise<ToolResult> {
  const done = (await Order.find({
    ...base(ctx),
    status: { $in: ["READY", "SERVED", "COMPLETED"] },
    readyAt: { $gte: startOfDay() },
  }).lean()) as unknown as IOrder[];
  return {
    ok: true,
    summary: `${done.length} tickets completed by kitchen today.`,
    blocks: [
      {
        type: "kpi",
        data: [
          { label: "Tickets ready today", value: String(done.length) },
          {
            label: "Items cooked",
            value: String(
              done.reduce(
                (s, o) => s + o.items.reduce((a, i) => a + i.qty, 0),
                0
              )
            ),
          },
        ],
      },
      {
        type: "insight",
        data: {
          text: "Per-chef assignment lands when chefId is stamped on tickets.",
        },
      },
    ],
  };
}

export async function markKitchenOrderReady(
  ctx: AiTenantCtx,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const orderNumber = String(args.orderNumber || "").trim();
  if (!orderNumber) {
    return { ok: false, summary: "orderNumber required", error: "validation" };
  }
  const order = await Order.findOne({ ...base(ctx), orderNumber });
  if (!order) {
    return { ok: false, summary: "Order not found", error: "not_found" };
  }
  order.status = "READY";
  order.readyAt = new Date();
  order.items.forEach((i) => {
    i.status = "READY";
  });
  await order.save();
  return {
    ok: true,
    summary: `Order ${orderNumber} marked READY.`,
    blocks: [
      {
        type: "action",
        title: "Kitchen",
        data: { orderNumber, status: "READY" },
      },
    ],
  };
}
