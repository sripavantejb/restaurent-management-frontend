import { z } from "zod";
import { Supplier } from "@/models/Supplier";
import { withAuth, json, error } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const CreateSchema = z.object({
  company: z.string().min(1),
  gstNumber: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  address: z.string().optional().default(""),
  rating: z.number().min(1).max(5).optional().default(5),
});

export const GET = withAuth(async ({ tenant }) => {
  const suppliers = await Supplier.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    isActive: true,
  })
    .sort({ company: 1 })
    .lean();

  return json({
    suppliers: suppliers.map((s) => ({
      id: s._id.toString(),
      company: s.company,
      gstNumber: s.gstNumber,
      phone: s.phone,
      email: s.email,
      address: s.address,
      rating: s.rating,
      outstandingPaise: s.outstandingPaise,
      lastPurchaseAt: s.lastPurchaseAt,
    })),
  });
}, "inventory.view");

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateSchema.parse(await req.json());
    const s = await Supplier.create({
      ...body,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    await writeAudit({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      actorId: tenant.userId,
      actorType: "USER",
      action: "supplier.create",
      entityType: "Supplier",
      entityId: s._id.toString(),
      after: { company: s.company },
    });
    return json({ id: s._id.toString(), company: s.company }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid supplier", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "inventory.purchase");
