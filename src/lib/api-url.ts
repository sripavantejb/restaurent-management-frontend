/**
 * API base for browser fetches.
 * RestaurantOS auth/orders/menu APIs are Next.js route handlers on this app (`/api/*`).
 * Keep calls same-origin unless you deliberately host the *full* API elsewhere.
 *
 * Do not point NEXT_PUBLIC_API_URL at the Express seed stub
 * (restaurent-management-backend-sage) — it has no /api/auth/* routes.
 */
const STUB_BACKEND_HOSTS = [
  "restaurent-management-backend-sage.vercel.app",
];

function resolveApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/$/, "");
  if (!raw) return "";
  try {
    const host = new URL(raw).hostname;
    if (STUB_BACKEND_HOSTS.includes(host)) {
      console.warn(
        `[api-url] Ignoring NEXT_PUBLIC_API_URL=${raw} (Express stub has no RestaurantOS APIs). Using same-origin /api.`
      );
      return "";
    }
  } catch {
    return "";
  }
  return raw;
}

export const API_BASE = resolveApiBase();

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}
