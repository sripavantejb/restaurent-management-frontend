"use client";

import { useAuth } from "@/components/AuthProvider";
import { ROLE_LABEL, label } from "@/lib/labels";

export default function WaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user, logout, restaurant, branches, activeBranchId } =
    useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4 text-[var(--muted)]">
        Loading waiter floor…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4 text-[var(--muted)]">
        Redirecting to login…
      </div>
    );
  }

  const branchName =
    branches.find((b) => b.id === activeBranchId)?.name ?? "Branch";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--surface)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--ink)] px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
            Waiter floor
          </p>
          <p className="truncate text-sm font-semibold">
            {restaurant?.name ?? "RestaurantOS"}
            <span className="mx-1.5 text-white/40">·</span>
            <span className="font-normal text-white/70">{branchName}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-[11px] text-white/55">
              {label(ROLE_LABEL, user.role)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-[6px] border border-white/20 px-3 py-2 text-xs font-medium hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
