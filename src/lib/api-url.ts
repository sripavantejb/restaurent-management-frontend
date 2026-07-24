/**
 * API base for browser fetches.
 * RestaurantOS route handlers live on this Next.js app (`/api/*`).
 * Leave NEXT_PUBLIC_API_URL unset so calls stay same-origin.
 * Only set it if you later host the full API on a separate origin.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(
  /\/$/,
  ""
);

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}
