export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function topKByScore<T>(
  items: { item: T; score: number }[],
  k: number
): { item: T; score: number }[] {
  return [...items]
    .sort((x, y) => y.score - x.score)
    .slice(0, Math.max(1, k));
}

/** Fallback when embeddings are unavailable. */
export function keywordScore(query: string, text: string): number {
  const q = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  if (!q.length) return 0;
  const t = text.toLowerCase();
  let hits = 0;
  for (const w of q) {
    if (t.includes(w)) hits += 1;
  }
  return hits / q.length;
}
