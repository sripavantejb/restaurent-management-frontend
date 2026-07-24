const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function toBase62(bytes: Uint8Array | Buffer): string {
  // Convert bytes to big integer then base62
  let n = 0n;
  for (const b of bytes) n = (n << 8n) + BigInt(b);
  if (n === 0n) return "0";
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 62n)] + out;
    n /= 62n;
  }
  return out;
}

export function randomBase62(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % 62];
  }
  return out;
}
