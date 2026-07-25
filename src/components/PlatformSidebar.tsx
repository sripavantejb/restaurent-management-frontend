"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Store, LogOut, Plus, Menu, X, CreditCard, Puzzle } from "lucide-react";
import { usePlatformAuth } from "@/components/PlatformAuthProvider";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/restaurants", label: "Restaurants", icon: Store, exact: false },
  { href: "/admin/billing", label: "Billing", icon: CreditCard, exact: false },
  { href: "/admin/modules", label: "Modules", icon: Puzzle, exact: false },
];

export function PlatformSidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { admin, logout } = usePlatformAuth();

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
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
                RestaurantOS
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--ink)]">Platform Admin</p>
              <p className="mt-1 truncate text-xs text-[var(--muted)]">{admin?.email}</p>
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
                onClick={onClose}
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
            onClick={onClose}
            className="mt-2 flex items-center gap-2 rounded-[6px] border border-dashed border-[var(--border)] px-3 py-2.5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Plus size={16} /> New restaurant
          </Link>
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-2 rounded-[6px] px-2 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

export function PlatformMobileBar({ onOpen }: { onOpen: () => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 lg:hidden">
      <button
        type="button"
        className="rounded-[6px] p-2 text-[var(--ink)] hover:bg-[var(--surface-2)]"
        onClick={onOpen}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      <div>
        <p className="text-sm font-semibold">Platform Admin</p>
        <p className="text-[11px] text-[var(--muted)]">RestaurantOS</p>
      </div>
    </header>
  );
}

export function usePlatformNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  return { open, setOpen };
}
