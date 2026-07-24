import { z } from "zod";
import { Types } from "mongoose";
import { withPlatformAuth, json, error, getParams } from "@/lib/api";
import {
  Restaurant,
  RESTAURANT_STATUSES,
} from "@/models/Restaurant";
import { Branch } from "@/models/Branch";
import { User } from "@/models/User";

const PatchSchema = z.object({
  status: z.enum(RESTAURANT_STATUSES).optional(),
  contactEmail: z
    .string()
    .max(120)
    .optional()
    .refine((v) => v === undefined || v === "" || z.string().email().safeParse(v).success, {
      message: "Invalid contact email",
    }),
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

  return json({
    restaurant: {
      id: restaurant._id.toString(),
      name: restaurant.name,
      slug: restaurant.slug,
      status: restaurant.status ?? "ACTIVE",
      address: restaurant.address,
      gstNumber: restaurant.gstNumber,
      contactEmail: restaurant.contactEmail || "",
      contactPhone: restaurant.contactPhone || "",
      currency: restaurant.currency,
      timezone: restaurant.timezone,
      createdAt: (restaurant as { createdAt?: Date }).createdAt ?? null,
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

  const body = PatchSchema.parse(await req.json());
  const restaurant = await Restaurant.findById(id);
  if (!restaurant) return error("Restaurant not found", 404);

  if (body.status !== undefined) restaurant.status = body.status;
  if (body.contactEmail !== undefined) restaurant.contactEmail = body.contactEmail;
  if (body.contactPhone !== undefined) restaurant.contactPhone = body.contactPhone;
  if (body.address !== undefined) restaurant.address = body.address;
  if (body.name !== undefined) restaurant.name = body.name.trim();

  await restaurant.save();

  return json({
    restaurant: {
      id: restaurant._id.toString(),
      name: restaurant.name,
      slug: restaurant.slug,
      status: restaurant.status,
      contactEmail: restaurant.contactEmail,
      contactPhone: restaurant.contactPhone,
      address: restaurant.address,
    },
  });
});
