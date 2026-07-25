import { Types } from "mongoose";
import { AiConversation } from "@/models/AiConversation";
import { AiMessage } from "@/models/AiMessage";
import type { AiTenantCtx, StreamEvent, ToolResult } from "../types";
import { filterToolsForUser } from "../registry/tools";
import { executeTool } from "./executor";
import { detectIntentTools } from "./intent";
import { hasOpenAiChatKey } from "./llm-config";
import { polishToolAnswer } from "./openai";

function sse(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Copilot chat:
 * 1) Always query live Mongo via intent tools
 * 2) Optionally polish with OpenAI (numbers stay from tools)
 */
export async function handleCopilotChat(input: {
  ctx: AiTenantCtx;
  message: string;
  conversationId?: string | null;
  emit: (chunk: string) => void;
}): Promise<{ conversationId: string }> {
  const { ctx, message, emit } = input;

  let conversation = input.conversationId
    ? await AiConversation.findOne({
        _id: input.conversationId,
        restaurantId: ctx.restaurantId,
        branchId: ctx.branchId,
        userId: ctx.userId,
      })
    : null;

  if (!conversation) {
    conversation = await AiConversation.create({
      restaurantId: ctx.restaurantId,
      branchId: ctx.branchId,
      userId: ctx.userId,
      title: message.slice(0, 60) || "New chat",
      lastMessageAt: new Date(),
    });
  }

  const conversationId = conversation._id.toString();
  emit(sse({ type: "conversation", conversationId }));

  await AiMessage.create({
    restaurantId: ctx.restaurantId,
    branchId: ctx.branchId,
    conversationId: conversation._id,
    role: "user",
    content: message,
  });

  const allowed = filterToolsForUser(ctx.permissions);
  const collectedBlocks: ToolResult["blocks"] = [];
  const toolSummaries: string[] = [];

  const runOne = async (name: string, args: Record<string, unknown> = {}) => {
    emit(sse({ type: "tool_start", tool: name }));
    const result = await executeTool({
      ctx,
      toolName: name,
      args,
      conversationId,
      question: message,
    });
    emit(sse({ type: "tool_end", tool: name }));
    if (result.blocks?.length) {
      for (const b of result.blocks) {
        collectedBlocks!.push(b);
        emit(sse({ type: "block", block: b }));
      }
    }
    toolSummaries.push(result.summary);
    return {
      summary: result.summary,
      payload: { data: result.data, blocks: result.blocks },
    };
  };

  const names = detectIntentTools(message).filter((n) =>
    allowed.some((t) => t.name === n)
  );

  for (const name of names) {
    const args =
      name === "searchKnowledge" ? { query: message, topK: 6 } : {};
    await runOne(name, args);
  }

  const rawText =
    toolSummaries.length > 0
      ? toolSummaries.join("\n\n")
      : "I couldn't match that to live restaurant data. Try asking about sales, tables, kitchen, or stock.";

  let assistantText = rawText;

  if (hasOpenAiChatKey() && toolSummaries.length > 0) {
    try {
      const polished = await polishToolAnswer({
        question: message,
        toolSummaries,
        onDelta: (d) => emit(sse({ type: "delta", content: d })),
      });
      if (polished.trim()) {
        assistantText = polished.trim();
      } else {
        for (const part of chunkText(rawText, 48)) {
          emit(sse({ type: "delta", content: part }));
        }
        assistantText = rawText;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OpenAI polish failed";
      emit(sse({ type: "error", error: msg }));
      for (const part of chunkText(rawText, 48)) {
        emit(sse({ type: "delta", content: part }));
      }
      assistantText = rawText;
    }
  } else {
    for (const part of chunkText(rawText, 48)) {
      emit(sse({ type: "delta", content: part }));
    }
  }

  const saved = await AiMessage.create({
    restaurantId: ctx.restaurantId,
    branchId: ctx.branchId,
    conversationId: new Types.ObjectId(conversationId),
    role: "assistant",
    content: assistantText,
    blocks: collectedBlocks,
  });

  conversation.title =
    conversation.title === "New chat"
      ? message.slice(0, 60)
      : conversation.title;
  conversation.lastMessageAt = new Date();
  await conversation.save();

  emit(
    sse({
      type: "done",
      conversationId,
      messageId: saved._id.toString(),
    })
  );

  return { conversationId };
}

function chunkText(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}
