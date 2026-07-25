import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Liveness / readiness for load balancers and deploy checks. */
export async function GET() {
  const started = Date.now();
  let mongo: "ok" | "error" = "ok";
  let mongoError = "";

  try {
    await connectDb();
  } catch (e) {
    mongo = "error";
    mongoError = e instanceof Error ? e.message : "db connect failed";
  }

  const ready =
    mongo === "ok" &&
    !!process.env.MONGODB_URI &&
    !!process.env.JWT_SECRET &&
    !!process.env.QR_MASTER_KEY;

  const body = {
    status: ready ? "ok" : "degraded",
    ready,
    uptimeMs: Math.round(process.uptime() * 1000),
    latencyMs: Date.now() - started,
    checks: {
      mongodb: mongo,
      mongodbUri: !!process.env.MONGODB_URI,
      jwtSecret: !!process.env.JWT_SECRET,
      qrMasterKey: !!process.env.QR_MASTER_KEY,
      appUrl: !!process.env.APP_URL,
    },
    ...(mongoError ? { mongoError } : {}),
    time: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: ready ? 200 : 503 });
}
