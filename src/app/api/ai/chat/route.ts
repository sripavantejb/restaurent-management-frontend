import { NextResponse } from "next/server";
import { withAuth, error } from "@/lib/api";
import type { AiTenantCtx } from "@/modules/ai-copilot/types";
import { handleCopilotChat } from "@/modules/ai-copilot/gateway/chat";

export const POST = withAuth(async ({ req, tenant, user }) => {
  let body: { message?: string; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON", 400);
  }

  const message = String(body.message || "").trim();
  if (!message) return error("message required", 400);
  if (message.length > 4000) return error("message too long", 400);

  const ctx: AiTenantCtx = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    userId: tenant.userId,
    role: user.role,
    permissions: user.permissions,
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };
      try {
        await handleCopilotChat({
          ctx,
          message,
          conversationId: body.conversationId ?? null,
          emit,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Chat failed";
        emit(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`);
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}, "ai.use");
