import { Types } from "mongoose";
import { RagDocument } from "@/models/RagDocument";
import { RagChunk } from "@/models/RagChunk";
import type { AiTenantCtx, ToolResult } from "../types";
import { upsertDocumentChunks } from "./indexer";
import { reindexTenantKnowledge } from "./indexer";
import { searchKnowledge } from "./search";
import type { RagSourceType } from "@/models/RagDocument";

function tenantFilter(ctx: AiTenantCtx) {
  return {
    restaurantId: ctx.restaurantId,
    branchId: ctx.branchId,
  };
}

const SOURCE_TYPES: RagSourceType[] = [
  "MENU_ITEM",
  "RECIPE",
  "INVENTORY",
  "RESTAURANT",
  "UPLOAD",
];

export async function searchKnowledgeTool(
  ctx: AiTenantCtx,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const query = String(args.query || "").trim();
  if (!query) {
    return { ok: false, summary: "query required", error: "query required" };
  }

  let sourceTypes: RagSourceType[] | undefined;
  if (Array.isArray(args.sourceTypes) && args.sourceTypes.length) {
    sourceTypes = args.sourceTypes
      .map(String)
      .filter((s): s is RagSourceType =>
        SOURCE_TYPES.includes(s as RagSourceType)
      );
  }

  const topK =
    typeof args.topK === "number" ? args.topK : undefined;

  const hits = await searchKnowledge({ ctx, query, sourceTypes, topK });

  if (!hits.length) {
    return {
      ok: true,
      summary:
        "No knowledge matches. Try reindexing (reindexKnowledge) or uploading an SOP.",
      data: { hits: [] },
      followUps: [
        "Reindex knowledge from menu and inventory",
        "List knowledge documents",
      ],
    };
  }

  const summary = hits
    .slice(0, 5)
    .map(
      (h, i) =>
        `[${i + 1}] (${h.sourceType}, score ${h.score}) ${h.title}: ${h.text.slice(0, 180)}…`
    )
    .join("\n");

  return {
    ok: true,
    summary: `Found ${hits.length} knowledge snippet(s):\n${summary}`,
    data: { hits },
    blocks: [
      {
        type: "list",
        title: "Knowledge citations",
        data: hits.map((h) => ({
          title: h.title,
          sourceType: h.sourceType,
          score: h.score,
          excerpt: h.text.slice(0, 240),
        })),
      },
    ],
    followUps: [
      "Tell me more about the top result",
      "Search allergens on the menu",
    ],
  };
}

export async function reindexKnowledgeTool(
  ctx: AiTenantCtx,
  _args: Record<string, unknown>
): Promise<ToolResult> {
  const role = ctx.role;
  if (role !== "OWNER" && role !== "MANAGER") {
    return {
      ok: false,
      summary: "Only OWNER or MANAGER can reindex knowledge.",
      error: "forbidden",
    };
  }

  const result = await reindexTenantKnowledge(ctx);
  const totalIndexed =
    result.menu.indexed +
    result.recipes.indexed +
    result.inventory.indexed +
    result.restaurant.indexed;
  const totalSkipped =
    result.menu.skipped +
    result.recipes.skipped +
    result.inventory.skipped +
    result.restaurant.skipped;

  return {
    ok: true,
    summary: `Reindex complete: ${totalIndexed} updated, ${totalSkipped} unchanged. Embeddings ${
      result.embeddingsEnabled ? "on" : "off (keyword fallback)"
    }.`,
    data: result as unknown as Record<string, unknown>,
    blocks: [
      {
        type: "kpi",
        title: "Reindex",
        data: [
          { label: "Updated", value: String(totalIndexed) },
          { label: "Skipped", value: String(totalSkipped) },
          {
            label: "Menu docs",
            value: String(result.menu.total),
          },
          {
            label: "Inventory",
            value: String(result.inventory.total),
          },
        ],
      },
    ],
  };
}

export async function listKnowledgeDocsTool(
  ctx: AiTenantCtx,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const filter: Record<string, unknown> = { ...tenantFilter(ctx) };
  const onlyUploads = args.uploadsOnly === true;
  if (onlyUploads) filter.sourceType = "UPLOAD";

  const docs = await RagDocument.find(filter)
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  return {
    ok: true,
    summary:
      docs.length === 0
        ? "No knowledge documents yet. Reindex or upload an SOP."
        : `${docs.length} knowledge document(s).`,
    data: {
      docs: docs.map((d) => ({
        id: d._id.toString(),
        title: d.title,
        sourceType: d.sourceType,
        status: d.status,
        chunkCount: d.chunkCount,
        sourceId: d.sourceId?.toString() ?? null,
      })),
    },
    blocks: [
      {
        type: "table",
        title: "Knowledge docs",
        data: {
          columns: ["title", "sourceType", "status", "chunks"],
          rows: docs.map((d) => ({
            title: d.title,
            sourceType: d.sourceType,
            status: d.status,
            chunks: d.chunkCount,
          })),
        },
      },
    ],
  };
}

export async function createUploadDocument(
  ctx: AiTenantCtx,
  input: { title: string; content: string }
) {
  const title = input.title.trim().slice(0, 200) || "Untitled SOP";
  const content = input.content.trim();
  if (!content) throw new Error("content required");
  if (content.length > 100_000) throw new Error("content too long (max 100k)");

  const sourceId = new Types.ObjectId();
  const result = await upsertDocumentChunks({
    ctx,
    sourceType: "UPLOAD",
    sourceId,
    title,
    body: content,
    metadata: { kind: "sop" },
  });

  return RagDocument.findById(result.documentId).lean();
}

export async function deleteUploadDocument(
  ctx: AiTenantCtx,
  id: string
) {
  if (!Types.ObjectId.isValid(id)) throw new Error("Invalid id");
  const doc = await RagDocument.findOne({
    ...tenantFilter(ctx),
    _id: id,
    sourceType: "UPLOAD",
  });
  if (!doc) throw new Error("Upload not found");
  await RagChunk.deleteMany({ documentId: doc._id });
  await doc.deleteOne();
  return true;
}

export async function listDocuments(ctx: AiTenantCtx, uploadsOnly = false) {
  const filter: Record<string, unknown> = { ...tenantFilter(ctx) };
  if (uploadsOnly) filter.sourceType = "UPLOAD";
  return RagDocument.find(filter).sort({ updatedAt: -1 }).limit(100).lean();
}
