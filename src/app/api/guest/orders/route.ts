import { z } from "zod";
import { cookies } from "next/headers";
import { TableSession } from "@/models/TableSession";
import { GuestCart } from "@/models/GuestCart";
import { MenuItem } from "@/models/MenuItem";
import { Order } from "@/models/Order";
import { Restaurant } from "@/models/Restaurant";
import { Branch } from "@/models/Branch";
import { QRScan } from "@/models/QRScan";
import { withGuest, guestError, guestJson } from "@/lib/guest-api";
import { lineUnitPrice, recomputeSessionTotals, validateOrderMoney } from "@/lib/session";

const GUEST_COOKIE = "ros_guest";

const PlaceSchema = z.object({
  idempotencyKey: z.string().min(8),
});

export const POST = withGuest(async (req) => {
  const jar = await cookies();
  const raw = jar.get(GUEST_COOKIE)?.value;
  if (!raw) return guestError("No guest session", 401);
  const ctx = JSON.parse(raw) as {
    sessionId: string;
    deviceId: string;
    guestLabel: string;
  };

  try {
    const body = PlaceSchema.parse(await req.json());
    const headerKey = req.headers.get("idempotency-key") || body.idempotencyKey;

    const session = await TableSession.findById(ctx.sessionId);
    if (!session) return guestError("Session not found", 404);
    if (session.status === "BILL_REQUESTED") {
      return guestError(
        "Your bill is being prepared",
        409,
        "Tap to ask staff to reopen the table."
      );
    }
    if (session.status !== "OPEN") {
      return guestError("Session is closed", 409);
    }

    const existing = await Order.findOne({
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      idempotencyKey: headerKey,
    });
    if (existing) {
      return guestJson({
        id: existing._id.toString(),
        orderNumber: existing.orderNumber,
        roundNumber: existing.roundNumber,
        total: existing.total,
        duplicate: true,
      });
    }

    // Rate: max 3 orders / 5 min
    const recent = await Order.countDocuments({
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      sessionId: session._id,
      placedAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
    });
    if (recent >= 3) {
      return guestError(
        "Too many orders in a short time",
        429,
        "Wait a few minutes or ask staff to place the order."
      );
    }

    const cart = await GuestCart.findOne({
      sessionId: session._id,
      restaurantId: session.restaurantId,
      branchId: session.branchId,
    });
    if (!cart || cart.lines.length === 0) {
      return guestError("Cart is empty", 400, "Add items before placing a round.");
    }

    const restaurant = await Restaurant.findById(session.restaurantId);
    const branch = await Branch.findById(session.branchId);
    if (!restaurant || !branch) return guestError("Restaurant not found", 500);

    if (restaurant.qrOrderingEnabled === false) {
      return guestError(
        "QR ordering is turned off",
        403,
        "This restaurant has paused guest menu ordering. Please ask your server."
      );
    }

    const menuItems = await MenuItem.find({
      _id: { $in: cart.lines.map((l: { menuItemId: unknown }) => l.menuItemId) },
      restaurantId: session.restaurantId,
      branchId: session.branchId,
    });
    const map = new Map(menuItems.map((m) => [m._id.toString(), m]));

    const orderLines: {
      menuItemId: (typeof menuItems)[0]["_id"];
      name: string;
      qty: number;
      unitPrice: number;
      variant: string;
      addons: string[];
      notes: string;
      status: "QUEUED";
      guestLabel?: string;
    }[] = [];
    for (const line of cart.lines) {
      const item = map.get(line.menuItemId.toString());
      if (!item || !item.isAvailable) {
        return guestError(
          `${line.name} is currently unavailable`,
          400,
          "Remove it from the cart and try again."
        );
      }
      const unitPrice = lineUnitPrice(item, line.variant, line.addons);
      orderLines.push({
        menuItemId: item._id,
        name: item.name,
        qty: line.qty,
        unitPrice,
        variant: line.variant,
        addons: line.addons,
        notes: line.notes,
        status: "QUEUED" as const,
        guestLabel: line.guestLabel,
      });
    }

    const money = validateOrderMoney(orderLines, 0);
    if (money.total > (restaurant.maxGuestOrderPaise || 500000)) {
      return guestError(
        "Order exceeds the maximum allowed value",
        400,
        "Split the order or ask staff for help."
      );
    }

    // Duplicate warning: identical items under 2 minutes
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
    const last = await Order.findOne({
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      sessionId: session._id,
      placedAt: { $gte: twoMinAgo },
    }).sort({ placedAt: -1 });
    let duplicateWarning = false;
    if (last) {
      const a = JSON.stringify(
        orderLines.map((l) => `${l.name}|${l.qty}|${l.variant}`).sort()
      );
      const b = JSON.stringify(
        last.items.map((l: { name: string; qty: number; variant?: string }) => `${l.name}|${l.qty}|${l.variant}`).sort()
      );
      duplicateWarning = a === b;
    }

    const roundNumber = session.rounds + 1;
    const count = await Order.countDocuments({
      restaurantId: session.restaurantId,
      branchId: session.branchId,
    });
    const orderNumber = `${branch.code}-${String(count + 1).padStart(4, "0")}`;
    const approvalMode = restaurant.qrApprovalMode === true;

    const order = await Order.create({
      restaurantId: session.restaurantId,
      branchId: session.branchId,
      orderNumber,
      type: "DINE_IN",
      tableId: session.tableIds[0],
      sessionId: session._id,
      roundNumber,
      placedBy: "GUEST",
      guestDeviceId: ctx.deviceId,
      idempotencyKey: headerKey,
      approvalStatus: approvalMode ? "PENDING" : "NONE",
      status: approvalMode ? "DRAFT" : "PLACED",
      items: orderLines,
      ...money,
      placedAt: new Date(),
    });

    // If not approval mode, goes straight to kitchen as PLACED
    if (!approvalMode) {
      order.status = "PLACED";
      await order.save();
    }

    cart.lines = [];
    await cart.save();

    session.lastActivityAt = new Date();
    await session.save();
    await recomputeSessionTotals(session._id);

    await QRScan.updateMany(
      {
        restaurantId: session.restaurantId,
        branchId: session.branchId,
        deviceHash: ctx.deviceId,
        convertedToOrder: false,
      },
      {
        $set: {
          convertedToOrder: true,
          orderId: order._id,
          sessionId: session._id,
          firstItemAt: new Date(),
        },
      }
    );

    return guestJson(
      {
        id: order._id.toString(),
        orderNumber: order.orderNumber,
        roundNumber,
        total: order.total,
        status: order.status,
        approvalStatus: order.approvalStatus,
        duplicateWarning,
        pendingApproval: approvalMode,
      },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return guestError("Invalid order", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, { limit: 30 });
