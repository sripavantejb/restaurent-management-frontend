import { withAuth, json, error } from "@/lib/api";
import type { AiTenantCtx } from "@/modules/ai-copilot/types";
import { reindexTenantKnowledge } from "@/modules/ai-copilot/rag/indexer";

export const POST = withAuth(async ({ tenant, user }) => {
  if (user.role !== "OWNER" && user.role !== "MANAGER") {
    return error("Only OWNER or MANAGER can reindex knowledge", 403);
  }

  const ctx: AiTenantCtx = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    userId: tenant.userId,
    role: user.role,
    permissions: user.permissions,
  };

  try {
    const result = await reindexTenantKnowledge(ctx);
    return json({ ok: true, result });
  } catch (e) {
    return error(
      e instanceof Error ? e.message : "Reindex failed",
      500
    );
  }
}, "ai.use");
