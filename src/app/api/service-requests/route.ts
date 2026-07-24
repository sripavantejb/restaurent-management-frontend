import { z } from "zod";
import { ServiceRequest, type IServiceRequest } from "@/models/ServiceRequest";
import { Table, type ITable } from "@/models/Table";
import { withAuth, json, error } from "@/lib/api";

export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const filter: Record<string, unknown> = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  };

  if (status === "active") {
    filter.status = { $in: ["OPEN", "ACKNOWLEDGED"] };
  } else if (status) {
    filter.status = status;
  } else {
    filter.status = { $in: ["OPEN", "ACKNOWLEDGED"] };
  }

  const rows = (await ServiceRequest.find(filter)
    .sort({ createdAt: 1 })
    .limit(100)
    .lean()) as unknown as IServiceRequest[];

  const tableIds = [...new Set(rows.map((r) => r.tableId.toString()))];
  const tables = (await Table.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    _id: { $in: tableIds },
  })
    .select("_id number")
    .lean()) as unknown as Pick<ITable, "_id" | "number">[];
  const tableMap = new Map(tables.map((t) => [t._id.toString(), t.number]));

  return json({
    requests: rows.map((r) => ({
      id: r._id.toString(),
      type: r.type,
      status: r.status,
      tableId: r.tableId.toString(),
      tableNumber: tableMap.get(r.tableId.toString()) ?? null,
      sessionId: r.sessionId.toString(),
      createdAt: r.createdAt,
      acknowledgedAt: r.acknowledgedAt ?? null,
    })),
  });
}, "tables.view");

const PatchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACKNOWLEDGED", "DONE"]),
});

export const PATCH = withAuth(async ({ req, tenant, user }) => {
  try {
    const body = PatchSchema.parse(await req.json());
    const sr = await ServiceRequest.findOne({
      _id: body.id,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    if (!sr) return error("Service request not found", 404);

    if (body.status === "ACKNOWLEDGED") {
      if (sr.status === "DONE") {
        return error("Request already completed", 409);
      }
      sr.status = "ACKNOWLEDGED";
      sr.acknowledgedAt = new Date();
      sr.acknowledgedBy = tenant.userId;
    } else {
      sr.status = "DONE";
      if (!sr.acknowledgedAt) {
        sr.acknowledgedAt = new Date();
        sr.acknowledgedBy = tenant.userId;
      }
    }

    await sr.save();

    return json({
      id: sr._id.toString(),
      status: sr.status,
      acknowledgedAt: sr.acknowledgedAt,
      acknowledgedBy: user.userId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid update", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "sessions.manage");
