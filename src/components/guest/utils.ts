import type { MenuItem } from "./types";

const DEVICE_KEY = "ros_guest_device";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `d_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function menuCacheKey(slug: string, branch: string, menuVersion: string) {
  return `ros_guest_menu:${slug}:${branch}:${menuVersion}`;
}

export function linePrice(
  item: MenuItem,
  variant: string,
  addons: string[]
): number {
  const delta = item.variants?.find((v) => v.name === variant)?.priceDelta ?? 0;
  const addonSum = (item.addons ?? [])
    .filter((a) => addons.includes(a.name))
    .reduce((s, a) => s + a.price, 0);
  return item.price + delta + addonSum;
}

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function statusTone(status: string): "placed" | "cooking" | "ready" | "served" | "muted" {
  const s = status.toUpperCase();
  if (s === "DRAFT" || s === "CANCELLED" || s === "REJECTED") return "muted";
  if (s === "PLACED" || s === "PENDING" || s === "NEW" || s === "QUEUED") return "placed";
  if (s === "COOKING" || s === "PREPARING" || s === "IN_PROGRESS") return "cooking";
  if (s === "READY") return "ready";
  if (s === "SERVED" || s === "COMPLETED" || s === "DELIVERED") return "served";
  return "muted";
}
