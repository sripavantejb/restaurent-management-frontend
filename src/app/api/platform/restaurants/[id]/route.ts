import { z } from "zod";
import { Types } from "mongoose";
import { withPlatformAuth, json, error, getParams } from "@/lib/api";
import {
  Restaurant,
  RESTAURANT_STATUSES,
} from "@/models/Restaurant";
import { Branch } from "@/models/Branch";
import { User } from "@/models/User";
import { PLANS, PLAN_CATALOG } from "@/lib/billing/plans";
import { Table } from "@/models/Table";

const PatchSchema = z.object({
  status: z.enum(RESTAURANT_STATUSES).optional(),
  plan: z.enum(PLANS).optional(),
  billingStatus: z
    .enum(["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED"])
    .optional(),
  contactEmail: z
    .string()
    .max(120)
    .optional()
    .refine(
      (v) =>
        v === undefined || v === "" || z.string().email().safeParse(v).success,
      { message: "Invalid contact email" }
    ),
  contactPhone: z.string().max(32).optional(),
  address: z.string().max(240).optional(),
  name: z.string().min(2).max(120).optional(),
});

export const GET = withPlatformAuth(async ({ req }) => {
  const { id } = getParams(req);
  if (!id || !Types.ObjectId.isValid(id)) {
    return error("Invalid restaurant id", 400);
  }

  const restaurant = await Restaurant.findById(id).lean();
  if (!restaurant) return error("Restaurant not found", 404);

  const branches = await Branch.find({ restaurantId: restaurant._id }).lean();
  const owners = await User.find({
    restaurantId: restaurant._id,
    role: "OWNER",
  })
    .select("name email isActive branchId createdAt")
    .lean<
      {
        _id: { toString(): string };
        name: string;
        email: string;
        isActive: boolean;
      }[]
    >();

  const staffCount = await User.countDocuments({
    restaurantId: restaurant._id,
  });
  const tableCount = await Table.countDocuments({
    restaurantId: restaurant._id,
  });

  const plan = restaurant.plan ?? "STARTER";
  const limits = PLAN_CATALOG[plan as keyof typeof PLAN_CATALOG]?.limits;

  return json({
    restaurant: {
      id: restaurant._id.toString(),
      name: restaurant.name,
      slug: restaurant.slug,
      status: restaurant.status ?? "ACTIVE",
      plan,
      billingStatus: restaurant.billingStatus ?? "TRIAL",
      trialEndsAt: restaurant.trialEndsAt ?? null,
      currentPeriodEnd: restaurant.currentPeriodEnd ?? null,
      razorpayCustomerId: restaurant.razorpayCustomerId || "",
      razorpaySubscriptionId: restaurant.razorpaySubscriptionId || "",
      address: restaurant.address,
      gstNumber: restaurant.gstNumber,
      contactEmail: restaurant.contactEmail || "",
      contactPhone: restaurant.contactPhone || "",
      currency: restaurant.currency,
      timezone: restaurant.timezone,
      createdAt: (restaurant as { createdAt?: Date }).createdAt ?? null,
    },
    usage: {
      branches: branches.length,
      staff: staffCount,
      tables: tableCount,
      limits: limits ?? PLAN_CATALOG.STARTER.limits,
    },
    branches: branches.map((b) => ({
      id: b._id.toString(),
      name: b.name,
      code: b.code,
      address: b.address,
      isActive: b.isActive,
    })),
    owners: (owners ?? []).map((o) => ({
      id: o._id.toString(),
      name: o.name,
      email: o.email,
      isActive: o.isActive,
    })),
    staffCount,
  });
});

export const PATCH = withPlatformAuth(async ({ req }) => {
  const { id } = getParams(req);
  if (!id || !Types.ObjectId.isValid(id)) {
    return error("Invalid restaurant id", 400);
  }

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid update", 400, err.errors[0]?.message);
    }
    throw err;
  }

  const restaurant = await Restaurant.findById(id);
  if (!restaurant) return error("Restaurant not found", 404);

  if (body.status !== undefined) restaurant.status = body.status;
  if (body.plan !== undefined) restaurant.plan = body.plan;
  if (body.billingStatus !== undefined)
    restaurant.billingStatus = body.billingStatus;
  if (body.contactEmail !== undefined)
    restaurant.contactEmail = body.contactEmail;
  if (body.contactPhone !== undefined)
    restaurant.contactPhone = body.contactPhone;
  if (body.address !== undefined) restaurant.address = body.address;
  if (body.name !== undefined) restaurant.name = body.name.trim();

  await restaurant.save();

  return json({
    restaurant: {
      id: restaurant._id.toString(),
      name: restaurant.name,
      slug: restaurant.slug,
      status: restaurant.status,
      plan: restaurant.plan,
      billingStatus: restaurant.billingStatus,
      contactEmail: restaurant.contactEmail,
      contactPhone: restaurant.contactPhone,
      address: restaurant.address,
    },
  });
});
