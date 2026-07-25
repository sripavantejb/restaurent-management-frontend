import { z } from "zod";
import { withAuth, json, error } from "@/lib/api";
import type { AiTenantCtx } from "@/modules/ai-copilot/types";
import {
  createUploadDocument,
  listDocuments,
} from "@/modules/ai-copilot/rag/uploads";

export const GET = withAuth(async ({ req, tenant, user }) => {
  const url = new URL(req.url);
  const uploadsOnly = url.searchParams.get("uploadsOnly") === "1";

  const ctx: AiTenantCtx = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    userId: tenant.userId,
    role: user.role,
    permissions: user.permissions,
  };

  const docs = await listDocuments(ctx, uploadsOnly);
  return json({
    docs: docs.map((d) => ({
      id: d._id.toString(),
      title: d.title,
      sourceType: d.sourceType,
      status: d.status,
      chunkCount: d.chunkCount,
      errorMessage: d.errorMessage || "",
      updatedAt: (d as { updatedAt?: Date }).updatedAt ?? null,
    })),
  });
}, "ai.use");

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(100_000),
});

export const POST = withAuth(async ({ req, tenant, user }) => {
  if (user.role !== "OWNER" && user.role !== "MANAGER") {
    return error("Only OWNER or MANAGER can upload knowledge", 403);
  }

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid payload", 400, err.errors[0]?.message);
    }
    throw err;
  }

  const ctx: AiTenantCtx = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    userId: tenant.userId,
    role: user.role,
    permissions: user.permissions,
  };

  try {
    const doc = await createUploadDocument(ctx, body);
    if (!doc) return error("Failed to create document", 500);
    return json(
      {
        doc: {
          id: doc._id.toString(),
          title: doc.title,
          sourceType: doc.sourceType,
          status: doc.status,
          chunkCount: doc.chunkCount,
        },
      },
      201
    );
  } catch (e) {
    return error(e instanceof Error ? e.message : "Upload failed", 400);
  }
}, "ai.use");
