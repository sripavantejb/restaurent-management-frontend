"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Store, LogOut, Plus } from "lucide-react";
import { usePlatformAuth } from "@/components/PlatformAuthProvider";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/restaurants", label: "Restaurants", icon: Store, exact: false },
];

export function PlatformSidebar() {
  const pathname = usePathname();
  const { admin, logout } = usePlatformAuth();

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-5">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
          RestaurantOS
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--ink)]">Platform Admin</p>
        <p className="mt-1 truncate text-xs text-[var(--muted)]">{admin?.email}</p>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-[6px] px-3 py-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                active
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--ink)] hover:bg-[var(--surface-2)]"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/admin/restaurants/new"
          className="mt-2 flex items-center gap-2 rounded-[6px] border border-dashed border-[var(--border)] px-3 py-2.5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <Plus size={16} />
          Register restaurant
        </Link>
      </nav>

      <div className="border-t border-[var(--border)] p-2">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2.5 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </aside>
  );
}
