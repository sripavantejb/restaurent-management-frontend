import { z } from "zod";
import { Order } from "@/models/Order";
import { Payment } from "@/models/Payment";
import { withAuth, json, error } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const RefundSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().optional().default("Customer refund"),
  amountPaise: z.number().int().positive().optional(),
});

/** Full or partial refund — marks payment REFUNDED path via note + audit. */
export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = RefundSchema.parse(await req.json());
    const order = await Order.findOne({
      _id: body.orderId,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    if (!order) return error("Order not found", 404);
    if (order.status === "CANCELLED") {
      return error("Order already cancelled", 400);
    }

    const payment = await Payment.findOne({
      orderId: order._id,
      restaurantId: tenant.restaurantId,
    });
    const refundAmount = body.amountPaise ?? order.total;

    order.status = "CANCELLED";
    await order.save();

    await writeAudit({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      actorId: tenant.userId,
      actorType: "USER",
      action: "payment.refund",
      entityType: "Order",
      entityId: order._id.toString(),
      meta: {
        reason: body.reason,
        refundAmount,
        paymentId: payment?._id.toString() ?? null,
      },
    });

    return json({
      orderId: order._id.toString(),
      status: order.status,
      refundAmount,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid refund", 400);
    throw err;
  }
}, "payments.create");
