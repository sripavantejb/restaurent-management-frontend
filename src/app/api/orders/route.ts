import { z } from "zod";
import { Order, type IOrder, type IOrderItem } from "@/models/Order";
import { Table } from "@/models/Table";
import { Branch } from "@/models/Branch";
import { TableSession } from "@/models/TableSession";
import { withAuth, json, error } from "@/lib/api";
import { calcTax, calcTotal } from "@/lib/money";
import { nextSessionNumber, recomputeSessionTotals } from "@/lib/session";

const ItemSchema = z.object({
  menuItemId: z.string().min(1),
  name: z.string().min(1),
  qty: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  variant: z.string().optional().default(""),
  addons: z.array(z.string()).optional().default([]),
  notes: z.string().optional().default(""),
});

const CreateOrderSchema = z.object({
  type: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]),
  tableId: z.string().nullable().optional(),
  items: z.array(ItemSchema).min(1),
  discountAmount: z.number().int().nonnegative().optional().default(0),
});

async function nextOrderNumber(
  restaurantId: unknown,
  branchId: unknown,
  branchCode: string
): Promise<string> {
  const count = await Order.countDocuments({ restaurantId, branchId });
  const seq = String(count + 1).padStart(4, "0");
  return `${branchCode}-${seq}`;
}

export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const filter: Record<string, unknown> = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  };

  if (status === "active") {
    filter.status = { $in: ["PLACED", "PREPARING", "READY", "SERVED"] };
  } else if (status) {
    filter.status = status;
  }

  if (type) filter.type = type;
  if (from || to) {
    filter.placedAt = {};
    if (from) (filter.placedAt as Record<string, Date>).$gte = new Date(from);
    if (to) (filter.placedAt as Record<string, Date>).$lte = new Date(to);
  }

  const orders = (await Order.find(filter)
    .sort({ placedAt: -1 })
    .limit(200)
    .lean()) as unknown as IOrder[];

  return json({
    orders: orders.map((o) => ({
      id: o._id.toString(),
      orderNumber: o.orderNumber,
      type: o.type,
      tableId: o.tableId?.toString() ?? null,
      sessionId: o.sessionId?.toString() ?? null,
      roundNumber: o.roundNumber ?? null,
      placedBy: o.placedBy ?? "STAFF",
      status: o.status,
      items: o.items.map((it: IOrderItem) => ({
        id: it._id?.toString(),
        menuItemId: it.menuItemId.toString(),
        name: it.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        variant: it.variant,
        addons: it.addons,
        notes: it.notes,
        status: it.status,
      })),
      subtotal: o.subtotal,
      discountAmount: o.discountAmount,
      taxAmount: o.taxAmount,
      total: o.total,
      placedAt: o.placedAt,
      readyAt: o.readyAt,
      servedAt: o.servedAt,
      completedAt: o.completedAt,
    })),
  });
}, "orders.view");

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateOrderSchema.parse(await req.json());

    if (body.type === "DINE_IN" && !body.tableId) {
      return error("Dine-in orders need a table", 400, "Pick a table before sending.");
    }

    const subtotal = body.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const discountAmount = Math.min(body.discountAmount, subtotal);
    const taxAmount = calcTax(subtotal, discountAmount);
    const total = calcTotal(subtotal, discountAmount, taxAmount);

    // Derive branch code from existing orders or default B1
    const sample = (await Order.findOne({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    })
      .sort({ createdAt: -1 })
      .select("orderNumber")
      .lean()) as { orderNumber?: string } | null;
    const branchCode = sample?.orderNumber?.split("-")[0] ?? "B1";
    const orderNumber = await nextOrderNumber(
      tenant.restaurantId,
      tenant.branchId,
      branchCode
    );

    let sessionId: string | null = null;
    let roundNumber = 1;

    if (body.tableId) {
      const table = await Table.findOne({
        _id: body.tableId,
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
      });
      if (!table) {
        return error("Table not found", 404, "Pick a table on this branch.");
      }

      let session = null as InstanceType<typeof TableSession> | null;
      if (table.currentSessionId) {
        session = await TableSession.findOne({
          _id: table.currentSessionId,
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          status: { $in: ["OPEN", "BILL_REQUESTED"] },
        });
      }
      if (!session) {
        session = await TableSession.findOne({
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          tableIds: table._id,
          status: { $in: ["OPEN", "BILL_REQUESTED"] },
        });
      }
      if (!session) {
        const branchDoc = await Branch.findById(tenant.branchId);
        const sessionNumber = await nextSessionNumber(
          table.restaurantId,
          table.branchId,
          branchDoc?.code ?? branchCode
        );
        session = await TableSession.create({
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          sessionNumber,
          tableIds: [table._id],
          status: "OPEN",
          source: "POS",
          guestCount: 1,
          orderIds: [],
          rounds: 0,
          openedAt: new Date(),
          openedBy: tenant.userId,
          lastActivityAt: new Date(),
        });
      }

      roundNumber = (session.rounds || 0) + 1;
      sessionId = session._id.toString();

      table.status = "OCCUPIED";
      table.currentSessionId = session._id;
      await table.save();
    }

    const order = await Order.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      orderNumber,
      type: body.type,
      tableId: body.tableId ?? null,
      waiterId: tenant.userId,
      sessionId: sessionId || null,
      roundNumber: body.tableId ? roundNumber : 1,
      placedBy: "STAFF",
      status: "PLACED",
      items: body.items.map((i) => ({ ...i, status: "QUEUED" })),
      subtotal,
      discountAmount,
      taxAmount,
      total,
      placedAt: new Date(),
    });

    if (sessionId) {
      await recomputeSessionTotals(sessionId);
    }

    return json(
      {
        id: order._id.toString(),
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        sessionId,
        roundNumber: order.roundNumber,
      },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid order", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "orders.create");
