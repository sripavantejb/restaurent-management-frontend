import { z } from "zod";
import { Campaign } from "@/models/Campaign";
import { Coupon } from "@/models/Coupon";
import { withAuth, json, error } from "@/lib/api";

export const GET = withAuth(async ({ tenant }) => {
  const [campaigns, coupons] = await Promise.all([
    Campaign.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Coupon.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);
  return json({
    campaigns: campaigns.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      channel: c.channel,
      status: c.status,
      message: c.message,
      audience: c.audience,
      scheduledAt: c.scheduledAt,
      sentAt: c.sentAt,
    })),
    coupons: coupons.map((c) => ({
      id: c._id.toString(),
      code: c.code,
      type: c.type,
      value: c.value,
      minOrderPaise: c.minOrderPaise,
      redeemedCount: c.redeemedCount,
      maxRedemptions: c.maxRedemptions,
      validTo: c.validTo,
    })),
  });
}, "reports.view");

const Body = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("campaign"),
    name: z.string().min(1),
    channel: z.enum(["WHATSAPP", "EMAIL", "SMS", "PUSH", "IN_APP"]),
    message: z.string().min(1),
    audience: z.string().optional().default("ALL"),
    sendNow: z.boolean().optional().default(false),
  }),
  z.object({
    kind: z.literal("coupon"),
    code: z.string().min(2),
    type: z.enum(["PERCENT", "FLAT"]),
    value: z.number().positive(),
    minOrderPaise: z.number().int().nonnegative().optional().default(0),
    maxRedemptions: z.number().int().positive().optional().default(100),
    validDays: z.number().int().positive().optional().default(30),
  }),
]);

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = Body.parse(await req.json());
    if (body.kind === "campaign") {
      const c = await Campaign.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        name: body.name,
        channel: body.channel,
        message: body.message,
        audience: body.audience,
        status: body.sendNow ? "SENT" : "DRAFT",
        sentAt: body.sendNow ? new Date() : null,
      });
      return json({ id: c._id.toString(), status: c.status }, 201);
    }
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + body.validDays);
    const coupon = await Coupon.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      code: body.code.toUpperCase(),
      type: body.type,
      value: body.value,
      minOrderPaise: body.minOrderPaise,
      maxRedemptions: body.maxRedemptions,
      validTo,
    });
    return json({ id: coupon._id.toString(), code: coupon.code }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid marketing payload", 400);
    throw err;
  }
}, "menu.edit");
