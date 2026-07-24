import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const STAFF_COOKIE = "ros_token";
const PLATFORM_COOKIE = "ros_platform_token";

const PUBLIC_EXACT = [
  "/login",
  "/api/auth/login",
  "/admin/login",
  "/api/platform/auth/login",
];
const PUBLIC_PREFIX = ["/q/", "/t/", "/api/guest/", "/guest/"];

function secret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || "restaurantos-dev-secret-change-in-production"
  );
}

function isPublic(pathname: string) {
  if (PUBLIC_EXACT.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  return PUBLIC_PREFIX.some((p) => pathname.startsWith(p));
}

function isPlatformPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/platform/");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (isPublic(pathname)) {
    // Logged-in platform admin visiting login → console
    if (pathname === "/admin/login") {
      const platformToken = req.cookies.get(PLATFORM_COOKIE)?.value;
      if (platformToken) {
        try {
          const { payload } = await jwtVerify(platformToken, secret());
          if (payload.kind === "platform") {
            const url = req.nextUrl.clone();
            url.pathname = "/admin";
            return NextResponse.redirect(url);
          }
        } catch {
          /* fall through */
        }
      }
    }

    // Logged-in staff visiting /login → home
    if (pathname === "/login") {
      const staffToken = req.cookies.get(STAFF_COOKIE)?.value;
      if (staffToken) {
        try {
          const { payload } = await jwtVerify(staffToken, secret());
          const role = String(payload.role || "OWNER");
          const url = req.nextUrl.clone();
          url.pathname =
            role === "CASHIER" ? "/pos" : role === "CHEF" ? "/kds" : "/dashboard";
          return NextResponse.redirect(url);
        } catch {
          /* fall through */
        }
      }
    }

    return NextResponse.next();
  }

  // Platform admin routes
  if (isPlatformPath(pathname)) {
    const token = req.cookies.get(PLATFORM_COOKIE)?.value;
    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    try {
      const { payload } = await jwtVerify(token, secret());
      if (payload.kind !== "platform") throw new Error("not platform");
    } catch {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      const res = NextResponse.redirect(url);
      res.cookies.set(PLATFORM_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
    return NextResponse.next();
  }

  // Staff app routes
  const token = req.cookies.get(STAFF_COOKIE)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let role = "OWNER";
  try {
    const { payload } = await jwtVerify(token, secret());
    role = String(payload.role || "OWNER");
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    const res = NextResponse.redirect(url);
    res.cookies.set(STAFF_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  if (pathname === "/" || pathname === "/dashboard") {
    if (role === "CASHIER") {
      const url = req.nextUrl.clone();
      url.pathname = "/pos";
      return NextResponse.redirect(url);
    }
    if (role === "CHEF") {
      const url = req.nextUrl.clone();
      url.pathname = "/kds";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
