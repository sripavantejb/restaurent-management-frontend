import { z } from "zod";
import { Coupon } from "@/models/Coupon";
import { withAuth, json, error } from "@/lib/api";

export const GET = withAuth(async ({ tenant }) => {
  const coupons = await Coupon.find({
    restaurantId: tenant.restaurantId,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return json({
    coupons: coupons.map((c) => ({
      id: c._id.toString(),
      code: c.code,
      type: c.type,
      value: c.value,
      minOrderPaise: c.minOrderPaise,
      maxRedemptions: c.maxRedemptions,
      redeemedCount: c.redeemedCount,
      validFrom: c.validFrom,
      validTo: c.validTo,
      isActive: c.isActive,
    })),
  });
}, "reports.view");

const CreateSchema = z.object({
  code: z.string().min(2).max(24),
  type: z.enum(["PERCENT", "FLAT"]).default("PERCENT"),
  value: z.number().positive(),
  minOrderPaise: z.number().int().nonnegative().optional().default(0),
  maxRedemptions: z.number().int().positive().optional().default(1000),
  validDays: z.number().int().positive().optional().default(30),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateSchema.parse(await req.json());
    const validFrom = new Date();
    const validTo = new Date(
      validFrom.getTime() + body.validDays * 24 * 60 * 60 * 1000
    );
    const coupon = await Coupon.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      code: body.code.trim().toUpperCase(),
      type: body.type,
      value: body.type === "PERCENT" ? Math.min(100, body.value) : body.value,
      minOrderPaise: body.minOrderPaise,
      maxRedemptions: body.maxRedemptions,
      redeemedCount: 0,
      validFrom,
      validTo,
      isActive: true,
    });
    return json({ id: coupon._id.toString(), code: coupon.code }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid coupon", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "orders.create");
