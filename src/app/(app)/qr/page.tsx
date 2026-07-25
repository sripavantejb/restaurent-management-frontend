"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

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

interface TableRow {
  id: string;
  number: number;
  capacity: number;
  status: string;
  qrCode: { id: string } | null;
}

type Filter = "all" | "active" | "inactive" | "missing";

export default function QrPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const [codes, setCodes] = useState<QrCodeRow[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [toast, setToast] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      const [qrData, tableData] = await Promise.all([
        apiFetch("/api/qr", { branchId: activeBranchId }),
        apiFetch("/api/tables", { branchId: activeBranchId }),
      ]);
      setCodes(qrData.codes ?? []);
      setTables(
        ((tableData.tables as TableRow[]) ?? [])
          .slice()
          .sort((a, b) => a.number - b.number)
      );
      setSelected(new Set());
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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const missingTables = useMemo(
    () => tables.filter((t) => !t.qrCode),
    [tables]
  );

  const filteredCodes = useMemo(() => {
    if (filter === "active") return codes.filter((c) => c.isActive);
    if (filter === "inactive") return codes.filter((c) => !c.isActive);
    return codes;
  }, [codes, filter]);

  const selectedVisible = useMemo(
    () => filteredCodes.filter((c) => selected.has(c.id)),
    [filteredCodes, selected]
  );

  const allVisibleSelected =
    filteredCodes.length > 0 &&
    filteredCodes.every((c) => selected.has(c.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const c of filteredCodes) next.delete(c.id);
      } else {
        for (const c of filteredCodes) next.add(c.id);
      }
      return next;
    });
  }

  async function deleteCodes(ids: string[], hard: boolean) {
    if (ids.length === 0) return;
    const labels = codes
      .filter((c) => ids.includes(c.id))
      .map((c) => c.label)
      .join(", ");
    const message = hard
      ? `Permanently delete ${ids.length === 1 ? labels : `${ids.length} QR codes`}?\n\nPrinted tent cards for these tables will stop working.`
      : `Deactivate ${ids.length === 1 ? labels : `${ids.length} QR codes`}?\n\nGuests scanning printed codes will need a new one after you regenerate.`;
    if (!confirm(message)) return;

    setBusy(true);
    setBusyId(ids.length === 1 ? ids[0] : "bulk");
    try {
      await apiFetch("/api/qr", {
        method: "DELETE",
        branchId: activeBranchId,
        body: JSON.stringify({
          ids,
          hard,
        }),
      });
      showToast(
        hard
          ? `Deleted ${ids.length} QR code${ids.length === 1 ? "" : "s"}`
          : `Deactivated ${ids.length} QR code${ids.length === 1 ? "" : "s"}`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
      setBusyId("");
    }
  }

  async function generateForTables(tableIds: string[]) {
    if (!activeBranchId || tableIds.length === 0) return;
    setBusy(true);
    try {
      const data = await apiFetch("/api/qr", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({
          tableIds,
          designId: "classic",
          fg: "#12100E",
          bg: "#FFFFFF",
          printSizeCm: 4,
        }),
      });
      const n = (data.created ?? []).length;
      showToast(`Generated ${n} QR code${n === 1 ? "" : "s"}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  if (!hasPermission("qr.manage")) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">QR codes</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          You need QR manage access. Ask an owner or manager to grant it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
            Guest ordering
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">QR codes</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Generate codes for tables, then delete ones you no longer need.
            Print from the print layout.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toast ? (
            <span className="rounded-[6px] bg-[var(--success)]/15 px-3 py-1 text-sm text-[var(--success)]">
              {toast}
            </span>
          ) : null}
          <Link href="/qr/generate">
            <Button>Generate QR</Button>
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
        <p className="bg-red-50 px-4 py-2 text-sm text-red-800 sm:px-6">
          {error}. Refresh or check your branch selection.
        </p>
      ) : null}

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {missingTables.length > 0 ? (
          <section className="mb-6 rounded-[6px] border border-[var(--border)] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">
                  Tables without a QR · {missingTables.length}
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {missingTables
                    .slice(0, 12)
                    .map((t) => `T${t.number}`)
                    .join(", ")}
                  {missingTables.length > 12
                    ? ` +${missingTables.length - 12} more`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void generateForTables(missingTables.map((t) => t.id))
                  }
                >
                  Generate all missing
                </Button>
                <Link href="/qr/generate">
                  <Button size="sm" variant="secondary">
                    Pick tables…
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", `All (${codes.length})`],
                ["active", `Active (${codes.filter((c) => c.isActive).length})`],
                [
                  "inactive",
                  `Inactive (${codes.filter((c) => !c.isActive).length})`,
                ],
                ["missing", `No QR (${missingTables.length})`],
              ] as const
            ).map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`h-9 rounded-[6px] px-3 text-xs font-medium ${
                  filter === key
                    ? "bg-[var(--ink)] text-white"
                    : "border border-[var(--border)] bg-white text-[var(--muted)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {text}
              </button>
            ))}
          </div>

          {filter !== "missing" && filteredCodes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  className="h-4 w-4"
                />
                Select all
              </label>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || selectedVisible.length === 0}
                onClick={() =>
                  void deleteCodes(
                    selectedVisible.map((c) => c.id),
                    false
                  )
                }
              >
                Deactivate selected
                {selectedVisible.length ? ` (${selectedVisible.length})` : ""}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busy || selectedVisible.length === 0}
                onClick={() =>
                  void deleteCodes(
                    selectedVisible.map((c) => c.id),
                    true
                  )
                }
              >
                Delete selected
                {selectedVisible.length ? ` (${selectedVisible.length})` : ""}
              </Button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-2" role="status" aria-label="Loading">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="ros-skeleton h-14 w-full rounded-[6px]"
              />
            ))}
          </div>
        ) : filter === "missing" ? (
          missingTables.length === 0 ? (
            <p className="rounded-[6px] border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
              Every table already has an active QR.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-[6px] border border-[var(--border)] bg-white">
              {missingTables.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <p className="num font-semibold">Table {t.number}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {t.capacity} seats · no QR yet
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void generateForTables([t.id])}
                  >
                    Generate QR
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : filteredCodes.length === 0 ? (
          <div className="rounded-[6px] border border-dashed border-[var(--border)] p-10 text-center">
            <p className="text-sm text-[var(--muted)]">
              {codes.length === 0
                ? "No QR codes yet. Generate codes for your tables, then print tent cards."
                : "Nothing in this filter."}
            </p>
            {codes.length === 0 ? (
              <Link href="/qr/generate" className="mt-4 inline-block">
                <Button>Generate table codes</Button>
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCodes.map((c) => {
              const checked = selected.has(c.id);
              return (
                <article
                  key={c.id}
                  className={`rounded-[6px] border bg-white p-4 ${
                    checked
                      ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
                      : "border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(c.id)}
                      className="mt-1 h-4 w-4 shrink-0"
                      aria-label={`Select ${c.label}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-semibold text-[var(--ink)]">
                          {c.label}
                        </h2>
                        <span
                          className={
                            c.isActive
                              ? "rounded-[6px] bg-[var(--success)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--success)]"
                              : "rounded-[6px] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]"
                          }
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
                      <div className="mt-3 flex flex-wrap gap-2">
                        {c.isActive ? (
                          <a
                            href={c.shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center rounded-[6px] border border-[var(--border)] px-3 text-xs font-medium hover:bg-[var(--surface-2)]"
                          >
                            Test scan
                          </a>
                        ) : null}
                        {c.isActive ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy && busyId === c.id}
                            onClick={() => void deleteCodes([c.id], false)}
                          >
                            Deactivate
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy && (busyId === c.id || busyId === "bulk")}
                          onClick={() => void deleteCodes([c.id], true)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
