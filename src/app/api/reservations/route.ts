import { z } from "zod";
import { Reservation } from "@/models/Reservation";
import { Table } from "@/models/Table";
import { withAuth, json, error } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const day = url.searchParams.get("day");
  const filter: Record<string, unknown> = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  };
  if (day) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter.scheduledAt = { $gte: start, $lt: end };
  }
  const list = await Reservation.find(filter)
    .sort({ scheduledAt: 1 })
    .limit(100)
    .lean();
  return json({
    reservations: list.map((r) => ({
      id: r._id.toString(),
      guestName: r.guestName,
      phone: r.phone,
      partySize: r.partySize,
      scheduledAt: r.scheduledAt,
      status: r.status,
      notes: r.notes,
      tableId: r.tableId?.toString() ?? null,
      source: r.source,
    })),
  });
}, "tables.view");

const CreateSchema = z.object({
  guestName: z.string().min(1),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  partySize: z.number().int().positive(),
  scheduledAt: z.string(),
  tableId: z.string().optional().nullable(),
  notes: z.string().optional().default(""),
  status: z
    .enum([
      "BOOKED",
      "CONFIRMED",
      "SEATED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
      "WAITLIST",
    ])
    .optional()
    .default("BOOKED"),
  source: z.string().optional().default("PHONE"),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateSchema.parse(await req.json());
    const r = await Reservation.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      guestName: body.guestName,
      phone: body.phone,
      email: body.email,
      partySize: body.partySize,
      scheduledAt: new Date(body.scheduledAt),
      tableId: body.tableId || null,
      notes: body.notes,
      status: body.status,
      source: body.source,
    });
    if (body.tableId && body.status !== "WAITLIST") {
      await Table.updateOne(
        {
          _id: body.tableId,
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
        },
        { $set: { status: "RESERVED" } }
      );
    }
    await writeAudit({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      actorId: tenant.userId,
      actorType: "USER",
      action: "reservation.create",
      entityType: "Reservation",
      entityId: r._id.toString(),
    });
    return json({ id: r._id.toString() }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid reservation", 400);
    throw err;
  }
}, "tables.update");

const PatchSchema = z.object({
  id: z.string().min(1),
  status: z.enum([
    "BOOKED",
    "CONFIRMED",
    "SEATED",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
    "WAITLIST",
  ]),
});

export const PATCH = withAuth(async ({ req, tenant }) => {
  try {
    const body = PatchSchema.parse(await req.json());
    const r = await Reservation.findOneAndUpdate(
      {
        _id: body.id,
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
      },
      { $set: { status: body.status } },
      { new: true }
    );
    if (!r) return error("Not found", 404);
    if (
      r.tableId &&
      (body.status === "CANCELLED" ||
        body.status === "COMPLETED" ||
        body.status === "NO_SHOW")
    ) {
      await Table.updateOne(
        { _id: r.tableId },
        { $set: { status: "AVAILABLE" } }
      );
    }
    if (r.tableId && body.status === "SEATED") {
      await Table.updateOne(
        { _id: r.tableId },
        { $set: { status: "OCCUPIED" } }
      );
    }
    return json({ id: r._id.toString(), status: r.status });
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid", 400);
    throw err;
  }
}, "tables.update");
