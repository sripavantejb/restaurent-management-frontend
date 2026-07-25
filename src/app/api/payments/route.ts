import { z } from "zod";
import { Order } from "@/models/Order";
import { Payment } from "@/models/Payment";
import { TableSession } from "@/models/TableSession";
import { withAuth, json, error } from "@/lib/api";
import { recomputeSessionTotals } from "@/lib/session";
import { settlePaidSession } from "@/lib/settle";

const PaymentSchema = z.object({
  orderId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  method: z.enum(["CASH", "CARD", "UPI"]),
  tenderedAmount: z.number().int().nonnegative().optional().default(0),
}).refine((b) => !!b.orderId || !!b.sessionId, {
  message: "Provide orderId or sessionId",
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = PaymentSchema.parse(await req.json());

    // Session-level collect (QR bill at counter / waiter)
    if (body.sessionId) {
      const session = await TableSession.findOne({
        _id: body.sessionId,
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        status: { $in: ["OPEN", "BILL_REQUESTED"] },
      });
      if (!session) return error("Open session not found", 404);

      await recomputeSessionTotals(session._id);
      const fresh = await TableSession.findById(session._id);
      if (!fresh) return error("Session missing", 500);
      if (fresh.dueAmount <= 0) {
        return error("Nothing due on this table", 400);
      }

      let tendered = body.tenderedAmount;
      let change = 0;
      if (body.method === "CASH") {
        if (tendered < fresh.dueAmount) {
          return error(
            "Tendered amount is less than due",
            400,
            "Enter an amount equal to or greater than the bill."
          );
        }
        change = tendered - fresh.dueAmount;
      } else {
        tendered = fresh.dueAmount;
      }

      const amount = fresh.dueAmount;
      const payment = await Payment.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        sessionId: session._id,
        orderId: null,
        method: body.method,
        amount,
        tenderedAmount: tendered,
        changeAmount: change,
        tipAmount: fresh.tipAmount,
        paidAt: new Date(),
      });

      const closed = await settlePaidSession(session._id, {
        closedBy: tenant.userId,
      });
      if (!closed || closed.dueAmount > 0) {
        return error("Payment incomplete", 400);
      }

      return json(
        {
          id: payment._id.toString(),
          sessionId: session._id.toString(),
          method: payment.method,
          amount: payment.amount,
          changeAmount: payment.changeAmount,
          sessionStatus: "BILLED",
          tableReset: true,
        },
        201
      );
    }

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
      sessionId: order.sessionId ?? null,
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

    const { deductInventoryForOrder } = await import("@/lib/inventory");
    await deductInventoryForOrder(order);

    if (order.sessionId) {
      await recomputeSessionTotals(order.sessionId);
      const session = await TableSession.findById(order.sessionId);
      if (session && ["OPEN", "BILL_REQUESTED"].includes(session.status)) {
        if (session.dueAmount <= 0) {
          await settlePaidSession(session._id, { closedBy: tenant.userId });
        }
      }
    } else if (order.tableId) {
      const { Table } = await import("@/models/Table");
      await Table.updateOne(
        {
          _id: order.tableId,
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
        },
        { $set: { status: "CLEANING", currentSessionId: null } }
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
        tableReset: true,
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
