import crypto from "crypto";

const BASE = "https://api.razorpay.com/v1";

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new Error(
      "Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET. Add them to .env.local or Vercel env."
    );
  }
  return { keyId, keySecret };
}

function authHeader() {
  const { keyId, keySecret } = credentials();
  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return `Basic ${token}`;
}

async function rzFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: { description?: string };
  };
  if (!res.ok) {
    throw new Error(
      data.error?.description || `Razorpay ${res.status} on ${path}`
    );
  }
  return data;
}

export function razorpayConfigured(): boolean {
  return !!(
    process.env.RAZORPAY_KEY_ID?.trim() &&
    process.env.RAZORPAY_KEY_SECRET?.trim()
  );
}

export async function createRazorpayCustomer(input: {
  name: string;
  email: string;
  contact?: string;
  notes?: Record<string, string>;
}) {
  return rzFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      contact: input.contact || undefined,
      fail_existing: "0",
      notes: input.notes,
    }),
  });
}

export async function createRazorpaySubscription(input: {
  planId: string;
  customerId: string;
  totalCount?: number;
  notes?: Record<string, string>;
}) {
  return rzFetch<{
    id: string;
    short_url: string;
    status: string;
  }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: input.planId,
      customer_id: input.customerId,
      total_count: input.totalCount ?? 120,
      customer_notify: 1,
      notes: input.notes,
    }),
  });
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

export function publicKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID?.trim() || null;
}
