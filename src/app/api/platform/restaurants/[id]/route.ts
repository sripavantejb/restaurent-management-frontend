import { z } from "zod";
import { Types } from "mongoose";
import { withPlatformAuth, json, error, getParams } from "@/lib/api";
import {
  Restaurant,
  RESTAURANT_STATUSES,
} from "@/models/Restaurant";
import { Branch } from "@/models/Branch";
import { User } from "@/models/User";
import { PLANS, PLAN_CATALOG, limitsForPlan } from "@/lib/billing/plans";
import { Table } from "@/models/Table";
import {
  MODULE_IDS,
  countEnabledModules,
  defaultModulesForPlan,
  resolveLimits,
  resolveModules,
  type ModuleId,
} from "@/lib/platform/modules";

const modulePartial = z.record(z.boolean()).optional();

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
  modules: modulePartial,
  resetModules: z.boolean().optional(),
  enableAllModules: z.boolean().optional(),
  limitOverrides: z
    .object({
      maxBranches: z.number().int().min(-1).nullable().optional(),
      maxStaff: z.number().int().min(-1).nullable().optional(),
      maxTables: z.number().int().min(-1).nullable().optional(),
    })
    .optional(),
  trialEndsAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
  extendDays: z.number().int().min(1).max(90).optional(),
  qrOrderingEnabled: z.boolean().optional(),
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
  const planLimits = PLAN_CATALOG[plan as keyof typeof PLAN_CATALOG]?.limits
    ?? PLAN_CATALOG.STARTER.limits;
  const limitOverrides = restaurant.limitOverrides ?? {};
  const limits = resolveLimits(planLimits, limitOverrides);
  const modules = resolveModules(
    plan,
    restaurant.modules as Record<string, boolean>
  );

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
      qrOrderingEnabled: restaurant.qrOrderingEnabled !== false,
      modules,
      modulesStored: restaurant.modules || {},
      modulesEnabledCount: countEnabledModules(modules),
      modulesTotal: MODULE_IDS.length,
      limitOverrides: {
        maxBranches: limitOverrides.maxBranches ?? null,
        maxStaff: limitOverrides.maxStaff ?? null,
        maxTables: limitOverrides.maxTables ?? null,
      },
      planLimits,
      createdAt: (restaurant as { createdAt?: Date }).createdAt ?? null,
    },
    usage: {
      branches: branches.length,
      staff: staffCount,
      tables: tableCount,
      limits,
      planLimits,
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
    moduleCatalog: MODULE_IDS.map((mid) => ({
      id: mid,
      enabled: modules[mid],
    })),
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
  if (body.qrOrderingEnabled !== undefined)
    restaurant.qrOrderingEnabled = body.qrOrderingEnabled;

  if (body.extendDays != null) {
    const base =
      restaurant.trialEndsAt && restaurant.trialEndsAt.getTime() > Date.now()
        ? new Date(restaurant.trialEndsAt)
        : new Date();
    base.setDate(base.getDate() + body.extendDays);
    restaurant.trialEndsAt = base;
    if (restaurant.billingStatus === "CANCELLED") {
      restaurant.billingStatus = "TRIAL";
    }
  }

  if (body.trialEndsAt !== undefined) {
    if (body.trialEndsAt === null) {
      restaurant.trialEndsAt = null;
    } else {
      const d = new Date(body.trialEndsAt);
      if (!Number.isNaN(d.getTime())) restaurant.trialEndsAt = d;
    }
  }

  if (body.resetModules) {
    restaurant.modules = defaultModulesForPlan(restaurant.plan) as never;
  } else if (body.enableAllModules) {
    restaurant.modules = defaultModulesForPlan("ENTERPRISE") as never;
  } else if (body.modules) {
    const current = resolveModules(
      restaurant.plan,
      restaurant.modules as Record<string, boolean>
    );
    for (const [key, val] of Object.entries(body.modules)) {
      if (MODULE_IDS.includes(key as ModuleId) && typeof val === "boolean") {
        current[key as ModuleId] = val;
      }
    }
    restaurant.modules = current as never;
    restaurant.markModified("modules");
  }

  if (body.limitOverrides) {
    const lo = restaurant.limitOverrides || {
      maxBranches: null,
      maxStaff: null,
      maxTables: null,
    };
    if (body.limitOverrides.maxBranches !== undefined)
      lo.maxBranches = body.limitOverrides.maxBranches;
    if (body.limitOverrides.maxStaff !== undefined)
      lo.maxStaff = body.limitOverrides.maxStaff;
    if (body.limitOverrides.maxTables !== undefined)
      lo.maxTables = body.limitOverrides.maxTables;
    restaurant.limitOverrides = lo;
  }

  await restaurant.save();

  const modules = resolveModules(
    restaurant.plan,
    restaurant.modules as Record<string, boolean>
  );
  const planLimits = limitsForPlan(restaurant.plan);
  const limits = resolveLimits(planLimits, restaurant.limitOverrides);

  return json({
    restaurant: {
      id: restaurant._id.toString(),
      name: restaurant.name,
      slug: restaurant.slug,
      status: restaurant.status,
      plan: restaurant.plan,
      billingStatus: restaurant.billingStatus,
      trialEndsAt: restaurant.trialEndsAt,
      contactEmail: restaurant.contactEmail,
      contactPhone: restaurant.contactPhone,
      address: restaurant.address,
      qrOrderingEnabled: restaurant.qrOrderingEnabled,
      modules,
      limitOverrides: restaurant.limitOverrides,
      limits,
    },
  });
});
