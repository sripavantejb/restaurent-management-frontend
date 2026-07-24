import { z } from "zod";
import { Restaurant } from "@/models/Restaurant";
import { withAuth, json, error } from "@/lib/api";

export const GET = withAuth(async ({ tenant }) => {
  const restaurant = await Restaurant.findById(tenant.restaurantId).lean();
  if (!restaurant) return error("Restaurant not found", 404);

  return json({
    id: restaurant._id.toString(),
    name: restaurant.name,
    slug: restaurant.slug,
    qrOrderingEnabled: restaurant.qrOrderingEnabled !== false,
    qrApprovalMode: !!restaurant.qrApprovalMode,
    maxGuestOrderPaise: restaurant.maxGuestOrderPaise ?? 500000,
    wifiSsid: restaurant.wifiSsid || "",
    wifiPassword: restaurant.wifiPassword || "",
    menuVersion: restaurant.menuVersion || "1",
  });
}, "qr.manage");

const PatchSchema = z.object({
  qrOrderingEnabled: z.boolean().optional(),
  qrApprovalMode: z.boolean().optional(),
  maxGuestOrderPaise: z.number().int().positive().optional(),
  wifiSsid: z.string().optional(),
  wifiPassword: z.string().optional(),
});

export const PATCH = withAuth(async ({ req, tenant }) => {
  try {
    const body = PatchSchema.parse(await req.json());
    const restaurant = await Restaurant.findByIdAndUpdate(
      tenant.restaurantId,
      { $set: body },
      { new: true }
    );
    if (!restaurant) return error("Restaurant not found", 404);

    return json({
      id: restaurant._id.toString(),
      name: restaurant.name,
      slug: restaurant.slug,
      qrOrderingEnabled: restaurant.qrOrderingEnabled !== false,
      qrApprovalMode: !!restaurant.qrApprovalMode,
      maxGuestOrderPaise: restaurant.maxGuestOrderPaise,
      wifiSsid: restaurant.wifiSsid,
      wifiPassword: restaurant.wifiPassword,
      menuVersion: restaurant.menuVersion,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid settings", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "qr.manage");
