import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "./db";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function guestRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

export function guestError(message: string, status = 400, hint?: string) {
  return NextResponse.json(
    {
      error: message,
      hint: hint ?? "Ask your server for help if this keeps happening.",
    },
    { status }
  );
}

export function guestJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

type GuestHandler = (
  req: NextRequest,
  ctx: { params: Record<string, string> }
) => Promise<NextResponse> | NextResponse;

/** Unauthenticated guest API wrapper with basic IP rate limit. */
export function withGuest(handler: GuestHandler, opts?: { limit?: number }) {
  return async (
    req: NextRequest,
    routeCtx: { params: Promise<Record<string, string>> }
  ) => {
    try {
      await connectDb();
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown";
      const path = req.nextUrl.pathname;
      if (!guestRateLimit(`${ip}:${path}`, opts?.limit ?? 60, 60_000)) {
        return guestError(
          "Too many requests",
          429,
          "Wait a moment and try again — restaurant wifi can be busy."
        );
      }
      const params = routeCtx?.params ? await routeCtx.params : {};
      return await handler(req, { params });
    } catch (err) {
      console.error(err);
      return guestError(
        "Something went wrong",
        500,
        "Please ask staff for help. Your order was not placed."
      );
    }
  };
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}
