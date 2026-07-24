import { z } from "zod";
import { Order } from "@/models/Order";
import { Payment } from "@/models/Payment";
import { Table } from "@/models/Table";
import { withAuth, json, error } from "@/lib/api";

const PaymentSchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(["CASH", "CARD", "UPI"]),
  tenderedAmount: z.number().int().nonnegative().optional().default(0),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = PaymentSchema.parse(await req.json());
    const order = await Order.findOne({
      _id: body.orderId,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    if (!order) return error("Order not found", 404);
    if (order.status === "COMPLETED") {
      return error("Order already paid", 400, "Open a new order on POS.");
    }
    if (order.status === "CANCELLED") {
      return error("Cannot pay a cancelled order", 400);
    }

    let tendered = body.tenderedAmount;
    let change = 0;
    if (body.method === "CASH") {
      if (tendered < order.total) {
        return error(
          "Tendered amount is less than total",
          400,
          "Enter an amount equal to or greater than the bill."
        );
      }
      change = tendered - order.total;
    } else {
      tendered = order.total;
      change = 0;
    }

    const payment = await Payment.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      orderId: order._id,
      method: body.method,
      amount: order.total,
      tenderedAmount: tendered,
      changeAmount: change,
      paidAt: new Date(),
    });

    order.status = "COMPLETED";
    order.completedAt = new Date();
    if (!order.servedAt) order.servedAt = new Date();
    await order.save();

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

    return json(
      {
        id: payment._id.toString(),
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        method: payment.method,
        amount: payment.amount,
        changeAmount: payment.changeAmount,
      },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid payment", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "payments.create");
