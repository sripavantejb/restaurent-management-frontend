import { z } from "zod";
import { cookies } from "next/headers";
import { Restaurant } from "@/models/Restaurant";
import { Branch } from "@/models/Branch";
import { Table } from "@/models/Table";
import { TableSession } from "@/models/TableSession";
import { GuestCart } from "@/models/GuestCart";
import { withGuest, guestError, guestJson } from "@/lib/guest-api";
import { verifyTableQrToken } from "@/lib/qr-crypto";
import { nextSessionNumber, recomputeSessionTotals } from "@/lib/session";
import { randomBase62 } from "@/lib/base62";

const GUEST_COOKIE = "ros_guest";

const OpenSchema = z.object({
  slug: z.string(),
  branchCode: z.string(),
  token: z.string(),
  tableId: z.string(),
  guestCount: z.number().int().min(1).max(20),
  guestName: z.string().optional().default(""),
  action: z.enum(["START", "JOIN"]),
  deviceId: z.string().min(4),
});

async function resolveTable(input: {
  slug: string;
  branchCode: string;
  token: string;
  tableId: string;
}) {
  const restaurant = await Restaurant.findOne({ slug: input.slug });
  if (!restaurant) return null;
  const branch = await Branch.findOne({
    restaurantId: restaurant._id,
    code: input.branchCode,
  });
  if (!branch) return null;
  const table = await Table.findOne({
    _id: input.tableId,
    restaurantId: restaurant._id,
    branchId: branch._id,
  });
  if (!table) return null;
  const check = verifyTableQrToken({
    restaurantId: restaurant._id.toString(),
    branchId: branch._id.toString(),
    tableId: table._id.toString(),
    token: input.token,
    secretVersion: restaurant.qrSecretVersion ?? 1,
    previousVersion: restaurant.qrPreviousVersion,
    previousRotatedAt: restaurant.qrRotatedAt,
  });
  if (!check.ok) return null;
  return { restaurant, branch, table };
}

export const POST = withGuest(async (req) => {
  try {
    const body = OpenSchema.parse(await req.json());
    const resolved = await resolveTable(body);
    if (!resolved) {
      return guestError(
        "This code is out of date",
        403,
        "Please ask your server for a new one."
      );
    }
    const { restaurant, branch, table } = resolved;

    if (restaurant.qrOrderingEnabled === false) {
      return guestError(
        "QR ordering is turned off",
        403,
        "This restaurant has paused guest menu ordering. Please ask your server to take your order."
      );
    }

    let session = await TableSession.findOne({
      restaurantId: restaurant._id,
      branchId: branch._id,
      tableIds: table._id,
      status: { $in: ["OPEN", "BILL_REQUESTED"] },
    });

    if (body.action === "JOIN") {
      if (!session) {
        return guestError(
          "No open table to join",
          404,
          "Start a new session or ask staff for help."
        );
      }
      // BILL_REQUESTED is joinable — guest can view bill & pay; ordering stays locked in cart/orders APIs
      session.guestCount = Math.max(session.guestCount || 1, body.guestCount);
      if (body.guestName?.trim()) session.guestName = body.guestName.trim();
      session.lastActivityAt = new Date();
      await session.save();
    } else {
      // START
      if (session && session.status === "OPEN") {
        return guestError(
          "Table already in use",
          409,
          "If this is your table, choose Join. Staff have been notified if this isn't your party."
        );
      }
      // Bill requested → attach guest to existing session (track/pay), don't create a parallel session
      if (session && session.status === "BILL_REQUESTED") {
        session.guestCount = Math.max(session.guestCount || 1, body.guestCount);
        if (body.guestName?.trim()) session.guestName = body.guestName.trim();
        session.lastActivityAt = new Date();
        await session.save();
      } else if (table.status === "OCCUPIED" && !session) {
        // occupied without session — staff POS table; alert path
        return guestError(
          "Table already in use",
          409,
          "Please ask your server — this table may have a waiter-taken order."
        );
      } else {
        const sessionNumber = await nextSessionNumber(
          restaurant._id,
          branch._id,
          branch.code
        );
        session = await TableSession.create({
          restaurantId: restaurant._id,
          branchId: branch._id,
          sessionNumber,
          tableIds: [table._id],
          status: "OPEN",
          source: "QR",
          guestCount: body.guestCount,
          guestName: body.guestName || "",
          orderIds: [],
          rounds: 0,
          openedAt: new Date(),
          lastActivityAt: new Date(),
        });
        table.status = "OCCUPIED";
        table.currentSessionId = session._id;
        await table.save();
        await GuestCart.create({
          restaurantId: restaurant._id,
          branchId: branch._id,
          sessionId: session._id,
          lines: [],
        });
      }
    }

    await recomputeSessionTotals(session!._id);

    const jar = await cookies();
    jar.set(
      GUEST_COOKIE,
      JSON.stringify({
        sessionId: session!._id.toString(),
        deviceId: body.deviceId,
        guestLabel: body.guestName || `Guest`,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8,
      }
    );

    return guestJson({
      sessionId: session!._id.toString(),
      sessionNumber: session!.sessionNumber,
      status: session!.status,
      guestCount: session!.guestCount,
      rounds: session!.rounds,
      total: session!.total,
      deviceId: body.deviceId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return guestError("Invalid session request", 400, err.errors[0]?.message);
    }
    throw err;
  }
});

export const GET = withGuest(async () => {
  const jar = await cookies();
  const raw = jar.get(GUEST_COOKIE)?.value;
  if (!raw) return guestJson({ session: null });
  try {
    const parsed = JSON.parse(raw) as {
      sessionId: string;
      deviceId: string;
      guestLabel: string;
    };
    const session = await TableSession.findById(parsed.sessionId);
    if (!session || !["OPEN", "BILL_REQUESTED"].includes(session.status)) {
      return guestJson({ session: null });
    }
    // Flag abandoned if no activity 4h
    if (
      session.status === "OPEN" &&
      Date.now() - new Date(session.lastActivityAt).getTime() > 4 * 60 * 60 * 1000
    ) {
      session.status = "ABANDONED";
      await session.save();
      return guestJson({ session: null, abandoned: true });
    }
    await recomputeSessionTotals(session._id);
    const fresh = await TableSession.findById(session._id).lean();
    return guestJson({
      session: fresh
        ? {
            id: fresh._id.toString(),
            sessionNumber: fresh.sessionNumber,
            status: fresh.status,
            guestCount: fresh.guestCount,
            rounds: fresh.rounds,
            total: fresh.total,
            dueAmount: fresh.dueAmount,
            subtotal: fresh.subtotal,
            taxAmount: fresh.taxAmount,
            tipAmount: fresh.tipAmount,
          }
        : null,
      deviceId: parsed.deviceId,
      guestLabel: parsed.guestLabel,
    });
  } catch {
    return guestJson({ session: null });
  }
});
