"use client";

import { PlatformAuthProvider, usePlatformAuth } from "@/components/PlatformAuthProvider";
import {
  PlatformMobileBar,
  PlatformSidebar,
  usePlatformNav,
} from "@/components/PlatformSidebar";

function Shell({ children }: { children: React.ReactNode }) {
  const { loading, admin } = usePlatformAuth();
  const { open, setOpen } = usePlatformNav();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-[var(--muted)]">
        Loading platform session…
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-[var(--muted)]">
        Redirecting to admin login…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface)]">
      <PlatformSidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PlatformMobileBar onOpen={() => setOpen(true)} />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
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
