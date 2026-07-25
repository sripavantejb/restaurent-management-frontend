import { Types } from "mongoose";
import { Order } from "@/models/Order";
import { Table } from "@/models/Table";
import { TableSession } from "@/models/TableSession";
import { ServiceRequest } from "@/models/ServiceRequest";
import { recomputeSessionTotals } from "@/lib/session";
import { deductInventoryForOrder } from "@/lib/inventory";

/**
 * After a session is fully paid: mark BILLED, free tables for the next party,
 * clear open service requests. QR codes stay active so the same code starts fresh.
 */
export async function settlePaidSession(
  sessionId: Types.ObjectId | string,
  opts?: { closedBy?: Types.ObjectId | string | null }
) {
  const toComplete = await Order.find({
    sessionId,
    status: { $nin: ["CANCELLED", "COMPLETED"] },
  });

  await Order.updateMany(
    {
      sessionId,
      status: { $nin: ["CANCELLED", "COMPLETED"] },
    },
    {
      $set: {
        status: "COMPLETED",
        completedAt: new Date(),
        paymentStatus: "PAID",
      },
    }
  );

  for (const o of toComplete) {
    o.status = "COMPLETED";
    o.completedAt = new Date();
    o.paymentStatus = "PAID";
    o.paidAmountPaise = o.total;
    await deductInventoryForOrder(o);
  }

  const completed = await Order.find({
    sessionId,
    status: "COMPLETED",
  });
  for (const o of completed) {
    await deductInventoryForOrder(o);
  }

  await recomputeSessionTotals(sessionId);
  const session = await TableSession.findById(sessionId);
  if (!session) return null;

  session.status = "BILLED";
  session.closedAt = new Date();
  if (opts?.closedBy) {
    session.closedBy = new Types.ObjectId(String(opts.closedBy));
  }
  session.lastActivityAt = new Date();
  await session.save();

  await ServiceRequest.updateMany(
    {
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      sessionId: session._id,
      status: { $in: ["OPEN", "ACKNOWLEDGED"] },
    },
    { $set: { status: "DONE" } }
  );

  await Table.updateMany(
    {
      _id: { $in: session.tableIds },
      restaurantId: session.restaurantId,
      branchId: session.branchId,
    },
    { $set: { status: "CLEANING", currentSessionId: null } }
  );

  return session;
}
