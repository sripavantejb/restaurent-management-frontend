import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Types } from "mongoose";

export const PLATFORM_COOKIE_NAME = "ros_platform_token";
const TOKEN_TTL = "12h";

export interface PlatformJwtPayload {
  adminId: string;
  email: string;
  name: string;
  kind: "platform";
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export async function signPlatformToken(
  payload: Omit<PlatformJwtPayload, "kind">
): Promise<string> {
  return new SignJWT({ ...payload, kind: "platform" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecret());
}

export async function verifyPlatformToken(
  token: string
): Promise<PlatformJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind !== "platform") return null;
    return payload as unknown as PlatformJwtPayload;
  } catch {
    return null;
  }
}

export async function getPlatformSession(): Promise<PlatformJwtPayload | null> {
  const jar = await cookies();
  const token = jar.get(PLATFORM_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyPlatformToken(token);
}

export function buildPlatformJwtPayload(admin: {
  _id: Types.ObjectId;
  email: string;
  name: string;
}): Omit<PlatformJwtPayload, "kind"> {
  return {
    adminId: admin._id.toString(),
    email: admin.email,
    name: admin.name,
  };
}

/** Lowercase slug from restaurant name; strips non-alphanumerics. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
