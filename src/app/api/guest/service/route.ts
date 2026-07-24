import { z } from "zod";
import { cookies } from "next/headers";
import { TableSession } from "@/models/TableSession";
import { ServiceRequest } from "@/models/ServiceRequest";
import { withGuest, guestError, guestJson } from "@/lib/guest-api";

const GUEST_COOKIE = "ros_guest";

const Schema = z.object({
  type: z.enum(["WAITER", "WATER", "CUTLERY", "BILL"]),
});

export const POST = withGuest(async (req) => {
  const jar = await cookies();
  const raw = jar.get(GUEST_COOKIE)?.value;
  if (!raw) return guestError("No session", 401);
  const ctx = JSON.parse(raw) as { sessionId: string };

  try {
    const body = Schema.parse(await req.json());
    const session = await TableSession.findById(ctx.sessionId);
    if (!session || !["OPEN", "BILL_REQUESTED"].includes(session.status)) {
      return guestError("Session not active", 409);
    }

    const recent = await ServiceRequest.findOne({
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      sessionId: session._id,
      type: body.type,
      createdAt: { $gte: new Date(Date.now() - 3 * 60 * 1000) },
    });
    if (recent) {
      return guestJson({
        id: recent._id.toString(),
        status: recent.status,
        throttled: true,
        message: "Already requested — staff will be with you shortly.",
      });
    }

    const sr = await ServiceRequest.create({
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      sessionId: session._id,
      tableId: session.tableIds[0],
      type: body.type,
      status: "OPEN",
    });

    if (body.type === "BILL") {
      session.status = "BILL_REQUESTED";
      await session.save();
    }

    return guestJson({ id: sr._id.toString(), status: sr.status }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return guestError("Invalid request", 400);
    }
    throw err;
  }
});
