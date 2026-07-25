# Restaurant AI Copilot

Enterprise AI operating layer for RestaurantOS.

## Architecture (enforced)

```
User → Chat UI → /api/ai/chat → Auth + Tenant + RBAC
  → LLM (NVIDIA NIM or OpenAI) with tool schemas only
  → Tool Router (permission check) → Business Services → MongoDB
  → Structured JSON → LLM → Streaming markdown + UI blocks
```

**The LLM never receives a MongoDB connection, query string, or raw credentials.**

## Mongo-backed RAG

Operational data and uploaded SOPs are chunked, embedded, and stored in `RagDocument` / `RagChunk`. Retrieval uses in-process cosine similarity (no Atlas Vector Search required).

```
Reindex / Upload → embed → RagChunk
Copilot → searchKnowledge tool → top-K chunks → LLM answer + citations
```

| Path | Role |
|------|------|
| `rag/` | embeddings, chunking, cosine, indexer, search, uploads |
| Models | `RagDocument`, `RagChunk` |
| APIs | `/api/ai/rag/reindex`, `/api/ai/rag/docs` |
| Tools | `searchKnowledge`, `reindexKnowledge`, `listKnowledgeDocs` |

First-time: **AI Copilot → Knowledge → Reindex from DB**. Without an LLM key, search falls back to keyword scoring.

## Modules

| Path | Role |
|------|------|
| `types.ts` | Shared contracts |
| `prompts.ts` | System prompt + output format |
| `registry/` | Tool definitions (name, perms, schema, handler) |
| `services/` | Domain queries & mutations (tenant-scoped) |
| `rag/` | Mongo RAG index + retrieval |
| `gateway/` | Executor, LLM client, audit, fallback intent |
| Models | `AiConversation`, `AiMessage`, `AiToolAudit`, `RagDocument`, `RagChunk` |
| APIs | `/api/ai/chat`, `/conversations`, `/dashboard`, `/rag/*` |

## Security

1. `withAuth(..., "ai.use")` on every AI route  
2. Each tool declares `permissions: Permission[]`  
3. Action tools also require `ai.actions`  
4. Every tool call writes `AiToolAudit`  
5. Tenant ids come only from JWT — never from LLM args  

## Env

```
# Preferred: NVIDIA NIM (https://build.nvidia.com/)
NVIDIA_API_KEY=
NVIDIA_CHAT_MODEL=deepseek-ai/deepseek-v4-pro
NVIDIA_EMBEDDING_MODEL=nvidia/nv-embedqa-e5-v5
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

# Or OpenAI (used if NVIDIA key unset)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Put secrets in `frontend/.env.local` (gitignored). NGC *Docker registry* keys for `nvcr.io` are not always valid for chat — prefer a key from [build.nvidia.com](https://build.nvidia.com/).

Without a key, the gateway uses deterministic intent routing so demos still work.

## Run

Open **AI Copilot** in the sidebar (`/ai`). Use the **Knowledge** panel to reindex and upload SOPs.
