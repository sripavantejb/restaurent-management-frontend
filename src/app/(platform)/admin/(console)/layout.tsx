"use client";

import { PlatformAuthProvider, usePlatformAuth } from "@/components/PlatformAuthProvider";
import { PlatformSidebar } from "@/components/PlatformSidebar";

function Shell({ children }: { children: React.ReactNode }) {
  const { loading, admin } = usePlatformAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Loading platform session…
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Redirecting to admin login…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface)]">
      <PlatformSidebar />
      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlatformAuthProvider>
      <Shell>{children}</Shell>
    </PlatformAuthProvider>
  );
}
