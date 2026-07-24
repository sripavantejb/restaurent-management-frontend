/** Browser/server API base — deployed Express backend on Vercel. */
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://restaurent-management-backend-sage.vercel.app"
).replace(/\/$/, "");

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}
