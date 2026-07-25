import { z } from "zod";
import { Restaurant } from "@/models/Restaurant";
import { withAuth, json, error } from "@/lib/api";

function serialize(restaurant: {
  _id: { toString(): string };
  name: string;
  slug: string;
  logoUrl?: string;
  gstNumber?: string;
  fssaiNumber?: string;
  currency?: string;
  timezone?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  qrOrderingEnabled?: boolean;
  qrApprovalMode?: boolean;
  maxGuestOrderPaise?: number;
  wifiSsid?: string;
  wifiPassword?: string;
  menuVersion?: string;
  businessHours?: unknown;
  taxSettings?: unknown;
  receiptSettings?: unknown;
  branding?: unknown;
  locale?: unknown;
}) {
  return {
    id: restaurant._id.toString(),
    name: restaurant.name,
    slug: restaurant.slug,
    logoUrl: restaurant.logoUrl || "",
    gstNumber: restaurant.gstNumber || "",
    fssaiNumber: restaurant.fssaiNumber || "",
    currency: restaurant.currency || "INR",
    timezone: restaurant.timezone || "Asia/Kolkata",
    address: restaurant.address || "",
    contactEmail: restaurant.contactEmail || "",
    contactPhone: restaurant.contactPhone || "",
    qrOrderingEnabled: restaurant.qrOrderingEnabled !== false,
    qrApprovalMode: !!restaurant.qrApprovalMode,
    maxGuestOrderPaise: restaurant.maxGuestOrderPaise ?? 500000,
    wifiSsid: restaurant.wifiSsid || "",
    wifiPassword: restaurant.wifiPassword || "",
    menuVersion: restaurant.menuVersion || "1",
    businessHours: restaurant.businessHours ?? [],
    taxSettings: restaurant.taxSettings ?? {
      mode: "EXCLUSIVE",
      gstRate: 0.05,
      cessRate: 0,
      serviceChargePct: 0,
      roundOff: true,
      interStateDefault: false,
    },
    receiptSettings: restaurant.receiptSettings ?? {
      footer: "Thank you for dining with us",
      thankYou: "Visit again!",
      terms: "All prices in INR.",
      showLogo: true,
      showGst: true,
      showFssai: true,
    },
    branding: restaurant.branding ?? {
      primaryColor: "#12100e",
      accentColor: "#e4572e",
      fontFamily: "DM Sans",
    },
    locale: restaurant.locale ?? {
      language: "en-IN",
      dateFormat: "dd/MM/yyyy",
    },
  };
}

export const GET = withAuth(async ({ tenant }) => {
  const restaurant = await Restaurant.findById(tenant.restaurantId).lean();
  if (!restaurant) return error("Restaurant not found", 404);
  return json(serialize(restaurant));
}, "qr.manage");

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().optional(),
  gstNumber: z.string().optional(),
  fssaiNumber: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  address: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  qrOrderingEnabled: z.boolean().optional(),
  qrApprovalMode: z.boolean().optional(),
  maxGuestOrderPaise: z.number().int().positive().optional(),
  wifiSsid: z.string().optional(),
  wifiPassword: z.string().optional(),
  businessHours: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        open: z.string(),
        close: z.string(),
        closed: z.boolean(),
      })
    )
    .optional(),
  taxSettings: z
    .object({
      mode: z.enum(["INCLUSIVE", "EXCLUSIVE"]).optional(),
      gstRate: z.number().optional(),
      cessRate: z.number().optional(),
      serviceChargePct: z.number().optional(),
      roundOff: z.boolean().optional(),
      interStateDefault: z.boolean().optional(),
    })
    .optional(),
  receiptSettings: z
    .object({
      footer: z.string().optional(),
      thankYou: z.string().optional(),
      terms: z.string().optional(),
      showLogo: z.boolean().optional(),
      showGst: z.boolean().optional(),
      showFssai: z.boolean().optional(),
    })
    .optional(),
  branding: z
    .object({
      primaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      fontFamily: z.string().optional(),
    })
    .optional(),
  locale: z
    .object({
      language: z.string().optional(),
      dateFormat: z.string().optional(),
    })
    .optional(),
});

export const PATCH = withAuth(async ({ req, tenant }) => {
  try {
    const body = PatchSchema.parse(await req.json());
    const $set: Record<string, unknown> = {};
    const flatKeys = [
      "name",
      "logoUrl",
      "gstNumber",
      "fssaiNumber",
      "currency",
      "timezone",
      "address",
      "contactEmail",
      "contactPhone",
      "qrOrderingEnabled",
      "qrApprovalMode",
      "maxGuestOrderPaise",
      "wifiSsid",
      "wifiPassword",
      "businessHours",
    ] as const;
    for (const k of flatKeys) {
      if (body[k] !== undefined) $set[k] = body[k];
    }
    if (body.taxSettings) {
      for (const [k, v] of Object.entries(body.taxSettings)) {
        $set[`taxSettings.${k}`] = v;
      }
    }
    if (body.receiptSettings) {
      for (const [k, v] of Object.entries(body.receiptSettings)) {
        $set[`receiptSettings.${k}`] = v;
      }
    }
    if (body.branding) {
      for (const [k, v] of Object.entries(body.branding)) {
        $set[`branding.${k}`] = v;
      }
    }
    if (body.locale) {
      for (const [k, v] of Object.entries(body.locale)) {
        $set[`locale.${k}`] = v;
      }
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      tenant.restaurantId,
      { $set },
      { new: true }
    ).lean();
    if (!restaurant) return error("Restaurant not found", 404);
    return json(serialize(restaurant));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid settings", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "qr.manage");
