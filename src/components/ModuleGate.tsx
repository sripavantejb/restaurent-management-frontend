"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { MODULE_LABELS, moduleForPath } from "@/lib/platform/modules";

export function ModuleGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isPathModuleEnabled } = useAuth();
  const moduleId = moduleForPath(pathname);

  if (moduleId && !isPathModuleEnabled(pathname)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-lg font-semibold text-[var(--ink)]">
          {MODULE_LABELS[moduleId]} is disabled
        </p>
        <p className="max-w-md text-sm text-[var(--muted)]">
          This module is turned off for your restaurant. Contact the platform
          admin to enable it.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
