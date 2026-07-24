import { Order } from "@/models/Order";
import { Payment } from "@/models/Payment";
import type { IOrder } from "@/models/Order";
import type { IPayment } from "@/models/Payment";
import { withAuth, json, error, getParams } from "@/lib/api";

export const GET = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing order id", 400);

  const order = (await Order.findOne({
    _id: id,
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  }).lean()) as IOrder | null;

  if (!order) return error("Order not found", 404);

  const payment = (await Payment.findOne({
    orderId: order._id,
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  }).lean()) as IPayment | null;

  return json({
    order: {
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      type: order.type,
      tableId: order.tableId?.toString() ?? null,
      status: order.status,
      items: order.items,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      total: order.total,
      placedAt: order.placedAt,
      readyAt: order.readyAt,
      completedAt: order.completedAt,
    },
    payment: payment
      ? {
          id: payment._id.toString(),
          method: payment.method,
          amount: payment.amount,
          tenderedAmount: payment.tenderedAmount,
          changeAmount: payment.changeAmount,
          paidAt: payment.paidAt,
        }
      : null,
  });
}, "orders.view");
