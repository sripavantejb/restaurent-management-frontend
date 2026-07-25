import { hasLlmKey, llmApiKey, embeddingsUrl, embeddingModelName } from "../gateway/llm-config";

export function embeddingModel() {
  return embeddingModelName();
}

export function embeddingsAvailable() {
  return hasLlmKey();
}

/** Batch embed texts. Returns empty vectors if no API key. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const key = llmApiKey();
  if (!key) {
    return texts.map(() => []);
  }

  const res = await fetch(embeddingsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: embeddingModelName(),
      input: texts.map((t) => t.slice(0, 8000)),
      encoding_format: "float",
      input_type: "passage",
    }),
  });

  if (!res.ok) {
    // Retry without NVIDIA-specific fields (OpenAI rejects unknown keys)
    const res2 = await fetch(embeddingsUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: embeddingModelName(),
        input: texts.map((t) => t.slice(0, 8000)),
      }),
    });
    if (!res2.ok) {
      const errText = await res2.text();
      throw new Error(
        `Embeddings failed: ${res2.status} ${errText.slice(0, 200)}`
      );
    }
    const data2 = (await res2.json()) as {
      data: { embedding: number[]; index: number }[];
    };
    const sorted2 = [...data2.data].sort((a, b) => a.index - b.index);
    return sorted2.map((d) => d.embedding);
  }

  const data = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  const sorted = [...data.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

export async function embedQuery(query: string): Promise<number[]> {
  const key = llmApiKey();
  if (!key) return [];

  // Prefer query input_type for NVIDIA embedqa models
  const res = await fetch(embeddingsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: embeddingModelName(),
      input: query.slice(0, 8000),
      encoding_format: "float",
      input_type: "query",
    }),
  });

  if (res.ok) {
    const data = (await res.json()) as {
      data: { embedding: number[] }[];
    };
    return data.data[0]?.embedding ?? [];
  }

  const [vec] = await embedTexts([query]);
  return vec ?? [];
}
