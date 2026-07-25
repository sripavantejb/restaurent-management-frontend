import { z } from "zod";
import { withAuth, json, error, getParams } from "@/lib/api";
import { Order } from "@/models/Order";
import { Restaurant } from "@/models/Restaurant";
import { Table } from "@/models/Table";
import { User } from "@/models/User";
import { Customer } from "@/models/Customer";
import { MenuItem } from "@/models/MenuItem";
import { buildInvoice, invoiceToPrintText } from "@/lib/invoice";
import { writeAudit } from "@/lib/audit";

const Body = z.object({
  to: z.string().email().optional(),
  channel: z.enum(["EMAIL", "WHATSAPP", "SMS"]).default("EMAIL"),
});

/**
 * Queue invoice send (email/WhatsApp/SMS).
 * Returns mailto / wa.me links when no SMTP/WhatsApp provider is configured.
 */
export const POST = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing order id", 400);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid send payload", 400, err.errors[0]?.message);
    }
    throw err;
  }

  const order = await Order.findOne({
    _id: id,
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  });
  if (!order) return error("Order not found", 404);

  const menu = (await MenuItem.find({
    _id: { $in: order.items.map((i) => i.menuItemId) },
  })
    .select("hsnCode")
    .lean()) as unknown as {
    _id: { toString(): string };
    hsnCode?: string;
  }[];
  const hsnMap = new Map(
    menu.map((m) => [m._id.toString(), m.hsnCode || "996331"])
  );

  const [restaurant, table, waiterDoc] = await Promise.all([
    Restaurant.findById(tenant.restaurantId).lean(),
    order.tableId ? Table.findById(order.tableId).lean() : null,
    order.waiterId
      ? User.findById(order.waiterId).select("name").lean<{ name?: string }>()
      : null,
  ]);
  if (!restaurant) return error("Restaurant not found", 404);

  const inv = buildInvoice({
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address || undefined,
    gstNumber: restaurant.gstNumber || undefined,
    fssaiNumber: restaurant.fssaiNumber || undefined,
    invoiceNumber: `INV-${order.orderNumber}`,
    invoiceDate: order.completedAt ?? order.placedAt ?? new Date(),
    orderNumber: order.orderNumber,
    tableNumber: table?.number ?? null,
    waiterName: waiterDoc?.name ?? null,
    lines: order.items.map((i) => ({
      name: i.name + (i.variant ? ` (${i.variant})` : ""),
      qty: i.qty,
      unitPrice: i.unitPrice,
      amount: i.qty * i.unitPrice,
      hsnCode: hsnMap.get(i.menuItemId.toString()) || "996331",
    })),
    subtotal: order.subtotal,
    discount: order.discountAmount,
    gstRate: 0.05,
    paymentStatus: order.status === "COMPLETED" ? "PAID" : "PENDING",
    footerNote: "Thank you",
    terms: "",
  });

  const printText = invoiceToPrintText(inv);
  let to = body.to || "";
  if (!to) {
    const cust = (await Customer.findOne({
      restaurantId: tenant.restaurantId,
      email: { $exists: true, $ne: "" },
    })
      .sort({ updatedAt: -1 })
      .lean()) as unknown as { email?: string } | null;
    to = cust?.email || "";
  }

  await writeAudit({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    actorId: tenant.userId,
    actorType: "USER",
    action: "invoice.send",
    entityType: "Order",
    entityId: order._id.toString(),
    meta: { channel: body.channel, to },
  });

  const subject = encodeURIComponent(
    `Invoice ${inv.invoiceNumber} · ${restaurant.name}`
  );
  const bodyEnc = encodeURIComponent(printText);
  const mailto = to
    ? `mailto:${to}?subject=${subject}&body=${bodyEnc}`
    : `mailto:?subject=${subject}&body=${bodyEnc}`;
  const wa = `https://wa.me/?text=${bodyEnc}`;

  return json({
    queued: true,
    channel: body.channel,
    to: to || null,
    printText,
    links: {
      mailto,
      whatsapp: wa,
    },
    hint: "Open the mailto/whatsapp link to send. Add SMTP/WhatsApp API later for auto-send.",
  });
}, "pos.bill");
