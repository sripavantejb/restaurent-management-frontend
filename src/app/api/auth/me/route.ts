import { cookies } from "next/headers";
import { connectDb } from "@/lib/db";
import { Branch } from "@/models/Branch";
import { Restaurant } from "@/models/Restaurant";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { json, error } from "@/lib/api";
import { resolveModules } from "@/lib/platform/modules";

export async function GET() {
  try {
    await connectDb();
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) {
      return json({
        user: null,
        restaurant: null,
        branches: [],
      });
    }

    const session = await verifyToken(token);
    if (!session) {
      return json({
        user: null,
        restaurant: null,
        branches: [],
      });
    }

    const restaurant = await Restaurant.findById(session.restaurantId).lean<{
      _id: { toString(): string };
      name: string;
      currency: string;
      logoUrl: string;
      plan?: string;
      modules?: Record<string, boolean>;
      qrOrderingEnabled?: boolean;
    } | null>();

    const branches = await Branch.find({
      restaurantId: session.restaurantId,
      isActive: true,
    }).lean<
      {
        _id: { toString(): string };
        name: string;
        code: string;
      }[]
    >();

    const modules = restaurant
      ? resolveModules(restaurant.plan, restaurant.modules)
      : null;

    return json({
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
        permissions: session.permissions,
        restaurantId: session.restaurantId,
        branchId: session.branchId,
      },
      restaurant: restaurant
        ? {
            id: restaurant._id.toString(),
            name: restaurant.name,
            currency: restaurant.currency,
            logoUrl: restaurant.logoUrl,
            plan: restaurant.plan ?? "STARTER",
            modules,
            qrOrderingEnabled: restaurant.qrOrderingEnabled !== false,
          }
        : null,
      branches: (branches ?? []).map((b) => ({
        id: b._id.toString(),
        name: b.name,
        code: b.code,
      })),
    });
  } catch (err) {
    console.error(err);
    return error("Failed to load session", 500);
  }
}
