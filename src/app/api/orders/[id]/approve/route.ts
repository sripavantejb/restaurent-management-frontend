import { z } from "zod";
import { Order } from "@/models/Order";
import { withAuth, json, error, getParams } from "@/lib/api";
import { recomputeSessionTotals } from "@/lib/session";

const BodySchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().max(200).optional(),
});

export const POST = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing order id", 400);

  try {
    const body = BodySchema.parse(await req.json());
    const order = await Order.findOne({
      _id: id,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    if (!order) return error("Order not found", 404);

    if (order.approvalStatus !== "PENDING" || order.status !== "DRAFT") {
      return error(
        "Order is not awaiting approval",
        409,
        "Only guest drafts with PENDING approval can be approved or rejected."
      );
    }

    if (body.action === "APPROVE") {
      order.approvalStatus = "APPROVED";
      order.status = "PLACED";
      order.placedAt = order.placedAt ?? new Date();
      await order.save();
      if (order.sessionId) {
        await recomputeSessionTotals(order.sessionId);
      }
      return json({
        id: order._id.toString(),
        status: order.status,
        approvalStatus: order.approvalStatus,
      });
    }

    order.approvalStatus = "REJECTED";
    order.status = "CANCELLED";
    await order.save();
    if (order.sessionId) {
      await recomputeSessionTotals(order.sessionId);
    }

    return json({
      id: order._id.toString(),
      status: order.status,
      approvalStatus: order.approvalStatus,
      reason: body.reason || "",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid approval action", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "orders.update");
