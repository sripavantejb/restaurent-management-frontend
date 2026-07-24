"use client";

import { useAuth } from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Loading session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Redirecting to login…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface)]">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
