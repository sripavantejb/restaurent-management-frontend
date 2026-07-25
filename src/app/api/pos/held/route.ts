import { z } from "zod";
import { HeldBill } from "@/models/HeldBill";
import { withAuth, json, error } from "@/lib/api";

export const GET = withAuth(async ({ tenant }) => {
  const bills = await HeldBill.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  })
    .sort({ updatedAt: -1 })
    .limit(30)
    .lean();
  return json({
    held: bills.map((b) => ({
      id: b._id.toString(),
      label: b.label,
      type: b.type,
      tableId: b.tableId?.toString() ?? null,
      tableNumber: b.tableNumber,
      lines: b.lines,
      discountPaise: b.discountPaise,
      updatedAt: (b as { updatedAt?: Date }).updatedAt,
    })),
  });
}, "pos.bill");

const HoldSchema = z.object({
  label: z.string().optional().default("Held bill"),
  type: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]),
  tableId: z.string().optional().nullable(),
  tableNumber: z.number().optional().nullable(),
  lines: z.array(z.record(z.unknown())).min(1),
  discountPaise: z.number().int().nonnegative().optional().default(0),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = HoldSchema.parse(await req.json());
    const bill = await HeldBill.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      label: body.label,
      type: body.type,
      tableId: body.tableId || null,
      tableNumber: body.tableNumber ?? null,
      lines: body.lines,
      discountPaise: body.discountPaise,
      heldBy: tenant.userId,
    });
    return json({ id: bill._id.toString() }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid hold", 400);
    throw err;
  }
}, "pos.bill");

export const DELETE = withAuth(async ({ req, tenant }) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return error("id required", 400);
  await HeldBill.deleteOne({
    _id: id,
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  });
  return json({ ok: true });
}, "pos.bill");
