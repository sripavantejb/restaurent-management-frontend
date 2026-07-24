import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { PlatformAdmin } from "@/models/PlatformAdmin";
import { verifyPassword } from "@/lib/auth";
import {
  PLATFORM_COOKIE_NAME,
  signPlatformToken,
  buildPlatformJwtPayload,
} from "@/lib/platform-auth";
import { json, error } from "@/lib/api";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const body = LoginSchema.parse(await req.json());

    const admin = await PlatformAdmin.findOne({
      email: body.email.toLowerCase(),
    });
    if (!admin || !admin.isActive) {
      return error(
        "Invalid email or password",
        401,
        "Use admin@restaurantos.com / demo1234 after seeding."
      );
    }

    const ok = await verifyPassword(body.password, admin.passwordHash);
    if (!ok) {
      return error(
        "Invalid email or password",
        401,
        "Password for the seeded platform admin is demo1234."
      );
    }

    const payload = buildPlatformJwtPayload(admin);
    const token = await signPlatformToken(payload);
    const res = json({
      admin: {
        id: payload.adminId,
        name: payload.name,
        email: payload.email,
      },
    });

    res.cookies.set(PLATFORM_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid login payload", 400, err.errors[0]?.message);
    }
    console.error(err);
    return error("Login failed", 500, "Check MongoDB is running and seeded.");
  }
}
