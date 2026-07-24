import { z } from "zod";
import { TableSession } from "@/models/TableSession";
import { Table } from "@/models/Table";
import { ServiceRequest } from "@/models/ServiceRequest";
import { withAuth, json, error, getParams } from "@/lib/api";
import { recomputeSessionTotals } from "@/lib/session";

const PatchSchema = z.object({
  action: z.enum(["REOPEN", "CLOSE", "FREE_TABLE"]),
});

export const GET = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing session id", 400);

  const session = await TableSession.findOne({
    _id: id,
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  }).lean();
  if (!session) return error("Session not found", 404);

  await recomputeSessionTotals(session._id);
  const fresh = await TableSession.findById(session._id).lean();
  if (!fresh) return error("Session not found", 404);

  return json({
    id: fresh._id.toString(),
    sessionNumber: fresh.sessionNumber,
    status: fresh.status,
    tableIds: fresh.tableIds.map((t) => t.toString()),
    guestCount: fresh.guestCount,
    guestName: fresh.guestName,
    rounds: fresh.rounds,
    total: fresh.total,
    dueAmount: fresh.dueAmount,
    openedAt: fresh.openedAt,
    lastActivityAt: fresh.lastActivityAt,
  });
}, "sessions.manage");

export const PATCH = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing session id", 400);

  try {
    const body = PatchSchema.parse(await req.json());
    const session = await TableSession.findOne({
      _id: id,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    if (!session) return error("Session not found", 404);

    if (body.action === "REOPEN") {
      if (!["BILL_REQUESTED", "BILLED"].includes(session.status)) {
        return error(
          "Session cannot be reopened",
          409,
          "Only bill-requested or billed sessions can be reopened for more orders."
        );
      }
      session.status = "OPEN";
      session.lastActivityAt = new Date();
      await session.save();

      await ServiceRequest.updateMany(
        {
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          sessionId: session._id,
          type: "BILL",
          status: { $in: ["OPEN", "ACKNOWLEDGED"] },
        },
        { $set: { status: "DONE" } }
      );

      await Table.updateMany(
        {
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          _id: { $in: session.tableIds },
        },
        {
          $set: {
            status: "OCCUPIED",
            currentSessionId: session._id,
          },
        }
      );

      return json({
        id: session._id.toString(),
        status: session.status,
      });
    }

    if (body.action === "CLOSE" || body.action === "FREE_TABLE") {
      session.status = "CLOSED";
      session.closedAt = new Date();
      session.lastActivityAt = new Date();
      await session.save();

      await ServiceRequest.updateMany(
        {
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          sessionId: session._id,
          status: { $in: ["OPEN", "ACKNOWLEDGED"] },
        },
        { $set: { status: "DONE" } }
      );

      await Table.updateMany(
        {
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          _id: { $in: session.tableIds },
        },
        {
          $set: { status: "FREE", currentSessionId: null },
        }
      );

      await recomputeSessionTotals(session._id);

      return json({
        id: session._id.toString(),
        status: session.status,
      });
    }

    return error("Unknown action", 400);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid session action", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "sessions.manage");
