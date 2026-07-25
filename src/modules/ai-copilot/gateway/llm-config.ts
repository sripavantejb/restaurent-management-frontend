/**
 * LLM provider config — OpenAI or NVIDIA NIM (OpenAI-compatible).
 * Prefer NVIDIA when NVIDIA_API_KEY / NGC_API_KEY is set.
 */

export type LlmProvider = "nvidia" | "openai";

export function llmProvider(): LlmProvider {
  const nvidia =
    process.env.NVIDIA_API_KEY?.trim() ||
    process.env.NGC_API_KEY?.trim() ||
    "";
  if (nvidia) return "nvidia";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return "openai";
}

export function hasLlmKey(): boolean {
  return Boolean(
    process.env.NVIDIA_API_KEY?.trim() ||
      process.env.NGC_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim()
  );
}

export function llmApiKey(): string | null {
  return (
    process.env.NVIDIA_API_KEY?.trim() ||
    process.env.NGC_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    null
  );
}

/** Root OpenAI-compatible base, e.g. https://integrate.api.nvidia.com/v1 */
export function llmBaseUrl(): string {
  if (llmProvider() === "nvidia") {
    const raw =
      process.env.NVIDIA_BASE_URL?.trim() ||
      "https://integrate.api.nvidia.com/v1";
    return raw
      .replace(/\/chat\/completions\/?$/, "")
      .replace(/\/$/, "");
  }
  return "https://api.openai.com/v1";
}

export function chatCompletionsUrl(): string {
  return `${llmBaseUrl()}/chat/completions`;
}

export function embeddingsUrl(): string {
  return `${llmBaseUrl()}/embeddings`;
}

export function chatModelName(): string {
  if (llmProvider() === "nvidia") {
    return (
      process.env.NVIDIA_CHAT_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      "deepseek-ai/deepseek-v4-pro"
    );
  }
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function embeddingModelName(): string {
  if (llmProvider() === "nvidia") {
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
  if (llmProvider() !== "nvidia") return {};
  return {
    top_p: 0.95,
    chat_template_kwargs: { thinking: false },
  };
}
