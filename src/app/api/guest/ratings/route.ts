import { z } from "zod";
import { connectDb } from "@/lib/db";
import { GuestRating } from "@/models/GuestRating";
import { TableSession } from "@/models/TableSession";
import { json, error } from "@/lib/api";
import { NextRequest } from "next/server";

const Body = z.object({
  sessionId: z.string().optional(),
  tableId: z.string().optional(),
  restaurantId: z.string().min(1),
  branchId: z.string().min(1),
  deviceId: z.string().default(""),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().default(""),
});

/** Public guest rating after meal. */
export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const body = Body.parse(await req.json());

    if (body.sessionId) {
      const session = await TableSession.findById(body.sessionId).lean();
      if (
        !session ||
        session.restaurantId.toString() !== body.restaurantId ||
        session.branchId.toString() !== body.branchId
      ) {
        return error("Session not found", 404);
      }
    }

    const rating = await GuestRating.create({
      restaurantId: body.restaurantId,
      branchId: body.branchId,
      sessionId: body.sessionId || null,
      tableId: body.tableId || null,
      deviceId: body.deviceId,
      stars: body.stars,
      comment: body.comment,
    });

    return json({ id: rating._id.toString(), stars: rating.stars }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid rating", 400, err.errors[0]?.message);
    }
    console.error(err);
    return error("Failed to save rating", 500);
  }
}
