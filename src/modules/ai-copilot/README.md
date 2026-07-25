# Restaurant AI Copilot

Enterprise AI operating layer for RestaurantOS.

## Architecture (enforced)

```
User → Chat UI → /api/ai/chat → Auth + Tenant + RBAC
  → OpenAI (Responses / Chat Completions) with tool schemas only
  → Tool Router (permission check) → Business Services → MongoDB
  → Structured JSON → LLM → Streaming markdown + UI blocks
```

**The LLM never receives a MongoDB connection, query string, or raw credentials.**

## Modules

| Path | Role |
|------|------|
| `types.ts` | Shared contracts |
| `prompts.ts` | System prompt + output format |
| `registry/` | Tool definitions (name, perms, schema, handler) |
| `services/` | Domain queries & mutations (tenant-scoped) |
| `gateway/` | Executor, OpenAI client, audit, fallback intent |
| Models | `AiConversation`, `AiMessage`, `AiToolAudit` |
| APIs | `/api/ai/chat`, `/conversations`, `/dashboard` |

## Security

1. `withAuth(..., "ai.use")` on every AI route  
2. Each tool declares `permissions: Permission[]`  
3. Action tools also require `ai.actions`  
4. Every tool call writes `AiToolAudit`  
5. Tenant ids come only from JWT — never from LLM args  

## Env

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Without `OPENAI_API_KEY`, the gateway uses deterministic intent routing so demos still work.

## Run

Open **AI Copilot** in the sidebar (`/ai`). Dashboard KPIs: `/ai` overview widgets on the same page.
