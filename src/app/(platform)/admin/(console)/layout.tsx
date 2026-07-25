"use client";

import { PlatformAuthProvider, usePlatformAuth } from "@/components/PlatformAuthProvider";
import {
  PlatformMobileBar,
  PlatformSidebar,
  usePlatformNav,
} from "@/components/PlatformSidebar";
import { SessionSkeleton, Skeleton } from "@/components/ui/Skeleton";

function Shell({ children }: { children: React.ReactNode }) {
  const { loading, admin } = usePlatformAuth();
  const { open, setOpen } = usePlatformNav();

  if (loading) {
    return <SessionSkeleton />;
  }

  if (!admin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--surface)] px-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3 w-52" />
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
