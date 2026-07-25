import { COPILOT_SYSTEM_PROMPT, POLISH_SYSTEM_PROMPT } from "../prompts";
import type { AiToolDefinition } from "../types";
import { toolsForOpenAI } from "../registry/tools";
import {
  chatCompletionsUrl,
  chatModelName,
  hasLlmKey,
  hasOpenAiChatKey,
  llmApiKey,
  llmProvider,
  nvidiaChatExtras,
} from "./llm-config";

/** @deprecated use hasLlmKey — kept for call sites */
export function hasOpenAiKey() {
  return hasLlmKey();
}

export function modelName() {
  return chatModelName();
}

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
}

/** Non-streaming completion with tool loop (max 3 rounds). */
export async function runOpenAiWithTools(input: {
  messages: ChatMsg[];
  tools: AiToolDefinition[];
  execute: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<{ summary: string; payload: unknown }>;
}): Promise<{ text: string; toolNames: string[] }> {
  const key = llmApiKey();
  if (!key) throw new Error("Missing NVIDIA_API_KEY or OPENAI_API_KEY");

  const toolNames: string[] = [];
  let messages: ChatMsg[] = [
    { role: "system", content: COPILOT_SYSTEM_PROMPT },
    ...input.messages,
  ];

  for (let round = 0; round < 3; round++) {
    const res = await fetch(chatCompletionsUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: chatModelName(),
        messages,
        tools: toolsForOpenAI(input.tools),
        tool_choice: "auto",
        temperature: llmProvider() === "nvidia" ? 0.6 : 0.2,
        ...(llmProvider() === "nvidia"
          ? { max_tokens: 4096, ...nvidiaChatExtras() }
          : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM error ${res.status}: ${errText.slice(0, 280)}`);
    }

    const data = (await res.json()) as {
      choices: {
        message: ChatMsg & {
          tool_calls?: {
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }[];
        };
        finish_reason: string;
      }[];
    };

    const msg = data.choices[0]?.message;
    if (!msg) throw new Error("Empty LLM response");

    if (msg.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: msg.content || "",
        tool_calls: msg.tool_calls,
      });
      for (const tc of msg.tool_calls) {
        toolNames.push(tc.function.name);
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        const out = await input.execute(tc.function.name, args);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({
            summary: out.summary,
            data: out.payload,
          }),
        });
      }
      continue;
    }

    return { text: msg.content || "Done.", toolNames };
  }

  return {
    text: "I gathered the data but hit the tool-call limit. Ask a follow-up for more detail.",
    toolNames,
  };
}

/** Stream token deltas after tools already resolved (final answer only). */
export async function streamOpenAiFinal(input: {
  messages: ChatMsg[];
  onDelta: (text: string) => void;
  systemPrompt?: string;
  timeoutMs?: number;
}): Promise<string> {
  const key = llmApiKey();
  if (!key) throw new Error("Missing NVIDIA_API_KEY or OPENAI_API_KEY");

  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? 25000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(chatCompletionsUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: chatModelName(),
        messages: [
          {
            role: "system",
            content: input.systemPrompt || COPILOT_SYSTEM_PROMPT,
          },
          ...input.messages,
        ],
        stream: true,
        temperature: llmProvider() === "nvidia" ? 0.6 : 0.3,
        ...(llmProvider() === "nvidia"
          ? { max_tokens: 4096, ...nvidiaChatExtras() }
          : { max_tokens: 1200 }),
      }),
    });

    if (!res.ok || !res.body) {
      const t = await res.text();
      throw new Error(`LLM stream error: ${t.slice(0, 280)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as {
            choices: { delta: { content?: string } }[];
          };
          const delta = json.choices[0]?.delta?.content;
          if (delta) {
            full += delta;
            input.onDelta(delta);
          }
        } catch {
          /* ignore partial */
        }
      }
    }

    return full;
  } finally {
    clearTimeout(timer);
  }
}

/** Polish live tool summaries with OpenAI (or configured chat provider). */
export async function polishToolAnswer(input: {
  question: string;
  toolSummaries: string[];
  onDelta: (text: string) => void;
}): Promise<string> {
  if (!hasOpenAiChatKey() && !hasLlmKey()) {
    throw new Error("No chat LLM key");
  }
  return streamOpenAiFinal({
    systemPrompt: POLISH_SYSTEM_PROMPT,
    onDelta: input.onDelta,
    messages: [
      {
        role: "user",
        content: [
          `Staff question: ${input.question}`,
          "",
          "Live database tool results (authoritative — do not invent beyond this):",
          input.toolSummaries.join("\n\n") || "(no tool data)",
          "",
          "Write the final staff-facing answer now.",
        ].join("\n"),
      },
    ],
  });
}
