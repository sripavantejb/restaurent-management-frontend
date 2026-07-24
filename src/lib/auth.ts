import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import type { Role, Permission } from "./rbac";
import { permissionsForRole } from "./rbac";

export const COOKIE_NAME = "ros_token";
const TOKEN_TTL = "12h";

export interface JwtPayload {
  userId: string;
  restaurantId: string;
  branchId: string;
  role: Role;
  permissions: Permission[];
  email: string;
  name: string;
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JwtPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

export function buildJwtPayload(user: {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
  role: Role;
  email: string;
  name: string;
}): JwtPayload {
  return {
    userId: user._id.toString(),
    restaurantId: user.restaurantId.toString(),
    branchId: user.branchId.toString(),
    role: user.role,
    permissions: permissionsForRole(user.role),
    email: user.email,
    name: user.name,
  };
}
