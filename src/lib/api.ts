import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "./db";
import { COOKIE_NAME, verifyToken, type JwtPayload } from "./auth";
import {
  PLATFORM_COOKIE_NAME,
  verifyPlatformToken,
  type PlatformJwtPayload,
} from "./platform-auth";
import { hasPermission, type Permission } from "./rbac";
import { setRequestTenant, clearRequestTenant, type TenantContext } from "./tenant";

export interface ApiContext {
  req: NextRequest;
  user: JwtPayload;
  tenant: TenantContext;
}

export interface PlatformApiContext {
  req: NextRequest;
  admin: PlatformJwtPayload;
}

type Handler = (ctx: ApiContext) => Promise<NextResponse> | NextResponse;
type PlatformHandler = (
  ctx: PlatformApiContext
) => Promise<NextResponse> | NextResponse;

export type RouteContext = {
  params: Promise<Record<string, string>>;
};

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400, hint?: string) {
  return NextResponse.json(
    { error: message, hint: hint ?? "Check the request and try again." },
    { status }
  );
}

export function withAuth(
  handler: Handler,
  requiredPermission?: Permission | Permission[]
) {
  return async (req: NextRequest, routeCtx: RouteContext) => {
    try {
      await connectDb();
      const token = req.cookies.get(COOKIE_NAME)?.value;
      if (!token) {
        return error("Not authenticated", 401, "Log in at /login and try again.");
      }

      const user = await verifyToken(token);
      if (!user) {
        return error("Session expired", 401, "Log in again to continue.");
      }

      if (requiredPermission && !hasPermission(user.permissions, requiredPermission)) {
        return error(
          "Permission denied",
          403,
          `Requires ${Array.isArray(requiredPermission) ? requiredPermission.join(", ") : requiredPermission}.`
        );
      }

      let branchId = user.branchId;
      const headerBranch = req.headers.get("x-branch-id");
      if (headerBranch && user.permissions.includes("branch.switch")) {
        branchId = headerBranch;
      }

      const tenant: TenantContext = {
        userId: new Types.ObjectId(user.userId),
        restaurantId: new Types.ObjectId(user.restaurantId),
        branchId: new Types.ObjectId(branchId),
        role: user.role,
        permissions: user.permissions,
      };

      setRequestTenant(tenant);

      const enrichedReq = req as NextRequest & { routeParams?: Record<string, string> };
      enrichedReq.routeParams = (await routeCtx?.params) ?? {};

      const res = await handler({
        req: enrichedReq,
        user: { ...user, branchId },
        tenant,
      });
      clearRequestTenant();
      return res;
    } catch (err) {
      clearRequestTenant();
      console.error(err);
      return error(
        err instanceof Error ? err.message : "Internal server error",
        500,
        "Check server logs and MongoDB connection."
      );
    }
  };
}

export function getParams(req: NextRequest): Record<string, string> {
  return (req as NextRequest & { routeParams?: Record<string, string> }).routeParams ?? {};
}

export function withPlatformAuth(handler: PlatformHandler) {
  return async (req: NextRequest, routeCtx: RouteContext) => {
    try {
      await connectDb();
      const token = req.cookies.get(PLATFORM_COOKIE_NAME)?.value;
      if (!token) {
        return error(
          "Not authenticated",
          401,
          "Log in at /admin/login and try again."
        );
      }

      const admin = await verifyPlatformToken(token);
      if (!admin) {
        return error("Session expired", 401, "Log in again to continue.");
      }

      const enrichedReq = req as NextRequest & {
        routeParams?: Record<string, string>;
      };
      enrichedReq.routeParams = (await routeCtx?.params) ?? {};

      return await handler({ req: enrichedReq, admin });
    } catch (err) {
      console.error(err);
      return error(
        err instanceof Error ? err.message : "Internal server error",
        500,
        "Check server logs and MongoDB connection."
      );
    }
  };
}
