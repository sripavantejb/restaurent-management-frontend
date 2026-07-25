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
  X,
  Users,
  Package,
  Sparkles,
  CalendarDays,
  Heart,
  Wallet,
  Megaphone,
  UserCheck,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import type { Permission } from "@/lib/rbac";
import { ROLE_LABEL, label } from "@/lib/labels";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";

const NAV: {
  href: string;
  label: string;
  permission: Permission;
  icon: typeof LayoutDashboard;
  module?: import("@/lib/platform/modules").ModuleId;
}[] = [
  { href: "/dashboard", label: "Dashboard", permission: "reports.view", icon: LayoutDashboard },
  { href: "/ai", label: "AI Copilot", permission: "ai.use", icon: Sparkles, module: "ai" },
  { href: "/pos", label: "POS", permission: "pos.bill", icon: ShoppingCart, module: "pos" },
  { href: "/kds", label: "KDS", permission: "kds.view", icon: ChefHat, module: "kds" },
  { href: "/orders", label: "Orders", permission: "orders.view", icon: ClipboardList, module: "orders" },
  { href: "/menu", label: "Menu", permission: "menu.view", icon: UtensilsCrossed, module: "menu" },
  { href: "/inventory", label: "Inventory", permission: "inventory.view", icon: Package, module: "inventory" },
  { href: "/tables", label: "Tables", permission: "tables.view", icon: Grid3X3, module: "tables" },
  { href: "/reservations", label: "Reservations", permission: "tables.view", icon: CalendarDays, module: "reservations" },
  { href: "/crm", label: "CRM", permission: "reports.view", icon: Heart, module: "crm" },
  { href: "/finance", label: "Finance", permission: "reports.view", icon: Wallet, module: "finance" },
  { href: "/hr", label: "HR", permission: "users.manage", icon: UserCheck, module: "hr" },
  { href: "/marketing", label: "Marketing", permission: "reports.view", icon: Megaphone, module: "marketing" },
  { href: "/reports", label: "Reports", permission: "reports.view", icon: BarChart3, module: "reports" },
  { href: "/staff", label: "Waiters", permission: "users.manage", icon: Users, module: "staff" },
  { href: "/qr", label: "QR", permission: "qr.manage", icon: QrCode, module: "qr" },
  { href: "/settings", label: "Setup", permission: "qr.manage", icon: Settings },
];

export function Sidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { user, restaurant, branches, activeBranchId, setActiveBranchId, logout, hasPermission, hasModule } =
    useAuth();

  const items = NAV.filter(
    (n) => hasPermission(n.permission) && hasModule(n.module ?? null)
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[min(18rem,86vw)] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform duration-200 lg:static lg:z-auto lg:w-56 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-[var(--border)] px-4 py-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
                RestaurantOS
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">
                {restaurant?.name ?? "…"}
              </p>
            </div>
            <button
              type="button"
              className="rounded-[6px] p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] lg:hidden"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
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

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
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
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-[var(--muted)]">
                {label(ROLE_LABEL, user?.role)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-1 flex w-full items-center gap-2 rounded-[6px] px-2 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
