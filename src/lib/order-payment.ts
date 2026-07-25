import { Types } from "mongoose";
import { Order } from "@/models/Order";
import { Payment } from "@/models/Payment";

/** Recompute order.paidAmountPaise + paymentStatus from Payment rows (CHARGE − REFUND). */
export async function syncOrderPaymentState(
  orderId: Types.ObjectId | string
) {
  const oid =
    typeof orderId === "string" ? new Types.ObjectId(orderId) : orderId;
  const rows = await Payment.aggregate<{
    charge: number;
    refund: number;
  }>([
    { $match: { orderId: oid } },
    {
      $group: {
        _id: null,
        charge: {
          $sum: {
            $cond: [{ $ne: ["$kind", "REFUND"] }, "$amount", 0],
          },
        },
        refund: {
          $sum: {
            $cond: [{ $eq: ["$kind", "REFUND"] }, "$amount", 0],
          },
        },
      },
    },
  ]);

  const charge = rows[0]?.charge ?? 0;
  const refund = rows[0]?.refund ?? 0;
  const net = Math.max(0, charge - refund);

  const order = await Order.findById(oid);
  if (!order) return null;

  order.paidAmountPaise = net;
  if (refund > 0 && net <= 0) {
    order.paymentStatus = "REFUNDED";
  } else if (net <= 0) {
    order.paymentStatus = "UNPAID";
  } else if (net < order.total) {
    order.paymentStatus = "PARTIAL";
  } else {
    order.paymentStatus = "PAID";
  }
  await order.save();
  return order;
}
