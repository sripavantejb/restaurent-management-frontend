import { z } from "zod";
import { Table, TABLE_STATUSES, normalizeTableStatus } from "@/models/Table";
import { Order } from "@/models/Order";
import { TableSession } from "@/models/TableSession";
import { ServiceRequest } from "@/models/ServiceRequest";
import { QRCode } from "@/models/QRCode";
import { withAuth, json, error, getParams } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { emitBranchEvent } from "@/lib/realtime";

const UpdateSchema = z.object({
  number: z.number().int().positive().optional(),
  name: z.string().optional(),
  capacity: z.number().int().min(1).max(40).optional(),
  shape: z.enum(["SQUARE", "ROUND", "RECT"]).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  rotation: z.number().optional(),
  color: z.string().optional(),
  isVip: z.boolean().optional(),
  isOutdoor: z.boolean().optional(),
  isDisabled: z.boolean().optional(),
  floorId: z.string().nullable().optional(),
  sectionId: z.string().nullable().optional(),
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
    .optional(),
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

    const setDoc: Record<string, unknown> = { ...body };
    if (body.status === "AVAILABLE" || body.status === "FREE") {
      setDoc.status = "AVAILABLE";
      setDoc.currentSessionId = null;
    }
    if (body.status === "CLEANING") {
      setDoc.currentSessionId = null;
    }
    if (body.status === "BILLED") {
      setDoc.status = "PREPARING_BILL";
    }

    const before = await Table.findOne({
      _id: id,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    }).lean();

    const table = await Table.findOneAndUpdate(
      {
        _id: id,
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
      },
      { $set: setDoc },
      { new: true }
    );

    if (!table) return error("Table not found", 404);

    if (body.status === "AVAILABLE" || body.status === "FREE") {
      const openSessions = await TableSession.find({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        tableIds: table._id,
        status: { $in: ["OPEN", "BILL_REQUESTED", "BILLED"] },
      });
      for (const session of openSessions) {
        session.status = "CLOSED";
        session.closedAt = new Date();
        await session.save();
        await ServiceRequest.updateMany(
          {
            restaurantId: tenant.restaurantId,
            branchId: tenant.branchId,
            sessionId: session._id,
            status: { $in: ["OPEN", "ACKNOWLEDGED"] },
          },
          { $set: { status: "DONE" } }
        );
      }
    }

    await writeAudit({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      actorId: tenant.userId,
      actorType: "USER",
      action: "table.update",
      entityType: "Table",
      entityId: id,
      before: before
        ? { status: before.status, number: before.number }
        : null,
      after: { status: table.status, number: table.number },
    });

    emitBranchEvent(
      tenant.restaurantId.toString(),
      tenant.branchId.toString(),
      "tables:updated",
      { id, status: table.status }
    );

    return json({
      id: table._id.toString(),
      number: table.number,
      capacity: table.capacity,
      shape: table.shape,
      x: table.x,
      y: table.y,
      width: table.width,
      height: table.height,
      rotation: table.rotation,
      status: normalizeTableStatus(table.status),
      isVip: table.isVip,
      isOutdoor: table.isOutdoor,
      currentSessionId: table.currentSessionId?.toString() ?? null,
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

  const free =
    table.status === "FREE" ||
    table.status === "AVAILABLE" ||
    table.status === "OUT_OF_SERVICE";
  if (!free) {
    return error(
      "Only available tables can be deleted",
      400,
      "Clear or complete the open order first, then set the table to Available."
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

  table.deletedAt = new Date();
  await table.save();

  await QRCode.updateMany(
    {
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      tableId: id,
      isActive: true,
    },
    { $set: { isActive: false } }
  );

  await writeAudit({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    actorId: tenant.userId,
    actorType: "USER",
    action: "table.soft_delete",
    entityType: "Table",
    entityId: id,
  });

  emitBranchEvent(
    tenant.restaurantId.toString(),
    tenant.branchId.toString(),
    "tables:updated",
    { id, deleted: true }
  );

  return json({ ok: true, softDeleted: true });
}, "tables.update");
