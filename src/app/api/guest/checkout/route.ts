import { z } from "zod";
import { cookies } from "next/headers";
import { TableSession } from "@/models/TableSession";
import { Order } from "@/models/Order";
import { Table } from "@/models/Table";
import { Payment } from "@/models/Payment";
import { ServiceRequest } from "@/models/ServiceRequest";
import { withGuest, guestError, guestJson } from "@/lib/guest-api";
import { recomputeSessionTotals } from "@/lib/session";

const GUEST_COOKIE = "ros_guest";

async function ctx() {
  const jar = await cookies();
  const raw = jar.get(GUEST_COOKIE)?.value;
  if (!raw) return null;
  return JSON.parse(raw) as { sessionId: string; deviceId: string };
}

export const GET = withGuest(async () => {
  const c = await ctx();
  if (!c) return guestError("No session", 401);
  const session = await TableSession.findById(c.sessionId);
  if (!session) return guestError("Session not found", 404);
  await recomputeSessionTotals(session._id);
  const fresh = await TableSession.findById(session._id).lean();
  const orders = await Order.find({
    restaurantId: session.restaurantId,
    branchId: session.branchId,
    sessionId: session._id,
    status: { $ne: "CANCELLED" },
  })
    .sort({ roundNumber: 1 })
    .lean();

  return guestJson({
    session: {
      id: fresh!._id.toString(),
      sessionNumber: fresh!.sessionNumber,
      status: fresh!.status,
      guestCount: fresh!.guestCount,
      rounds: fresh!.rounds,
      subtotal: fresh!.subtotal,
      discountAmount: fresh!.discountAmount,
      taxAmount: fresh!.taxAmount,
      serviceCharge: fresh!.serviceCharge,
      tipAmount: fresh!.tipAmount,
      total: fresh!.total,
      paidAmount: fresh!.paidAmount,
      dueAmount: fresh!.dueAmount,
    },
    rounds: orders.map((o) => ({
      id: o._id.toString(),
      orderNumber: o.orderNumber,
      roundNumber: o.roundNumber,
      status: o.status,
      placedBy: o.placedBy,
      items: o.items,
      subtotal: o.subtotal,
      taxAmount: o.taxAmount,
      total: o.total,
      placedAt: o.placedAt,
      readyAt: o.readyAt,
      prepEtaMins: Math.max(...o.items.map(() => 15), 10),
    })),
  });
});

const BillSchema = z.object({
  action: z.enum(["REQUEST_BILL", "PAY", "TIP"]),
  method: z.enum(["CASH", "CARD", "UPI"]).optional(),
  tipAmount: z.number().int().nonnegative().optional(),
  tipPercent: z.number().optional(),
  phone: z.string().optional(),
  payAtCounter: z.boolean().optional(),
});

export const POST = withGuest(async (req) => {
  const c = await ctx();
  if (!c) return guestError("No session", 401);
  const session = await TableSession.findById(c.sessionId);
  if (!session) return guestError("Session not found", 404);

  try {
    const body = BillSchema.parse(await req.json());

    if (body.action === "REQUEST_BILL" || body.payAtCounter) {
      session.status = "BILL_REQUESTED";
      session.lastActivityAt = new Date();
      await session.save();
      await ServiceRequest.create({
        restaurantId: session.restaurantId,
        branchId: session.branchId,
        sessionId: session._id,
        tableId: session.tableIds[0],
        type: "BILL",
        status: "OPEN",
      });
      await recomputeSessionTotals(session._id);
      return guestJson({ status: "BILL_REQUESTED" });
    }

    if (body.action === "TIP" && body.tipAmount != null) {
      session.tipAmount = body.tipAmount;
      await session.save();
      await recomputeSessionTotals(session._id);
      return guestJson({ tipAmount: session.tipAmount });
    }

    if (body.action === "PAY") {
      if (body.tipPercent != null) {
        await recomputeSessionTotals(session._id);
        const base =
          session.subtotal - session.discountAmount + session.taxAmount + session.serviceCharge;
        session.tipAmount = Math.round((base * body.tipPercent) / 100);
        await session.save();
      } else if (body.tipAmount != null) {
        session.tipAmount = body.tipAmount;
        await session.save();
      }
      await recomputeSessionTotals(session._id);
      const fresh = await TableSession.findById(session._id);
      if (!fresh) return guestError("Session missing", 500);
      if (fresh.dueAmount <= 0 && fresh.total <= 0) {
        return guestError("Nothing to pay", 400);
      }

      const amount = fresh.dueAmount;
      await Payment.create({
        restaurantId: session.restaurantId,
        branchId: session.branchId,
        sessionId: session._id,
        orderId: null,
        method: body.method || "UPI",
        amount,
        tenderedAmount: amount,
        changeAmount: 0,
        tipAmount: fresh.tipAmount,
        paidAt: new Date(),
      });

      // Mark member orders completed
      await Order.updateMany(
        {
          restaurantId: session.restaurantId,
          branchId: session.branchId,
          sessionId: session._id,
          status: { $nin: ["CANCELLED", "COMPLETED"] },
        },
        { $set: { status: "COMPLETED", completedAt: new Date() } }
      );

      await recomputeSessionTotals(session._id);
      const closed = await TableSession.findById(session._id);
      if (!closed) return guestError("Session missing", 500);
      if (closed.dueAmount > 0) {
        return guestError("Payment incomplete", 400);
      }

      closed.status = "CLOSED";
      closed.closedAt = new Date();
      await closed.save();

      await Table.updateMany(
        {
          _id: { $in: closed.tableIds },
          restaurantId: closed.restaurantId,
          branchId: closed.branchId,
        },
        { $set: { status: "FREE", currentSessionId: null } }
      );

      const jar = await cookies();
      jar.set(GUEST_COOKIE, "", { path: "/", maxAge: 0 });

      return guestJson({
        paid: true,
        amount,
        tipAmount: closed.tipAmount,
        sessionStatus: "CLOSED",
      });
    }

    return guestError("Unknown action", 400);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return guestError("Invalid checkout", 400, err.errors[0]?.message);
    }
    throw err;
  }
});
