import { z } from "zod";
import { Table } from "@/models/Table";
import { Order } from "@/models/Order";
import { withAuth, json, error, getParams } from "@/lib/api";

const UpdateSchema = z.object({
  number: z.number().int().positive().optional(),
  capacity: z.number().int().min(1).max(40).optional(),
  shape: z.enum(["SQUARE", "ROUND", "RECT"]).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  status: z.enum(["FREE", "OCCUPIED", "BILLED", "RESERVED"]).optional(),
});

export const PATCH = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing table id", 400);

  try {
    const body = UpdateSchema.parse(await req.json());

    if (body.number != null) {
      const clash = await Table.findOne({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        number: body.number,
        _id: { $ne: id },
      }).select("_id");
      if (clash) {
        return error(
          `Table ${body.number} already exists`,
          400,
          "Pick a different number."
        );
      }
    }

    const table = await Table.findOneAndUpdate(
      {
        _id: id,
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
      },
      { $set: body },
      { new: true }
    );

    if (!table) return error("Table not found", 404);

    return json({
      id: table._id.toString(),
      number: table.number,
      capacity: table.capacity,
      shape: table.shape,
      x: table.x,
      y: table.y,
      status: table.status,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid update", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "tables.update");

export const DELETE = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing table id", 400);

  const table = await Table.findOne({
    _id: id,
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  });
  if (!table) return error("Table not found", 404);

  if (table.status !== "FREE") {
    return error(
      "Only FREE tables can be deleted",
      400,
      "Clear or complete the open order first, then set the table to FREE."
    );
  }

  const open = await Order.findOne({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    tableId: id,
    status: { $in: ["PLACED", "PREPARING", "READY", "SERVED"] },
  }).select("_id");

  if (open) {
    return error(
      "Table has an active order",
      400,
      "Complete or cancel that order before deleting the table."
    );
  }

  await Table.deleteOne({
    _id: id,
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  });

  return json({ ok: true });
}, "tables.update");
