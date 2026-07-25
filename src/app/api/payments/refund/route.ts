import { z } from "zod";
import { Order } from "@/models/Order";
import { Payment } from "@/models/Payment";
import { withAuth, json, error } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { syncOrderPaymentState } from "@/lib/order-payment";

const RefundSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().optional().default("Customer refund"),
  amountPaise: z.number().int().positive().optional(),
});

/** Full or partial refund — writes a REFUND Payment row and syncs order paymentStatus. */
export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = RefundSchema.parse(await req.json());
    const order = await Order.findOne({
      _id: body.orderId,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    if (!order) return error("Order not found", 404);
    if (order.status === "CANCELLED" && order.paymentStatus === "REFUNDED") {
      return error("Order already refunded", 400);
    }

    const charges = await Payment.aggregate([
      {
        $match: {
          orderId: order._id,
          restaurantId: tenant.restaurantId,
          kind: { $ne: "REFUND" },
        },
      },
      { $group: { _id: null, sum: { $sum: "$amount" } } },
    ]);
    const refunds = await Payment.aggregate([
      {
        $match: {
          orderId: order._id,
          restaurantId: tenant.restaurantId,
          kind: "REFUND",
        },
      },
      { $group: { _id: null, sum: { $sum: "$amount" } } },
    ]);
    const netPaid = Math.max(
      0,
      (charges[0]?.sum ?? 0) - (refunds[0]?.sum ?? 0)
    );
    if (netPaid <= 0) {
      return error("Nothing to refund", 400, "No charged payments on this order.");
    }

    const refundAmount = Math.min(body.amountPaise ?? netPaid, netPaid);
    const method =
      (
        await Payment.findOne({
          orderId: order._id,
          kind: { $ne: "REFUND" },
        }).sort({ paidAt: -1 })
      )?.method || "CASH";

    const refundPayment = await Payment.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      orderId: order._id,
      sessionId: order.sessionId ?? null,
      kind: "REFUND",
      method,
      amount: refundAmount,
      tenderedAmount: 0,
      changeAmount: 0,
      isPartial: refundAmount < netPaid,
      notes: body.reason,
      paidAt: new Date(),
    });

    await syncOrderPaymentState(order._id);

    const fresh = await Order.findById(order._id);
    if (fresh && (fresh.paymentStatus === "REFUNDED" || fresh.paidAmountPaise <= 0)) {
      fresh.status = "CANCELLED";
      fresh.paymentStatus = "REFUNDED";
      await fresh.save();
    }

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
        paymentId: refundPayment._id.toString(),
      },
    });

    return json({
      orderId: order._id.toString(),
      status: fresh?.status ?? order.status,
      paymentStatus: fresh?.paymentStatus ?? "REFUNDED",
      refundAmount,
      refundPaymentId: refundPayment._id.toString(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid refund", 400);
    throw err;
  }
}, "payments.create");
