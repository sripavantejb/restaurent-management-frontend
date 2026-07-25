import { z } from "zod";
import { Coupon } from "@/models/Coupon";
import { withAuth, json, error } from "@/lib/api";

const Body = z.object({
  code: z.string().min(1),
  subtotalPaise: z.number().int().nonnegative(),
});

export const POST = withAuth(async ({ req, tenant }) => {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid coupon check", 400, err.errors[0]?.message);
    }
    throw err;
  }

  const coupon = await Coupon.findOne({
    restaurantId: tenant.restaurantId,
    code: body.code.trim().toUpperCase(),
    isActive: true,
  });
  if (!coupon) return error("Coupon not found", 404);

  const now = new Date();
  if (now < coupon.validFrom || now > coupon.validTo) {
    return error("Coupon expired or not yet valid", 400);
  }
  if (coupon.redeemedCount >= coupon.maxRedemptions) {
    return error("Coupon redemption limit reached", 400);
  }
  if (body.subtotalPaise < coupon.minOrderPaise) {
    return error(
      `Minimum order ₹${(coupon.minOrderPaise / 100).toFixed(0)}`,
      400
    );
  }

  let discountPaise = 0;
  if (coupon.type === "PERCENT") {
    discountPaise = Math.round((body.subtotalPaise * coupon.value) / 100);
  } else {
    discountPaise = Math.round(coupon.value);
  }
  discountPaise = Math.min(discountPaise, body.subtotalPaise);

  return json({
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discountPaise,
    discountInr: discountPaise / 100,
  });
}, "pos.bill");
