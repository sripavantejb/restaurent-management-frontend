import { z } from "zod";
import { Customer, type ICustomer } from "@/models/Customer";
import { withAuth, json, error } from "@/lib/api";

export const GET = withAuth(async ({ req, tenant }) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const filter: Record<string, unknown> = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  };
  if (q) {
    filter.$or = [
      { phone: { $regex: q, $options: "i" } },
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
    ];
  }
  const customers = (await Customer.find(filter)
    .sort({ totalSpendPaise: -1 })
    .limit(100)
    .lean()) as unknown as ICustomer[];
  return json({
    customers: customers.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      phone: c.phone,
      email: c.email,
      visitCount: c.visitCount,
      loyaltyPoints: c.loyaltyPoints ?? 0,
      walletPaise: c.walletPaise ?? 0,
      membership: c.membership ?? "STANDARD",
      totalSpendPaise: c.totalSpendPaise ?? 0,
      birthday: c.birthday,
    })),
  });
}, "reports.view");

const CreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8),
  email: z.string().optional().default(""),
  birthday: z.string().optional().nullable(),
  membership: z.string().optional().default("STANDARD"),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateSchema.parse(await req.json());
    const c = await Customer.findOneAndUpdate(
      {
        restaurantId: tenant.restaurantId,
        phone: body.phone,
      },
      {
        $set: {
          name: body.name,
          email: body.email,
          birthday: body.birthday ?? null,
          membership: body.membership,
          branchId: tenant.branchId,
        },
        $setOnInsert: {
          restaurantId: tenant.restaurantId,
          visitCount: 0,
          loyaltyPoints: 0,
          walletPaise: 0,
          totalSpendPaise: 0,
        },
      },
      { upsert: true, new: true }
    );
    return json({ id: c._id.toString(), phone: c.phone }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid customer", 400);
    throw err;
  }
}, "orders.create");

const PatchSchema = z.object({
  id: z.string().min(1),
  loyaltyPointsDelta: z.number().optional(),
  walletPaiseDelta: z.number().optional(),
  membership: z.string().optional(),
});

export const PATCH = withAuth(async ({ req, tenant }) => {
  try {
    const body = PatchSchema.parse(await req.json());
    const $inc: Record<string, number> = {};
    const $set: Record<string, unknown> = {};
    if (body.loyaltyPointsDelta)
      $inc.loyaltyPoints = body.loyaltyPointsDelta;
    if (body.walletPaiseDelta) $inc.walletPaise = body.walletPaiseDelta;
    if (body.membership) $set.membership = body.membership;
    const c = await Customer.findOneAndUpdate(
      {
        _id: body.id,
        restaurantId: tenant.restaurantId,
      },
      { ...(Object.keys($inc).length ? { $inc } : {}), ...(Object.keys($set).length ? { $set } : {}) },
      { new: true }
    );
    if (!c) return error("Not found", 404);
    return json({
      id: c._id.toString(),
      loyaltyPoints: c.loyaltyPoints,
      walletPaise: c.walletPaise,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid", 400);
    throw err;
  }
}, "orders.create");
