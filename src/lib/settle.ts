import { Types } from "mongoose";
import { Order } from "@/models/Order";
import { Table } from "@/models/Table";
import { TableSession } from "@/models/TableSession";
import { ServiceRequest } from "@/models/ServiceRequest";
import { recomputeSessionTotals } from "@/lib/session";

/**
 * After a session is fully paid: mark BILLED, free tables for the next party,
 * clear open service requests. QR codes stay active so the same code starts fresh.
 */
export async function settlePaidSession(
  sessionId: Types.ObjectId | string,
  opts?: { closedBy?: Types.ObjectId | string | null }
) {
  await Order.updateMany(
    {
      sessionId,
      status: { $nin: ["CANCELLED", "COMPLETED"] },
    },
    { $set: { status: "COMPLETED", completedAt: new Date() } }
  );

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

  // Free tables — same QR remains active for the next guests
  await Table.updateMany(
    {
      _id: { $in: session.tableIds },
      restaurantId: session.restaurantId,
      branchId: session.branchId,
    },
    { $set: { status: "FREE", currentSessionId: null } }
  );

  return session;
}
