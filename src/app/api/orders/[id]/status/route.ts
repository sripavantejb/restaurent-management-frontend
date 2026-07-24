import { z } from "zod";
import { Types } from "mongoose";
import { Order, type IOrderItem } from "@/models/Order";
import { Table } from "@/models/Table";
import { withAuth, json, error, getParams } from "@/lib/api";

const StatusSchema = z.object({
  status: z
    .enum(["PLACED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"])
    .optional(),
  itemId: z.string().optional(),
  itemStatus: z.enum(["QUEUED", "COOKING", "READY"]).optional(),
});

export const PATCH = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing order id", 400);

  try {
    const body = StatusSchema.parse(await req.json());
    const order = await Order.findOne({
      _id: id,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    if (!order) return error("Order not found", 404);

    const items = order.items as Types.DocumentArray<IOrderItem>;

    if (body.itemId && body.itemStatus) {
      const item = items.id(body.itemId);
      if (!item) return error("Order item not found", 404);
      item.status = body.itemStatus;

      const allReady = items.every((i: IOrderItem) => i.status === "READY");
      const anyCooking = items.some((i: IOrderItem) => i.status === "COOKING");
      if (allReady) {
        order.status = "READY";
        order.readyAt = order.readyAt ?? new Date();
      } else if (anyCooking || body.itemStatus === "COOKING") {
        order.status = "PREPARING";
      }
    }

    if (body.status) {
      order.status = body.status;
      if (body.status === "PREPARING" && !order.placedAt) {
        order.placedAt = new Date();
      }
      if (body.status === "READY") {
        order.readyAt = new Date();
        items.forEach((i: IOrderItem) => {
          i.status = "READY";
        });
      }
      if (body.status === "SERVED") {
        order.servedAt = new Date();
      }
      if (body.status === "COMPLETED") {
        order.completedAt = new Date();
        if (order.tableId) {
          await Table.updateOne(
            {
              _id: order.tableId,
              restaurantId: tenant.restaurantId,
              branchId: tenant.branchId,
            },
            { $set: { status: "FREE" } }
          );
        }
      }
      if (body.status === "PREPARING") {
        items.forEach((i: IOrderItem) => {
          if (i.status === "QUEUED") i.status = "COOKING";
        });
      }
    }

    // Advance helper: PLACED → PREPARING → READY → SERVED when only tapping card
    if (!body.status && !body.itemId) {
      if (order.status === "PLACED") {
        order.status = "PREPARING";
        items.forEach((i: IOrderItem) => {
          if (i.status === "QUEUED") i.status = "COOKING";
        });
      } else if (order.status === "PREPARING") {
        order.status = "READY";
        order.readyAt = new Date();
        items.forEach((i: IOrderItem) => {
          i.status = "READY";
        });
      } else if (order.status === "READY") {
        order.status = "SERVED";
        order.servedAt = new Date();
      }
    }

    await order.save();

    return json({
      id: order._id.toString(),
      status: order.status,
      items: order.items,
      readyAt: order.readyAt,
      servedAt: order.servedAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid status update", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "orders.update");
