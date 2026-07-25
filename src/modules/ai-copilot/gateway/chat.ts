import { Types } from "mongoose";
import { AiConversation } from "@/models/AiConversation";
import { AiMessage } from "@/models/AiMessage";
import type { AiTenantCtx, StreamEvent, ToolResult } from "../types";
import { filterToolsForUser } from "../registry/tools";
import { executeTool } from "./executor";
import { detectIntentTools } from "./intent";
import {
  hasOpenAiKey,
  runOpenAiWithTools,
  streamOpenAiFinal,
  type ChatMsg,
} from "./openai";

function sse(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

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

  const history = await AiMessage.find({
    conversationId: conversation._id,
    restaurantId: ctx.restaurantId,
  })
    .sort({ createdAt: 1 })
    .limit(40)
    .lean();

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
    toolSummaries.push(`${name}: ${result.summary}`);
    return {
      summary: result.summary,
      payload: { data: result.data, blocks: result.blocks },
    };
  };

  let assistantText = "";

  if (hasOpenAiKey()) {
    const chatMsgs: ChatMsg[] = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    try {
      const { text, toolNames } = await runOpenAiWithTools({
        messages: chatMsgs,
        tools: allowed,
        execute: runOne,
      });

      // Stream a polished pass if tools ran
      if (toolNames.length) {
        const polishMsgs: ChatMsg[] = [
          ...chatMsgs,
          {
            role: "user",
            content: `Tool results:\n${toolSummaries.join("\n")}\n\nWrite the final answer for the user now.`,
          },
        ];
        assistantText = await streamOpenAiFinal({
          messages: polishMsgs,
          onDelta: (d) => emit(sse({ type: "delta", content: d })),
        });
      } else {
        assistantText = text;
        // faux stream
        for (const part of chunkText(text, 24)) {
          emit(sse({ type: "delta", content: part }));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI error";
      emit(sse({ type: "error", error: msg }));
      // fallback to intent
      assistantText = await runFallback();
    }
  } else {
    assistantText = await runFallback();
  }

  async function runFallback() {
    const names = detectIntentTools(message).filter((n) =>
      allowed.some((t) => t.name === n)
    );
    for (const name of names) {
      await runOne(name, {});
    }
    const text = [
      "### Summary",
      toolSummaries.join("\n\n") || "No tools matched your permissions.",
      "",
      "### Notes",
      process.env.OPENAI_API_KEY
        ? ""
        : "_Running in local tool mode (set OPENAI_API_KEY for full LLM reasoning)._",
      "",
      "### Suggested follow-ups",
      "- What are today's sales?",
      "- Show low stock items",
      "- Forecast tomorrow's sales",
    ]
      .filter(Boolean)
      .join("\n");

    for (const part of chunkText(text, 32)) {
      emit(sse({ type: "delta", content: part }));
    }
    return text;
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
