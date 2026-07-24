import { createHmac, createHash, timingSafeEqual } from "crypto";
import { toBase62 } from "./base62";

function masterKey(): string {
  return process.env.QR_MASTER_KEY || process.env.JWT_SECRET || "dev-qr-key";
}

/** Derive per-restaurant QR secret material (versioned). Not returned to clients. */
export function restaurantQrSecret(
  restaurantId: string,
  secretVersion: number
): string {
  return createHmac("sha256", masterKey())
    .update(`qr:${restaurantId}:v${secretVersion}`)
    .digest("hex");
}

export function tableQrToken(input: {
  restaurantId: string;
  branchId: string;
  tableId: string;
  secretVersion: number;
}): string {
  const secret = restaurantQrSecret(input.restaurantId, input.secretVersion);
  const payload = `${input.restaurantId}:${input.branchId}:${input.tableId}:${input.secretVersion}`;
  const mac = createHmac("sha256", secret).update(payload).digest();
  return toBase62(mac).slice(0, 16);
}

export function verifyTableQrToken(input: {
  restaurantId: string;
  branchId: string;
  tableId: string;
  token: string;
  secretVersion: number;
  previousVersion?: number | null;
  previousRotatedAt?: Date | null;
}): { ok: boolean; matchedVersion: number | null } {
  const versions = [input.secretVersion];
  if (
    input.previousVersion != null &&
    input.previousRotatedAt &&
    Date.now() - input.previousRotatedAt.getTime() < 30 * 24 * 60 * 60 * 1000
  ) {
    versions.push(input.previousVersion);
  }

  for (const v of versions) {
    const expected = tableQrToken({
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      tableId: input.tableId,
      secretVersion: v,
    });
    const a = Buffer.from(expected);
    const b = Buffer.from(input.token);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { ok: true, matchedVersion: v };
    }
  }
  return { ok: false, matchedVersion: null };
}

export function hashDevice(ua: string, ipHint: string): string {
  return createHash("sha256")
    .update(`${ua}|${ipHint}|${masterKey().slice(0, 8)}`)
    .digest("hex")
    .slice(0, 32);
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const f = (c: number) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const L1 = lum(fgHex);
  const L2 = lum(bgHex);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}
