"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";

interface Analytics {
  scansPerDay: Record<string, number>;
  conversionRate: number;
  avgScanToItemMs: number | null;
  zeroScanTables: { id: string; label: string; tableId?: string }[];
  totalScans: number;
}

export default function QrAnalyticsPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/qr?analytics=1", { branchId: activeBranchId });
      setData(res as Analytics);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.scansPerDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count }));
  }, [data]);

  const maxDay = Math.max(1, ...days.map((d) => d.count));

  if (!hasPermission("qr.manage")) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">QR analytics</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Missing <code>qr.manage</code> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <div>
          <Link href="/qr" className="text-xs text-[var(--muted)] hover:text-[var(--ink)]">
            ← QR codes
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-[var(--muted)]">Last 7 days</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </header>

      {error ? (
        <p className="bg-red-50 px-6 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {loading || !data ? (
          <p className="text-sm text-[var(--muted)]">Loading analytics…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[6px] border border-[var(--border)] bg-white p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  Conversion
                </p>
                <p className="num mt-1 text-3xl font-semibold tracking-tight">
                  {data.conversionRate}%
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Scans that placed an order
                </p>
              </div>
              <div className="rounded-[6px] border border-[var(--border)] bg-white p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  Total scans
                </p>
                <p className="num mt-1 text-3xl font-semibold tracking-tight">
                  {data.totalScans}
                </p>
              </div>
              <div className="rounded-[6px] border border-[var(--border)] bg-white p-4">
                <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  Avg scan → item
                </p>
                <p className="num mt-1 text-3xl font-semibold tracking-tight">
                  {data.avgScanToItemMs != null
                    ? `${Math.round(data.avgScanToItemMs / 1000)}s`
                    : "—"}
                </p>
              </div>
            </div>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                Scans per day
              </h2>
              {days.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No scans yet this week. Share a test scan link from the QR list.
                </p>
              ) : (
                <div className="space-y-2 rounded-[6px] border border-[var(--border)] bg-white p-4">
                  {days.map(({ day, count }) => (
                    <div key={day} className="flex items-center gap-3">
                      <span className="num w-24 shrink-0 text-xs text-[var(--muted)]">
                        {day}
                      </span>
                      <div className="h-6 flex-1 overflow-hidden rounded-[4px] bg-[var(--surface-2)]">
                        <div
                          className="h-full bg-[var(--accent)]"
                          style={{ width: `${(count / maxDay) * 100}%` }}
                        />
                      </div>
                      <span className="num w-8 text-right text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                Zero-scan tables (7d)
              </h2>
              {data.zeroScanTables.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Every printed code got at least one scan — nice.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.zeroScanTables.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-[6px] border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    >
                      {t.label}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
