import type { HTMLAttributes } from "react";

/** Base shimmer block — use for custom layouts. */
export function Skeleton({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`ros-skeleton rounded-[6px] ${className}`}
      aria-hidden
      {...rest}
    />
  );
}

/** Full-screen shell while auth/session boots (includes faux sidebar). */
export function SessionSkeleton() {
  return (
    <div
      className="flex min-h-screen bg-[var(--surface)]"
      role="status"
      aria-label="Loading"
    >
      <aside className="hidden w-56 shrink-0 space-y-3 border-r border-[var(--border)] p-4 lg:block">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-6 h-4 w-20" />
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center gap-3 border-b border-[var(--border)] px-4 lg:hidden">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-5 w-40" />
        </div>
        <ConsolePageSkeleton />
      </div>
    </div>
  );
}

/** In-page content skeleton (title + KPI cards + table). */
export function ConsolePageSkeleton() {
  return (
    <div className="space-y-5 p-4 sm:p-6 md:p-8" role="status" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 sm:w-64" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="space-y-2 rounded-[6px] border border-[var(--border)] p-3">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Dense list / table pages. */
export function TablePageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4 p-4 sm:p-6 md:p-8" role="status" aria-label="Loading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="space-y-2 sm:hidden">
        {Array.from({ length: Math.min(rows, 5) }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-[6px] border border-[var(--border)] sm:block">
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <div className="flex gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="space-y-0">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 border-b border-[var(--border)] px-4 py-3 last:border-0"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Detail / two-column pages. */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-5 p-4 sm:p-6 md:p-8" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-28" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

/** POS / split-pane ops screens. */
export function SplitPaneSkeleton() {
  return (
    <div
      className="grid h-full min-h-[70vh] gap-3 p-3 lg:grid-cols-2"
      role="status"
      aria-label="Loading"
    >
      <div className="space-y-3 rounded-[6px] border border-[var(--border)] p-3">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
      <div className="space-y-3 rounded-[6px] border border-[var(--border)] p-3">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
        <Skeleton className="mt-auto h-12 w-full" />
      </div>
    </div>
  );
}

/** Waiter floor. */
export function FloorSkeleton() {
  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--surface)]" role="status" aria-label="Loading">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--ink)] px-4 py-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 bg-[var(--muted)]/40" />
          <Skeleton className="h-5 w-40 bg-white/20" />
        </div>
        <Skeleton className="h-9 w-20 bg-white/20" />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Guest QR ordering shell. */
export function GuestSkeleton() {
  return (
    <div
      className="mx-auto min-h-[100dvh] max-w-lg space-y-4 bg-[var(--surface)] p-4"
      role="status"
      aria-label="Loading"
    >
      <Skeleton className="h-16 w-full" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 shrink-0" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-[70%]" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[45%]" />
          </div>
          <Skeleton className="h-10 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** KDS board columns. */
export function KdsSkeleton() {
  return (
    <div className="grid h-full gap-3 p-3 md:grid-cols-3" role="status" aria-label="Loading">
      {Array.from({ length: 3 }).map((_, col) => (
        <div key={col} className="space-y-2 rounded-[6px] border border-[var(--border)] p-2">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
