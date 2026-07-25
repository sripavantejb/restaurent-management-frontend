import { AiToolAudit } from "@/models/AiToolAudit";
import type { AiTenantCtx, ToolResult } from "../types";
import { TOOL_BY_NAME } from "../registry/tools";

export async function executeTool(input: {
  ctx: AiTenantCtx;
  toolName: string;
  args?: Record<string, unknown>;
  conversationId?: string | null;
  question?: string | null;
}): Promise<ToolResult> {
  const started = Date.now();
  const def = TOOL_BY_NAME.get(input.toolName);
  if (!def) {
    return {
      ok: false,
      summary: `Unknown tool: ${input.toolName}`,
      error: "unknown_tool",
    };
  }

  if (!def.permissions.some((p) => input.ctx.permissions.includes(p))) {
    // Read tools: allow with ai.use so Copilot works for all staff roles
    const canAiRead =
      !def.isAction && input.ctx.permissions.includes("ai.use");
    if (!canAiRead) {
      const result: ToolResult = {
        ok: false,
        summary: `Permission denied for ${input.toolName}. Requires one of: ${def.permissions.join(", ")}.`,
        error: "forbidden",
      };
      await logAudit(input, result, Date.now() - started, {});
      return result;
    }
  }

  if (def.isAction && !input.ctx.permissions.includes("ai.actions")) {
    const result: ToolResult = {
      ok: false,
      summary: "Action tools require ai.actions permission.",
      error: "forbidden_action",
    };
    await logAudit(input, result, Date.now() - started, {});
    return result;
  }

  const args = input.args ?? {};
  try {
    const result = await def.handler(input.ctx, args);
    await logAudit(input, result, Date.now() - started, args);
    return result;
  } catch (err) {
    const result: ToolResult = {
      ok: false,
      summary: "Tool execution failed",
      error: err instanceof Error ? err.message : "error",
    };
    await logAudit(input, result, Date.now() - started, args);
    return result;
  }
}

async function logAudit(
  input: {
    ctx: AiTenantCtx;
    toolName: string;
    conversationId?: string | null;
    question?: string | null;
  },
  result: ToolResult,
  durationMs: number,
  args: Record<string, unknown>
) {
  try {
    await AiToolAudit.create({
      restaurantId: input.ctx.restaurantId,
      branchId: input.ctx.branchId,
      userId: input.ctx.userId,
      conversationId: input.conversationId ?? null,
      question: input.question ?? null,
      toolName: input.toolName,
      args,
      success: result.ok,
      error: result.error ?? null,
      durationMs,
      resultSummary: result.summary?.slice(0, 500),
    });
  } catch (e) {
    console.error("[ai-audit]", e);
  }
}
