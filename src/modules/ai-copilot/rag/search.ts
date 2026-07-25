import type { AiTenantCtx } from "../types";
import { RagChunk } from "@/models/RagChunk";
import type { RagSourceType } from "@/models/RagDocument";
import { embedQuery, embeddingsAvailable } from "./embeddings";
import {
  cosineSimilarity,
  keywordScore,
  topKByScore,
} from "./cosine";

const CHUNK_CAP = 2000;

export interface KnowledgeHit {
  score: number;
  text: string;
  title: string;
  sourceType: RagSourceType;
  sourceId: string | null;
  documentId: string;
}

export async function searchKnowledge(input: {
  ctx: AiTenantCtx;
  query: string;
  sourceTypes?: RagSourceType[];
  topK?: number;
}): Promise<KnowledgeHit[]> {
  const topK = Math.min(Math.max(input.topK ?? 6, 1), 20);
  const filter: Record<string, unknown> = {
    restaurantId: input.ctx.restaurantId,
    branchId: input.ctx.branchId,
  };
  if (input.sourceTypes?.length) {
    filter.sourceType = { $in: input.sourceTypes };
  }

  const chunks = await RagChunk.find(filter)
    .select("text embedding metadata sourceType documentId")
    .limit(CHUNK_CAP)
    .lean();

  if (!chunks.length) return [];

  const useEmbed =
    embeddingsAvailable() &&
    chunks.some((c) => Array.isArray(c.embedding) && c.embedding.length > 0);

  let scored: { item: (typeof chunks)[0]; score: number }[];

  if (useEmbed) {
    const qVec = await embedQuery(input.query);
    if (!qVec.length) {
      scored = chunks.map((c) => ({
        item: c,
        score: keywordScore(input.query, c.text),
      }));
    } else {
      scored = chunks.map((c) => ({
        item: c,
        score:
          Array.isArray(c.embedding) && c.embedding.length === qVec.length
            ? cosineSimilarity(qVec, c.embedding)
            : keywordScore(input.query, c.text),
      }));
    }
  } else {
    scored = chunks.map((c) => ({
      item: c,
      score: keywordScore(input.query, c.text),
    }));
  }

  return topKByScore(scored, topK)
    .filter((x) => x.score > 0.05)
    .map((x) => {
      const meta = (x.item.metadata || {}) as Record<string, unknown>;
      return {
        score: Math.round(x.score * 1000) / 1000,
        text: x.item.text,
        title: String(meta.title || "Untitled"),
        sourceType: x.item.sourceType as RagSourceType,
        sourceId:
          meta.sourceId != null ? String(meta.sourceId) : null,
        documentId: x.item.documentId.toString(),
      };
    });
}
