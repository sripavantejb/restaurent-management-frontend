import { z } from "zod";
import { cookies } from "next/headers";
import { Types } from "mongoose";
import { GuestCart } from "@/models/GuestCart";
import { TableSession } from "@/models/TableSession";
import { MenuItem } from "@/models/MenuItem";
import { withGuest, guestError, guestJson } from "@/lib/guest-api";
import { lineUnitPrice } from "@/lib/session";

const GUEST_COOKIE = "ros_guest";

async function guestCtx() {
  const jar = await cookies();
  const raw = jar.get(GUEST_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      sessionId: string;
      deviceId: string;
      guestLabel: string;
    };
  } catch {
    return null;
  }
}

export const GET = withGuest(async () => {
  const ctx = await guestCtx();
  if (!ctx) return guestError("No guest session", 401, "Scan the table QR again.");
  const session = await TableSession.findById(ctx.sessionId);
  if (!session || session.status !== "OPEN") {
    return guestError(
      session?.status === "BILL_REQUESTED"
        ? "Your bill is being prepared"
        : "Session closed",
      409,
      "Ask staff if you need to order more."
    );
  }
  let cart = await GuestCart.findOne({
    sessionId: session._id,
    restaurantId: session.restaurantId,
    branchId: session.branchId,
  });
  if (!cart) {
    cart = await GuestCart.create({
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      sessionId: session._id,
      lines: [],
    });
  }

  // Flag unavailable items still in cart
  const ids = cart.lines.map((l) => l.menuItemId);
  const items = await MenuItem.find({
    _id: { $in: ids },
    restaurantId: session.restaurantId,
    branchId: session.branchId,
  }).lean();
  const avail = new Map(items.map((i) => [i._id.toString(), i]));
  let changed = false;
  for (const line of cart.lines) {
    const it = avail.get(line.menuItemId.toString());
    const unavailable = !it || !it.isAvailable;
    if (line.unavailable !== unavailable) {
      line.unavailable = unavailable;
      changed = true;
    }
    if (it) {
      const price = lineUnitPrice(it, line.variant, line.addons);
      if (price !== line.unitPrice) {
        line.unitPrice = price;
        changed = true;
      }
    }
  }
  if (changed) await cart.save();

  return guestJson({
    lines: cart.lines.map((l) => ({
      id: l._id?.toString(),
      menuItemId: l.menuItemId.toString(),
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      variant: l.variant,
      addons: l.addons,
      notes: l.notes,
      isVeg: l.isVeg,
      guestLabel: l.guestLabel,
      deviceId: l.deviceId,
      unavailable: l.unavailable,
    })),
    version: cart.updatedAt?.getTime?.() ?? Date.now(),
  });
});

const UpsertSchema = z.object({
  lines: z.array(
    z.object({
      menuItemId: z.string(),
      qty: z.number().int().positive(),
      variant: z.string().optional().default(""),
      addons: z.array(z.string()).optional().default([]),
      notes: z.string().max(140).optional().default(""),
      guestLabel: z.string().optional(),
    })
  ),
});

export const PUT = withGuest(async (req) => {
  const ctx = await guestCtx();
  if (!ctx) return guestError("No guest session", 401);
  const session = await TableSession.findById(ctx.sessionId);
  if (!session || session.status !== "OPEN") {
    return guestError("Ordering is closed for this table", 409);
  }

  try {
    const body = UpsertSchema.parse(await req.json());
    const menuItems = await MenuItem.find({
      _id: { $in: body.lines.map((l) => l.menuItemId) },
      restaurantId: session.restaurantId,
      branchId: session.branchId,
    });
    const map = new Map(menuItems.map((m) => [m._id.toString(), m]));

    const lines = body.lines.map((l) => {
      const item = map.get(l.menuItemId);
      if (!item || !item.isAvailable) {
        throw new Error(`Unavailable: ${l.menuItemId}`);
      }
      return {
        menuItemId: item._id,
        name: item.name,
        qty: l.qty,
        unitPrice: lineUnitPrice(item, l.variant, l.addons),
        variant: l.variant,
        addons: l.addons,
        notes: l.notes,
        isVeg: item.isVeg,
        guestLabel: l.guestLabel || ctx.guestLabel || "Guest",
        deviceId: ctx.deviceId,
        unavailable: false,
      };
    });

    const cart = await GuestCart.findOneAndUpdate(
      {
        sessionId: session._id,
        restaurantId: session.restaurantId,
        branchId: session.branchId,
      },
      { $set: { lines } },
      { new: true, upsert: true }
    );

    session.lastActivityAt = new Date();
    await session.save();

    return guestJson({
      lines: cart!.lines,
      version: Date.now(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return guestError("Invalid cart", 400, err.errors[0]?.message);
    }
    return guestError(
      err instanceof Error ? err.message : "Cart update failed",
      400,
      "Remove unavailable items and try again."
    );
  }
});
