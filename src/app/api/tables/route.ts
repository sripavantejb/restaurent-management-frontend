import { z } from "zod";
import { Table, type ITable } from "@/models/Table";
import { Order, type IOrder } from "@/models/Order";
import { withAuth, json, error } from "@/lib/api";

type ActiveOrder = Pick<IOrder, "_id" | "orderNumber" | "tableId" | "status" | "total">;

const CreateSchema = z.object({
  number: z.number().int().positive().optional(),
  capacity: z.number().int().min(1).max(40).default(4),
  shape: z.enum(["SQUARE", "ROUND", "RECT"]).default("SQUARE"),
  x: z.number().optional(),
  y: z.number().optional(),
  status: z.enum(["FREE", "OCCUPIED", "BILLED", "RESERVED"]).optional().default("FREE"),
});

const ReorderSchema = z.object({
  tables: z
    .array(
      z.object({
        id: z.string().min(1),
        x: z.number(),
        y: z.number(),
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

  return json({
    tables: tables.map((t) => {
      const order = orderByTable.get(t._id.toString());
      return {
        id: t._id.toString(),
        number: t.number,
        capacity: t.capacity,
        shape: t.shape,
        x: t.x,
        y: t.y,
        status: t.status,
        currentOrder: order
          ? {
              id: order._id.toString(),
              orderNumber: order.orderNumber,
              status: order.status,
              total: order.total,
            }
          : null,
      };
    }),
  });
}, "tables.view");

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateSchema.parse(await req.json());

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
      status: body.status ?? "FREE",
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
