import { z } from "zod";
import { Types } from "mongoose";
import { Table } from "@/models/Table";
import { withAuth, json, error } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { emitBranchEvent } from "@/lib/realtime";
import { randomBytes } from "crypto";

const MergeSchema = z.object({
  tableIds: z.array(z.string().min(1)).min(2),
});

const SplitSchema = z.object({
  mergeGroupId: z.string().min(1),
});

/** Merge multiple FREE/AVAILABLE tables into one merge group. */
export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "merge";

    if (action === "split") {
      const body = SplitSchema.parse(await req.json());
      const res = await Table.updateMany(
        {
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          mergeGroupId: body.mergeGroupId,
          deletedAt: null,
        },
        { $set: { mergeGroupId: null } }
      );
      await writeAudit({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        actorId: tenant.userId,
        actorType: "USER",
        action: "table.split",
        entityType: "Table",
        meta: { mergeGroupId: body.mergeGroupId, modified: res.modifiedCount },
      });
      emitBranchEvent(
        tenant.restaurantId.toString(),
        tenant.branchId.toString(),
        "tables:updated",
        { action: "split" }
      );
      return json({ ok: true, modified: res.modifiedCount });
    }

    const body = MergeSchema.parse(await req.json());
    const ids = body.tableIds.map((id) => new Types.ObjectId(id));
    const tables = await Table.find({
      _id: { $in: ids },
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      deletedAt: null,
    });
    if (tables.length !== body.tableIds.length) {
      return error("One or more tables not found", 404);
    }
    const groupId = randomBytes(8).toString("hex");
    await Table.updateMany(
      { _id: { $in: ids } },
      { $set: { mergeGroupId: groupId } }
    );
    await writeAudit({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      actorId: tenant.userId,
      actorType: "USER",
      action: "table.merge",
      entityType: "Table",
      meta: { mergeGroupId: groupId, tableIds: body.tableIds },
    });
    emitBranchEvent(
      tenant.restaurantId.toString(),
      tenant.branchId.toString(),
      "tables:updated",
      { action: "merge", mergeGroupId: groupId }
    );
    return json({ mergeGroupId: groupId }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid merge/split", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "tables.update");
