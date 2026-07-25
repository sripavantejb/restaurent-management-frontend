import { Order } from "@/models/Order";
import { Restaurant } from "@/models/Restaurant";
import { Table } from "@/models/Table";
import { User } from "@/models/User";
import { withAuth, json, error, getParams } from "@/lib/api";
import { buildInvoice, invoiceToPrintText } from "@/lib/invoice";
import { writeAudit } from "@/lib/audit";

export const GET = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing order id", 400);

  const order = await Order.findOne({
    _id: id,
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  });
  if (!order) return error("Order not found", 404);

  const [restaurant, table, waiterDoc] = await Promise.all([
    Restaurant.findById(tenant.restaurantId).lean(),
    order.tableId
      ? Table.findById(order.tableId).lean()
      : Promise.resolve(null),
    order.waiterId
      ? User.findById(order.waiterId).select("name").lean<{ name?: string }>()
      : Promise.resolve(null),
  ]);

  if (!restaurant) return error("Restaurant not found", 404);

  const inv = buildInvoice({
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address || undefined,
    gstNumber: restaurant.gstNumber || undefined,
    fssaiNumber: restaurant.fssaiNumber || undefined,
    logoUrl: restaurant.logoUrl || undefined,
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
    })),
    subtotal: order.subtotal,
    discount: order.discountAmount,
    gstRate: 0.05,
    paymentStatus: order.status === "COMPLETED" ? "PAID" : "PENDING",
    footerNote: "Thank you for dining with us",
    terms: "All prices in INR. Taxes as applicable.",
  });

  await writeAudit({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    actorId: tenant.userId,
    actorType: "USER",
    action: "invoice.view",
    entityType: "Order",
    entityId: order._id.toString(),
  });

  return json({
    invoice: {
      ...inv,
      invoiceDate: inv.invoiceDate.toISOString(),
      tax: inv.tax,
    },
    printText: invoiceToPrintText(inv),
  });
}, "pos.bill");
