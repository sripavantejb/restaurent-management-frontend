import { z } from "zod";
import { Table, type ITable } from "@/models/Table";
import { Order, type IOrder } from "@/models/Order";
import { TableSession, type ITableSession } from "@/models/TableSession";
import { QRCode, type IQRCode } from "@/models/QRCode";
import { withAuth, json, error } from "@/lib/api";

type ActiveOrder = Pick<IOrder, "_id" | "orderNumber" | "tableId" | "status" | "total">;

function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

const CreateSchema = z.object({
  number: z.number().int().positive().optional(),
  capacity: z.number().int().min(1).max(40).default(4),
  shape: z.enum(["SQUARE", "ROUND", "RECT"]).default("SQUARE"),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional().default(72),
  height: z.number().optional().default(72),
  rotation: z.number().optional().default(0),
  color: z.string().optional().default(""),
  isVip: z.boolean().optional().default(false),
  isOutdoor: z.boolean().optional().default(false),
  floorId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  status: z
    .enum([
      "AVAILABLE",
      "OCCUPIED",
      "RESERVED",
      "PREPARING_BILL",
      "CLEANING",
      "BLOCKED",
      "OUT_OF_SERVICE",
      "FREE",
      "BILLED",
    ])
    .optional()
    .default("AVAILABLE"),
});

const ReorderSchema = z.object({
  tables: z
    .array(
      z.object({
        id: z.string().min(1),
        x: z.number(),
        y: z.number(),
        width: z.number().optional(),
        height: z.number().optional(),
        rotation: z.number().optional(),
        number: z.number().int().positive().optional(),
      })
    )
    .min(1),
});

export const GET = withAuth(async ({ tenant }) => {
  const tables = (await Table.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  })
    .sort({ number: 1 })
    .lean()) as unknown as ITable[];

  const activeOrders = (await Order.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    status: { $in: ["PLACED", "PREPARING", "READY", "SERVED"] },
    tableId: { $ne: null },
  })
    .select("_id orderNumber tableId status total")
    .lean()) as unknown as ActiveOrder[];

  const orderByTable = new Map(
    activeOrders
      .filter((o) => o.tableId)
      .map((o) => [o.tableId!.toString(), o])
  );

  const openSessions = (await TableSession.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    status: { $in: ["OPEN", "BILL_REQUESTED", "BILLED"] },
  })
    .select("_id sessionNumber status tableIds guestCount rounds total dueAmount")
    .lean()) as unknown as Pick<
    ITableSession,
    "_id" | "sessionNumber" | "status" | "tableIds" | "guestCount" | "rounds" | "total" | "dueAmount"
  >[];

  const sessionByTable = new Map<string, (typeof openSessions)[0]>();
  for (const s of openSessions) {
    for (const tid of s.tableIds) {
      sessionByTable.set(tid.toString(), s);
    }
  }

  const activeCodes = (await QRCode.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    type: "TABLE",
    isActive: true,
    tableId: { $ne: null },
  })
    .select("_id tableId shortCode label scanCount lastScannedAt")
    .lean()) as unknown as Pick<
    IQRCode,
    "_id" | "tableId" | "shortCode" | "label" | "scanCount" | "lastScannedAt"
  >[];

  const qrByTable = new Map(
    activeCodes
      .filter((c) => c.tableId)
      .map((c) => [c.tableId!.toString(), c])
  );

  return json({
    tables: tables.map((t) => {
      const order = orderByTable.get(t._id.toString());
      const session =
        (t.currentSessionId &&
          openSessions.find((s) => s._id.toString() === t.currentSessionId?.toString())) ||
        sessionByTable.get(t._id.toString()) ||
        null;
      const qr = qrByTable.get(t._id.toString()) || null;
      return {
        id: t._id.toString(),
        number: t.number,
        name: t.name || "",
        capacity: t.capacity,
        shape: t.shape,
        x: t.x,
        y: t.y,
        width: t.width ?? 72,
        height: t.height ?? 72,
        rotation: t.rotation ?? 0,
        color: t.color || "",
        isVip: !!t.isVip,
        isOutdoor: !!t.isOutdoor,
        isDisabled: !!t.isDisabled,
        floorId: t.floorId?.toString() ?? null,
        sectionId: t.sectionId?.toString() ?? null,
        mergeGroupId: t.mergeGroupId ?? null,
        status:
          t.status === "FREE"
            ? "AVAILABLE"
            : t.status === "BILLED"
              ? "PREPARING_BILL"
              : t.status,
        currentSessionId: t.currentSessionId?.toString() ?? null,
        currentSession: session
          ? {
              id: session._id.toString(),
              sessionNumber: session.sessionNumber,
              status: session.status,
              guestCount: session.guestCount,
              rounds: session.rounds,
              total: session.total,
              dueAmount: session.dueAmount,
            }
          : null,
        currentOrder: order
          ? {
              id: order._id.toString(),
              orderNumber: order.orderNumber,
              status: order.status,
              total: order.total,
            }
          : null,
        qrCode: qr
          ? {
              id: qr._id.toString(),
              shortCode: qr.shortCode,
              shortUrl: `${appUrl()}/q/${qr.shortCode}`,
              label: qr.label,
              scanCount: qr.scanCount,
              lastScannedAt: qr.lastScannedAt ?? null,
            }
          : null,
      };
    }),
  });
}, "tables.view");

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateSchema.parse(await req.json());

    const { assertWithinLimit } = await import("@/lib/billing/limits");
    const limit = await assertWithinLimit(tenant.restaurantId, "tables");
    if (!limit.ok) {
      return error(limit.message, 403, limit.hint);
    }

    const existing = (await Table.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    })
      .select("number x y")
      .lean()) as unknown as Pick<ITable, "number" | "x" | "y">[];

    const used = new Set(existing.map((t) => t.number));
    let number = body.number;
    if (!number) {
      number = 1;
      while (used.has(number)) number += 1;
    } else if (used.has(number)) {
      return error(
        `Table ${number} already exists`,
        400,
        "Pick a different number or leave it blank to auto-assign."
      );
    }

    const col = existing.length % 4;
    const row = Math.floor(existing.length / 4);
    const x = body.x ?? 40 + col * 140;
    const y = body.y ?? 40 + row * 120;

    const table = await Table.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      number,
      capacity: body.capacity,
      shape: body.shape,
      x,
      y,
      width: body.width ?? 72,
      height: body.height ?? 72,
      rotation: body.rotation ?? 0,
      color: body.color ?? "",
      isVip: body.isVip ?? false,
      isOutdoor: body.isOutdoor ?? false,
      floorId: body.floorId || null,
      sectionId: body.sectionId || null,
      status:
        body.status === "FREE" || !body.status ? "AVAILABLE" : body.status,
    });

    return json(
      {
        id: table._id.toString(),
        number: table.number,
        capacity: table.capacity,
        shape: table.shape,
        x: table.x,
        y: table.y,
        status: table.status,
      },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid table", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "tables.update");

/** Batch update positions / numbers (floor reorder). */
export const PUT = withAuth(async ({ req, tenant }) => {
  try {
    const body = ReorderSchema.parse(await req.json());
    const ids = body.tables.map((t) => t.id);

    const owned = await Table.find({
      _id: { $in: ids },
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    }).select("_id");

    if (owned.length !== ids.length) {
      return error(
        "One or more tables were not found on this branch",
        404,
        "Reload the floor plan and try again."
      );
    }

    // If renumbering, ensure unique numbers within the batch + rest of branch
    const withNumbers = body.tables.filter((t) => t.number != null);
    if (withNumbers.length) {
      const nums = withNumbers.map((t) => t.number!);
      if (new Set(nums).size !== nums.length) {
        return error("Duplicate table numbers in reorder payload", 400);
      }
      const others = (await Table.find({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        _id: { $nin: ids },
        number: { $in: nums },
      })
        .select("number")
        .lean()) as unknown as { number: number }[];
      if (others.length) {
        return error(
          `Table number ${others[0].number} is already used`,
          400,
          "Choose unique numbers across the branch."
        );
      }
    }

    await Promise.all(
      body.tables.map((t) =>
        Table.updateOne(
          {
            _id: t.id,
            restaurantId: tenant.restaurantId,
            branchId: tenant.branchId,
          },
          {
            $set: {
              x: t.x,
              y: t.y,
              ...(t.number != null ? { number: t.number } : {}),
            },
          }
        )
      )
    );

    return json({ ok: true, updated: body.tables.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid layout", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "tables.update");
