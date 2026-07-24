import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { Restaurant } from "@/models/Restaurant";
import {
  verifyPassword,
  signToken,
  buildJwtPayload,
  COOKIE_NAME,
} from "@/lib/auth";
import { json, error } from "@/lib/api";
import type { Role } from "@/lib/rbac";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    await connectDb();
    const body = LoginSchema.parse(await req.json());

    const user = await User.findOne({ email: body.email.toLowerCase() });
    if (!user || !user.isActive) {
      return error("Invalid email or password", 401, "Use a seeded demo account from README.");
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      return error("Invalid email or password", 401, "Password for demo users is demo1234.");
    }

    const restaurant = await Restaurant.findById(user.restaurantId).lean<{
      status?: string;
    } | null>();
    const status = restaurant?.status ?? "ACTIVE";
    if (status === "SUSPENDED") {
      return error(
        "Restaurant suspended",
        403,
        "Contact RestaurantOS platform support to reactivate this account."
      );
    }
    if (status === "PENDING") {
      return error(
        "Restaurant pending activation",
        403,
        "This restaurant is not active yet. Ask the platform admin to activate it."
      );
    }

    const payload = buildJwtPayload({
      _id: user._id,
      restaurantId: user.restaurantId,
      branchId: user.branchId,
      role: user.role as Role,
      email: user.email,
      name: user.name,
    });

    const token = await signToken(payload);
    const res = json({
      user: {
        id: payload.userId,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions,
        restaurantId: payload.restaurantId,
        branchId: payload.branchId,
      },
    });

    res.cookies.set(COOKIE_NAME, token, {
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
