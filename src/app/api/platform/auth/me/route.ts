import { cookies } from "next/headers";
import { connectDb } from "@/lib/db";
import { PLATFORM_COOKIE_NAME, verifyPlatformToken } from "@/lib/platform-auth";
import { json, error } from "@/lib/api";

export async function GET() {
  try {
    await connectDb();
    const jar = await cookies();
    const token = jar.get(PLATFORM_COOKIE_NAME)?.value;
    if (!token) {
      return json({ admin: null });
    }

    const session = await verifyPlatformToken(token);
    if (!session) {
      return json({ admin: null });
    }

    return json({
      admin: {
        id: session.adminId,
        name: session.name,
        email: session.email,
      },
    });
  } catch (err) {
    console.error(err);
    return error("Failed to load platform session", 500);
  }
}
