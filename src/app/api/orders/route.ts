import { z } from "zod";
import { Order, type IOrder, type IOrderItem } from "@/models/Order";
import { Table } from "@/models/Table";
import { Branch } from "@/models/Branch";
import { TableSession } from "@/models/TableSession";
import { withAuth, json, error } from "@/lib/api";
import { calcTax, calcTotal } from "@/lib/money";
import { nextSessionNumber, recomputeSessionTotals } from "@/lib/session";
import { allocateOrderNumber } from "@/lib/order-number";

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
  source: z.enum(["POS", "WAITER"]).optional(),
});

export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const approvalStatus = url.searchParams.get("approvalStatus");
  const placedBy = url.searchParams.get("placedBy");
  const paymentStatus = url.searchParams.get("paymentStatus");
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit") || 50))
  );
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  };

  if (status === "active") {
    filter.status = { $in: ["PLACED", "PREPARING", "READY", "SERVED"] };
  } else if (status === "pending_approval") {
    filter.status = "DRAFT";
    filter.approvalStatus = "PENDING";
  } else if (status) {
    filter.status = status;
  }

  if (approvalStatus) filter.approvalStatus = approvalStatus;
  if (placedBy) filter.placedBy = placedBy;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (type) filter.type = type;
  if (from || to) {
    filter.placedAt = {};
    if (from) (filter.placedAt as Record<string, Date>).$gte = new Date(from);
    if (to) (filter.placedAt as Record<string, Date>).$lte = new Date(to);
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ placedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean() as unknown as Promise<IOrder[]>,
    Order.countDocuments(filter),
  ]);

  return json({
    page,
    limit,
    total,
    hasMore: skip + orders.length < total,
    orders: orders.map((o) => ({
      id: o._id.toString(),
      orderNumber: o.orderNumber,
      type: o.type,
      tableId: o.tableId?.toString() ?? null,
      sessionId: o.sessionId?.toString() ?? null,
      roundNumber: o.roundNumber ?? null,
      placedBy: o.placedBy ?? "STAFF",
      approvalStatus: o.approvalStatus ?? "NONE",
      status: o.status,
      paymentStatus: o.paymentStatus ?? "UNPAID",
      paidAmountPaise: o.paidAmountPaise ?? 0,
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
        guestLabel: it.guestLabel ?? "",
      })),
      subtotal: o.subtotal,
      discountAmount: o.discountAmount,
      taxAmount: o.taxAmount,
      total: o.total,
      placedAt: o.placedAt,
      readyAt: o.readyAt,
      servedAt: o.servedAt,
      completedAt: o.completedAt,
      createdAt: (o as IOrder & { createdAt?: Date }).createdAt ?? null,
    })),
  });
}, "orders.view");

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateOrderSchema.parse(await req.json());

    if (body.type === "DINE_IN" && !body.tableId) {
      return error(
        "Dine-in orders need a table",
        400,
        "Pick a table before sending."
      );
    }

    const subtotal = body.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const discountAmount = Math.min(body.discountAmount, subtotal);
    const taxAmount = calcTax(subtotal, discountAmount);
    const total = calcTotal(subtotal, discountAmount, taxAmount);

    const branchDoc = await Branch.findById(tenant.branchId).select("code");
    const branchCode = branchDoc?.code || "B1";
    const orderNumber = await allocateOrderNumber(
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
        const sessionNumber = await nextSessionNumber(
          table.restaurantId,
          table.branchId,
          branchCode
        );
        session = await TableSession.create({
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          sessionNumber,
          tableIds: [table._id],
          status: "OPEN",
          source: body.source === "WAITER" ? "WAITER" : "POS",
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
      paymentStatus: "UNPAID",
      paidAmountPaise: 0,
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
        paymentStatus: order.paymentStatus,
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
