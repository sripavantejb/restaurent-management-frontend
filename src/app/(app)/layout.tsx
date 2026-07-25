"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, restaurant } = useAuth();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-[var(--muted)]">
        Loading session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-[var(--muted)]">
        Redirecting to login…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface)]">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 lg:hidden">
          <button
            type="button"
            className="rounded-[6px] p-2 text-[var(--ink)] hover:bg-[var(--surface-2)]"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{restaurant?.name ?? "RestaurantOS"}</p>
            <p className="truncate text-[11px] text-[var(--muted)]">Staff console</p>
          </div>
          <NotificationBell />
          <ThemeToggle />
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
