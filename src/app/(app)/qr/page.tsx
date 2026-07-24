"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";

interface QrCodeRow {
  id: string;
  shortCode: string;
  label: string;
  isActive: boolean;
  scanCount: number;
  uniqueScanCount: number;
  lastScannedAt: string | null;
  shortUrl: string;
  tableId: string | null;
}

export default function QrPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const [codes, setCodes] = useState<QrCodeRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      const data = await apiFetch("/api/qr", { branchId: activeBranchId });
      setCodes(data.codes ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load QR codes");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hasPermission("qr.manage")) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight">QR codes</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          You need the <code className="text-[var(--ink)]">qr.manage</code> permission.
          Ask an owner or manager to grant access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
            Guest ordering
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">QR codes</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Turn customer QR ordering on/off in{" "}
            <Link href="/settings" className="text-[var(--accent)] underline">
              Settings
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/qr/generate">
            <Button>Generate</Button>
          </Link>
          <Link href="/qr/print">
            <Button variant="secondary">Print</Button>
          </Link>
          <Link href="/qr/analytics">
            <Button variant="secondary">Analytics</Button>
          </Link>
        </div>
      </header>

      {error ? (
        <p className="bg-red-50 px-6 py-2 text-sm text-red-800">
          {error}. Refresh or check your branch selection.
        </p>
      ) : null}

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading codes…</p>
        ) : codes.length === 0 ? (
          <div className="rounded-[6px] border border-dashed border-[var(--border)] p-10 text-center">
            <p className="text-sm text-[var(--muted)]">
              No QR codes yet. Generate codes for your tables, then print tent cards.
            </p>
            <Link href="/qr/generate" className="mt-4 inline-block">
              <Button>Generate table codes</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {codes.map((c) => (
              <article
                key={c.id}
                className="rounded-[6px] border border-[var(--border)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-[var(--ink)]">{c.label}</h2>
                  <span
                    className={`rounded-[6px] px-2 py-0.5 text-[11px] font-medium ${
                      c.isActive
                        ? "bg-[var(--success)]/15 text-[var(--success)]"
                        : "bg-[var(--surface-2)] text-[var(--muted)]"
                    }`}
                  >
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-2 break-all font-mono text-xs text-[var(--muted)]">
                  {c.shortUrl}
                </p>
                <p className="num mt-3 text-sm text-[var(--muted)]">
                  {c.scanCount} scans · {c.uniqueScanCount} unique
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Last scan{" "}
                  {c.lastScannedAt
                    ? new Date(c.lastScannedAt).toLocaleString("en-IN")
                    : "never"}
                </p>
                <div className="mt-3 flex gap-2">
                  <a
                    href={c.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center rounded-[6px] border border-[var(--border)] px-3 text-xs font-medium hover:bg-[var(--surface-2)]"
                  >
                    Test scan
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
