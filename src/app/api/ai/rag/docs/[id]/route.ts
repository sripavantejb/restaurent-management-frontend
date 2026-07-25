import { Types } from "mongoose";
import { withAuth, json, error, getParams } from "@/lib/api";
import type { AiTenantCtx } from "@/modules/ai-copilot/types";
import { deleteUploadDocument } from "@/modules/ai-copilot/rag/uploads";

export const DELETE = withAuth(async ({ req, tenant, user }) => {
  if (user.role !== "OWNER" && user.role !== "MANAGER") {
    return error("Only OWNER or MANAGER can delete uploads", 403);
  }

  const { id } = getParams(req);
  if (!id || !Types.ObjectId.isValid(id)) {
    return error("Invalid document id", 400);
  }

  const ctx: AiTenantCtx = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    userId: tenant.userId,
    role: user.role,
    permissions: user.permissions,
  };

  try {
    await deleteUploadDocument(ctx, id);
    return json({ ok: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Delete failed", 404);
  }
}, "ai.use");
