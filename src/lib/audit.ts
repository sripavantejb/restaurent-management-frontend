import { Types } from "mongoose";
import { AuditLog } from "@/models/AuditLog";

export async function writeAudit(input: {
  restaurantId?: string | Types.ObjectId | null;
  branchId?: string | Types.ObjectId | null;
  actorId?: string | Types.ObjectId | null;
  actorType?: "USER" | "PLATFORM" | "GUEST" | "SYSTEM";
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
}) {
  try {
    await AuditLog.create({
      restaurantId: input.restaurantId
        ? new Types.ObjectId(String(input.restaurantId))
        : null,
      branchId: input.branchId
        ? new Types.ObjectId(String(input.branchId))
        : null,
      actorId: input.actorId
        ? new Types.ObjectId(String(input.actorId))
        : null,
      actorType: input.actorType ?? "SYSTEM",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      meta: input.meta ?? null,
      ip: input.ip ?? null,
    });
  } catch (err) {
    console.error("[audit]", err);
  }
}
