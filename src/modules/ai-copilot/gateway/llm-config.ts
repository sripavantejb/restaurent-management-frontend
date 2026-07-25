/**
 * LLM provider config — OpenAI for chat polish, NVIDIA NIM for embeddings when set.
 */

export type LlmProvider = "nvidia" | "openai";

function nvidiaKey() {
  return (
    process.env.NVIDIA_API_KEY?.trim() ||
    process.env.NGC_API_KEY?.trim() ||
    ""
  );
}

function openaiKey() {
  // Strip accidental BOM / quotes from .env.local (Windows PowerShell UTF-8 BOM)
  const raw =
    process.env.OPENAI_API_KEY?.replace(/^\uFEFF/, "").trim() ||
    process.env["OPENAI_API_KEY"]?.trim() ||
    "";
  return raw.replace(/^["']|["']$/g, "");
}

/** Chat / answer polish — prefer OpenAI when keyed (more reliable than NIM empty streams). */
export function chatProvider(): LlmProvider {
  const force = process.env.AI_CHAT_PROVIDER?.trim().toLowerCase();
  if (force === "openai" && openaiKey()) return "openai";
  if (force === "nvidia" && nvidiaKey()) return "nvidia";
  if (openaiKey()) return "openai";
  if (nvidiaKey()) return "nvidia";
  return "openai";
}

/** Embeddings / RAG — prefer NVIDIA when keyed. */
export function embeddingProvider(): LlmProvider {
  if (nvidiaKey()) return "nvidia";
  if (openaiKey()) return "openai";
  return "openai";
}

/** @deprecated alias — chat provider */
export function llmProvider(): LlmProvider {
  return chatProvider();
}

export function hasLlmKey(): boolean {
  return Boolean(openaiKey() || nvidiaKey());
}

export function hasOpenAiChatKey(): boolean {
  return Boolean(openaiKey());
}

export function llmApiKey(): string | null {
  if (chatProvider() === "openai") return openaiKey() || null;
  return nvidiaKey() || openaiKey() || null;
}

export function embeddingApiKey(): string | null {
  if (embeddingProvider() === "nvidia") return nvidiaKey() || null;
  return openaiKey() || null;
}

function baseUrlFor(provider: LlmProvider): string {
  if (provider === "nvidia") {
    const raw =
      process.env.NVIDIA_BASE_URL?.trim() ||
      "https://integrate.api.nvidia.com/v1";
    return raw
      .replace(/\/chat\/completions\/?$/, "")
      .replace(/\/$/, "");
  }
  return "https://api.openai.com/v1";
}

export function llmBaseUrl(): string {
  return baseUrlFor(chatProvider());
}

export function chatCompletionsUrl(): string {
  return `${llmBaseUrl()}/chat/completions`;
}

export function embeddingsUrl(): string {
  return `${baseUrlFor(embeddingProvider())}/embeddings`;
}

export function chatModelName(): string {
  if (chatProvider() === "nvidia") {
    return (
      process.env.NVIDIA_CHAT_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      "deepseek-ai/deepseek-v4-pro"
    );
  }
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function embeddingModelName(): string {
  if (embeddingProvider() === "nvidia") {
    return (
      process.env.NVIDIA_EMBEDDING_MODEL?.trim() ||
      process.env.OPENAI_EMBEDDING_MODEL?.trim() ||
      "nvidia/nv-embedqa-e5-v5"
    );
  }
  return (
    process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small"
  );
}

/** Extra body fields for NVIDIA NIM (e.g. DeepSeek thinking off). */
export function nvidiaChatExtras(): Record<string, unknown> {
  if (chatProvider() !== "nvidia") return {};
  return {
    top_p: 0.95,
    chat_template_kwargs: { thinking: false },
  };
}
