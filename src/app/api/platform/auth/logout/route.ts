import { NextResponse } from "next/server";
import { PLATFORM_COOKIE_NAME } from "@/lib/platform-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PLATFORM_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
