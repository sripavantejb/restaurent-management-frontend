import { z } from "zod";
import { Types } from "mongoose";
import { Order } from "@/models/Order";
import { Payment, PAY_METHODS } from "@/models/Payment";
import { TableSession } from "@/models/TableSession";
import { Customer } from "@/models/Customer";
import { withAuth, json, error } from "@/lib/api";
import { recomputeSessionTotals } from "@/lib/session";
import { settlePaidSession } from "@/lib/settle";
import { syncOrderPaymentState } from "@/lib/order-payment";

const PaymentSchema = z.object({
  orderId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  method: z.enum(PAY_METHODS),
  /** Partial amount in paise; omit / 0 = pay remaining due. */
  amount: z.number().int().positive().optional(),
  tenderedAmount: z.number().int().nonnegative().optional().default(0),
  customerId: z.string().min(1).optional(),
  couponCode: z.string().optional(),
}).refine((b) => !!b.orderId || !!b.sessionId, {
  message: "Provide orderId or sessionId",
});

async function applyLoyalty(
  restaurantId: Types.ObjectId,
  branchId: Types.ObjectId,
  customerId: string | undefined,
  spendPaise: number
) {
  if (!customerId || !Types.ObjectId.isValid(customerId) || spendPaise <= 0)
    return;
  const points = Math.floor(spendPaise / 100); // ₹1 = 1 point
  await Customer.updateOne(
    { _id: customerId, restaurantId, branchId },
    {
      $inc: {
        loyaltyPoints: points,
        totalSpendPaise: spendPaise,
        visitCount: 1,
      },
    }
  );
}

async function debitWallet(
  restaurantId: Types.ObjectId,
  branchId: Types.ObjectId,
  customerId: string | undefined,
  amount: number
) {
  if (!customerId) throw new Error("Customer required for wallet pay");
  const cust = await Customer.findOne({
    _id: customerId,
    restaurantId,
    branchId,
  });
  if (!cust) throw new Error("Customer not found");
  if (cust.walletPaise < amount) {
    throw new Error(
      `Wallet has ₹${(cust.walletPaise / 100).toFixed(2)}; need ₹${(amount / 100).toFixed(2)}`
    );
  }
  cust.walletPaise -= amount;
  await cust.save();
}

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = PaymentSchema.parse(await req.json());

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

      const payAmount = Math.min(
        body.amount && body.amount > 0 ? body.amount : fresh.dueAmount,
        fresh.dueAmount
      );
      if (payAmount <= 0) return error("Invalid amount", 400);

      let tendered = body.tenderedAmount;
      let change = 0;
      if (body.method === "CASH") {
        if (tendered < payAmount) {
          return error(
            "Tendered amount is less than payment",
            400,
            "Enter an amount equal to or greater than this installment."
          );
        }
        change = tendered - payAmount;
      } else {
        tendered = payAmount;
      }

      if (body.method === "WALLET") {
        try {
          await debitWallet(
            tenant.restaurantId,
            tenant.branchId,
            body.customerId,
            payAmount
          );
        } catch (e) {
          return error(e instanceof Error ? e.message : "Wallet failed", 400);
        }
      }

      const isPartial = payAmount < fresh.dueAmount;
      const payment = await Payment.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        sessionId: session._id,
        orderId: null,
        customerId: body.customerId || null,
        kind: "CHARGE",
        method: body.method,
        amount: payAmount,
        tenderedAmount: tendered,
        changeAmount: change,
        tipAmount: isPartial ? 0 : fresh.tipAmount,
        isPartial,
        paidAt: new Date(),
      });

      await recomputeSessionTotals(session._id);
      const after = await TableSession.findById(session._id);
      let closed = false;
      if (after && after.dueAmount <= 0) {
        await settlePaidSession(session._id, { closedBy: tenant.userId });
        closed = true;
        await applyLoyalty(
          tenant.restaurantId,
          tenant.branchId,
          body.customerId,
          after.paidAmount || payAmount
        );
      }

      return json(
        {
          id: payment._id.toString(),
          sessionId: session._id.toString(),
          method: payment.method,
          amount: payment.amount,
          changeAmount: payment.changeAmount,
          isPartial,
          remainingDue: closed ? 0 : after?.dueAmount ?? 0,
          sessionStatus: closed ? "BILLED" : after?.status,
          tableReset: closed,
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

    const alreadyPaid = await Payment.aggregate([
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
    const paidSoFar = Math.max(
      0,
      (alreadyPaid[0]?.sum ?? 0) - (refunds[0]?.sum ?? 0)
    );
    const due = Math.max(0, order.total - paidSoFar);
    if (due <= 0) {
      order.status = "COMPLETED";
      order.paymentStatus = "PAID";
      order.paidAmountPaise = order.total;
      order.completedAt = new Date();
      await order.save();
      return error("Order already fully paid", 400);
    }

    const payAmount = Math.min(
      body.amount && body.amount > 0 ? body.amount : due,
      due
    );

    let tendered = body.tenderedAmount;
    let change = 0;
    if (body.method === "CASH") {
      if (tendered < payAmount) {
        return error("Tendered amount is less than payment", 400);
      }
      change = tendered - payAmount;
    } else {
      tendered = payAmount;
    }

    if (body.method === "WALLET") {
      try {
        await debitWallet(
          tenant.restaurantId,
          tenant.branchId,
          body.customerId,
          payAmount
        );
      } catch (e) {
        return error(e instanceof Error ? e.message : "Wallet failed", 400);
      }
    }

    const isPartial = payAmount < due;
    const payment = await Payment.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      orderId: order._id,
      sessionId: order.sessionId ?? null,
      customerId: body.customerId || null,
      kind: "CHARGE",
      method: body.method,
      amount: payAmount,
      tenderedAmount: tendered,
      changeAmount: change,
      isPartial,
      paidAt: new Date(),
    });

    await syncOrderPaymentState(order._id);

    const remaining = due - payAmount;
    if (remaining <= 0) {
      order.status = "COMPLETED";
      order.paymentStatus = "PAID";
      order.paidAmountPaise = order.total;
      order.completedAt = new Date();
      if (!order.servedAt) order.servedAt = new Date();
      await order.save();

      const { deductInventoryForOrder } = await import("@/lib/inventory");
      await deductInventoryForOrder(order);

      await applyLoyalty(
        tenant.restaurantId,
        tenant.branchId,
        body.customerId,
        order.total
      );

      if (body.couponCode) {
        const { Coupon } = await import("@/models/Coupon");
        await Coupon.updateOne(
          {
            restaurantId: tenant.restaurantId,
            code: body.couponCode.toUpperCase(),
          },
          { $inc: { redeemedCount: 1 } }
        );
      }

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
    }

    const fresh = await Order.findById(order._id);

    return json(
      {
        id: payment._id.toString(),
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        method: payment.method,
        amount: payment.amount,
        changeAmount: payment.changeAmount,
        isPartial,
        remainingDue: Math.max(0, remaining),
        fullyPaid: remaining <= 0,
        paymentStatus: fresh?.paymentStatus ?? (remaining <= 0 ? "PAID" : "PARTIAL"),
        tableReset: remaining <= 0,
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
