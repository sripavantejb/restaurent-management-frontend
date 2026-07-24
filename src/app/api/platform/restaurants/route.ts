import { z } from "zod";
import { withPlatformAuth, json, error } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { slugify } from "@/lib/platform-auth";
import { Restaurant, RESTAURANT_STATUSES } from "@/models/Restaurant";
import { Branch } from "@/models/Branch";
import { User } from "@/models/User";

const RegisterSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(64).optional(),
  address: z.string().max(240).optional().default(""),
  gstNumber: z.string().max(32).optional().default(""),
  contactEmail: z
    .string()
    .max(120)
    .optional()
    .default("")
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "Invalid contact email",
    }),
  contactPhone: z.string().max(32).optional().default(""),
  status: z.enum(RESTAURANT_STATUSES).optional().default("ACTIVE"),
  branchName: z.string().min(1).max(120).default("Main"),
  branchCode: z.string().min(1).max(16).default("B1"),
  ownerName: z.string().min(2).max(120),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8).max(128),
});

export const GET = withPlatformAuth(async ({ req }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  const filter: Record<string, unknown> = {};
  if (status && RESTAURANT_STATUSES.includes(status as never)) {
    filter.status = status;
  }

  let restaurants = await Restaurant.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  if (q) {
    restaurants = restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.contactEmail || "").toLowerCase().includes(q)
    );
  }

  const [total, active, pending, suspended] = await Promise.all([
    Restaurant.countDocuments(),
    Restaurant.countDocuments({ status: "ACTIVE" }),
    Restaurant.countDocuments({ status: "PENDING" }),
    Restaurant.countDocuments({ status: "SUSPENDED" }),
  ]);

  const ids = restaurants.map((r) => r._id);
  const branchCounts = await Branch.aggregate<{
    _id: (typeof ids)[number];
    count: number;
  }>([{ $match: { restaurantId: { $in: ids } } }, { $group: { _id: "$restaurantId", count: { $sum: 1 } } }]);
  const branchMap = new Map(
    branchCounts.map((b) => [b._id.toString(), b.count])
  );

  return json({
    counts: { total, active, pending, suspended },
    restaurants: restaurants.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      slug: r.slug,
      status: r.status ?? "ACTIVE",
      address: r.address,
      contactEmail: r.contactEmail || "",
      contactPhone: r.contactPhone || "",
      gstNumber: r.gstNumber,
      currency: r.currency,
      branchCount: branchMap.get(r._id.toString()) ?? 0,
      createdAt: (r as { createdAt?: Date }).createdAt ?? null,
    })),
  });
});

export const POST = withPlatformAuth(async ({ req }) => {
  let body: z.infer<typeof RegisterSchema>;
  try {
    body = RegisterSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid registration payload", 400, err.errors[0]?.message);
    }
    throw err;
  }

  const slug = slugify(body.slug || body.name);
  if (!slug) {
    return error("Invalid slug", 400, "Provide a name that yields a valid slug.");
  }

  const existingSlug = await Restaurant.findOne({ slug });
  if (existingSlug) {
    return error("Slug already taken", 409, `Choose a different slug than "${slug}".`);
  }

  const ownerEmail = body.ownerEmail.toLowerCase();
  const existingUser = await User.findOne({ email: ownerEmail });
  if (existingUser) {
    return error(
      "Owner email already in use",
      409,
      "Each restaurant owner needs a unique email."
    );
  }

  const restaurant = await Restaurant.create({
    name: body.name.trim(),
    slug,
    status: body.status,
    address: body.address,
    gstNumber: body.gstNumber,
    contactEmail: body.contactEmail || ownerEmail,
    contactPhone: body.contactPhone,
    currency: "INR",
    timezone: "Asia/Kolkata",
  });

  const branch = await Branch.create({
    restaurantId: restaurant._id,
    name: body.branchName.trim(),
    code: body.branchCode.trim().toUpperCase(),
    address: body.address,
    isActive: true,
  });

  const passwordHash = await hashPassword(body.ownerPassword);
  const owner = await User.create({
    restaurantId: restaurant._id,
    branchId: branch._id,
    name: body.ownerName.trim(),
    email: ownerEmail,
    passwordHash,
    role: "OWNER",
    isActive: true,
  });

  return json(
    {
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        slug: restaurant.slug,
        status: restaurant.status,
      },
      branch: {
        id: branch._id.toString(),
        name: branch.name,
        code: branch.code,
      },
      owner: {
        id: owner._id.toString(),
        name: owner.name,
        email: owner.email,
      },
    },
    201
  );
});
