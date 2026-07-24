"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  ChefHat,
  ClipboardList,
  UtensilsCrossed,
  Grid3X3,
  QrCode,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import type { Permission } from "@/lib/rbac";

const NAV: {
  href: string;
  label: string;
  permission: Permission;
  icon: typeof LayoutDashboard;
}[] = [
  { href: "/dashboard", label: "Dashboard", permission: "reports.view", icon: LayoutDashboard },
  { href: "/pos", label: "POS", permission: "pos.bill", icon: ShoppingCart },
  { href: "/kds", label: "KDS", permission: "kds.view", icon: ChefHat },
  { href: "/orders", label: "Orders", permission: "orders.view", icon: ClipboardList },
  { href: "/menu", label: "Menu", permission: "menu.view", icon: UtensilsCrossed },
  { href: "/tables", label: "Tables", permission: "tables.view", icon: Grid3X3 },
  { href: "/qr", label: "QR", permission: "qr.manage", icon: QrCode },
  { href: "/settings", label: "Settings", permission: "qr.manage", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, restaurant, branches, activeBranchId, setActiveBranchId, logout, hasPermission } =
    useAuth();

  const items = NAV.filter((n) => hasPermission(n.permission));

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-5">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
          RestaurantOS
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">
          {restaurant?.name ?? "…"}
        </p>
        {user?.permissions.includes("branch.switch") && branches.length > 1 ? (
          <select
            className="mt-3 h-9 w-full rounded-[6px] border border-[var(--border)] bg-white px-2 text-xs"
            value={activeBranchId ?? ""}
            onChange={(e) => setActiveBranchId(e.target.value)}
            aria-label="Switch branch"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-1 text-xs text-[var(--muted)]">
            {branches.find((b) => b.id === activeBranchId)?.name}
          </p>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-[6px] px-3 py-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                active
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <p className="truncate text-sm font-medium">{user?.name}</p>
        <p className="text-xs text-[var(--muted)]">{user?.role}</p>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-2 flex w-full items-center gap-2 rounded-[6px] px-2 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}
