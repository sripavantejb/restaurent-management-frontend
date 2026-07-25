import crypto from "crypto";

/** Approximate token-ish chunking by characters (~4 chars/token). */
const TARGET_CHARS = 2000; // ~500 tokens
const OVERLAP_CHARS = 200;

export function contentHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 32);
}

export function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  if (cleaned.length <= TARGET_CHARS) return [cleaned];

  const parts: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + TARGET_CHARS, cleaned.length);
    if (end < cleaned.length) {
      const slice = cleaned.slice(start, end);
      const breakAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf(". ")
      );
      if (breakAt > TARGET_CHARS * 0.4) {
        end = start + breakAt + 1;
      }
    }
    const chunk = cleaned.slice(start, end).trim();
    if (chunk) parts.push(chunk);
    if (end >= cleaned.length) break;
    start = Math.max(0, end - OVERLAP_CHARS);
  }
  return parts;
}
