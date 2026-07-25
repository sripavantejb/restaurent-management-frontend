import { z } from "zod";
import { Types } from "mongoose";
import { User } from "@/models/User";
import { withAuth, json, error } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/rbac";

const STAFF_ROLES = ["MANAGER", "CASHIER", "WAITER", "CHEF"] as const;

export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const filter: Record<string, unknown> = {
    restaurantId: tenant.restaurantId,
  };
  const branchOnly = url.searchParams.get("branch") !== "all";
  if (branchOnly) filter.branchId = tenant.branchId;
  if (role) filter.role = role;

  const users = (await User.find(filter)
    .select("-passwordHash")
    .sort({ role: 1, name: 1 })
    .lean()) as unknown as {
    _id: Types.ObjectId;
    name: string;
    email: string;
    role: string;
    branchId: Types.ObjectId;
    isActive: boolean;
  }[];

  return json({
    users: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      branchId: u.branchId.toString(),
      isActive: u.isActive,
    })),
  });
}, "users.manage");

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(STAFF_ROLES),
  branchId: z.string().optional(),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateSchema.parse(await req.json());
    const email = body.email.toLowerCase().trim();
    const exists = await User.findOne({ email }).select("_id");
    if (exists) {
      return error("Email already in use", 409, "Pick a different login email.");
    }

    const { assertWithinLimit } = await import("@/lib/billing/limits");
    const limit = await assertWithinLimit(tenant.restaurantId, "staff");
    if (!limit.ok) {
      return error(limit.message, 403, limit.hint);
    }

    const user = await User.create({
      restaurantId: tenant.restaurantId,
      branchId: body.branchId || tenant.branchId,
      name: body.name.trim(),
      email,
      passwordHash: await hashPassword(body.password),
      role: body.role as Role,
      isActive: true,
    });

    return json(
      {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        branchId: user.branchId.toString(),
        isActive: user.isActive,
      },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid staff payload", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "users.manage");

const PatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  role: z.enum([...STAFF_ROLES, "OWNER"] as [string, ...string[]]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).max(100).optional(),
  branchId: z.string().optional(),
});

export const PATCH = withAuth(async ({ req, tenant, user: actor }) => {
  try {
    const body = PatchSchema.parse(await req.json());
    const target = await User.findOne({
      _id: body.id,
      restaurantId: tenant.restaurantId,
    });
    if (!target) return error("User not found", 404);

    if (target.role === "OWNER" && actor.role !== "OWNER") {
      return error("Only an owner can edit another owner", 403);
    }
    if (body.role === "OWNER" && actor.role !== "OWNER") {
      return error("Cannot promote to owner", 403);
    }
    if (body.role && !ROLES.includes(body.role as Role)) {
      return error("Invalid role", 400);
    }

    if (body.name != null) target.name = body.name.trim();
    if (body.role != null) target.role = body.role as Role;
    if (body.isActive != null) target.isActive = body.isActive;
    if (body.branchId != null) {
      target.branchId = new Types.ObjectId(body.branchId);
    }
    if (body.password) {
      target.passwordHash = await hashPassword(body.password);
    }
    await target.save();

    return json({
      id: target._id.toString(),
      name: target.name,
      email: target.email,
      role: target.role,
      branchId: target.branchId.toString(),
      isActive: target.isActive,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid update", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "users.manage");
