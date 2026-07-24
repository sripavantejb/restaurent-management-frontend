"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface TableRow {
  id: string;
  number: number;
  capacity: number;
  status: string;
}

interface CreatedCode {
  id: string;
  shortCode: string;
  label: string;
  shortUrl: string;
  tableNumber: number;
  svg: string;
}

export default function QrGeneratePage() {
  const { activeBranchId, hasPermission } = useAuth();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fg, setFg] = useState("#12100E");
  const [bg, setBg] = useState("#FFFFFF");
  const [printSizeCm, setPrintSizeCm] = useState(4);
  const [includeWifi, setIncludeWifi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [created, setCreated] = useState<CreatedCode[]>([]);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const data = await apiFetch("/api/tables", { branchId: activeBranchId });
      const list = (data.tables as TableRow[]).slice().sort((a, b) => a.number - b.number);
      setTables(list);
      setSelected(new Set(list.map((t) => t.id)));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tables");
    }
  }, [activeBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected = tables.length > 0 && selected.size === tables.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(tables.map((t) => t.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  async function generate() {
    if (!activeBranchId || selected.size === 0) return;
    setBusy(true);
    setError("");
    setWarnings([]);
    setCreated([]);
    setProgress(`Generating ${selected.size} code${selected.size === 1 ? "" : "s"}…`);
    try {
      const data = await apiFetch("/api/qr", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({
          tableIds: [...selected],
          fg,
          bg,
          printSizeCm,
          includeWifi,
          designId: "classic",
        }),
      });
      setCreated(data.created ?? []);
      setWarnings(data.warnings ?? []);
      setProgress(`Created ${(data.created ?? []).length} codes.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  const firstSvg = useMemo(() => created[0]?.svg ?? "", [created]);

  if (!hasPermission("qr.manage")) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Generate QR</h1>
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
          <h1 className="text-2xl font-semibold tracking-tight">Generate</h1>
        </div>
      </header>

      <div className="grid flex-1 gap-6 overflow-auto p-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Tables ({selected.size}/{tables.length})
            </h2>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                All
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={selectNone}>
                None
              </Button>
            </div>
          </div>
          <div className="max-h-[420px] space-y-1 overflow-auto rounded-[6px] border border-[var(--border)] bg-white p-2">
            {tables.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-3 rounded-[6px] px-2 py-2 hover:bg-[var(--surface-2)]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                  className="h-4 w-4"
                />
                <span className="num font-medium">Table {t.number}</span>
                <span className="text-xs text-[var(--muted)]">
                  · {t.capacity} seats · {t.status}
                </span>
              </label>
            ))}
            {tables.length === 0 ? (
              <p className="p-3 text-sm text-[var(--muted)]">
                No tables on this branch. Add tables first.
              </p>
            ) : null}
          </div>

          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Design (contrast-safe defaults)
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--muted)]">
                Foreground
                <Input
                  type="color"
                  value={fg}
                  onChange={(e) => setFg(e.target.value)}
                  className="mt-1 h-10 w-full"
                />
              </label>
              <label className="text-xs text-[var(--muted)]">
                Background
                <Input
                  type="color"
                  value={bg}
                  onChange={(e) => setBg(e.target.value)}
                  className="mt-1 h-10 w-full"
                />
              </label>
            </div>
            <label className="block text-xs text-[var(--muted)]">
              Print size (cm)
              <Input
                type="number"
                min={2}
                max={10}
                step={0.5}
                value={printSizeCm}
                onChange={(e) => setPrintSizeCm(Number(e.target.value))}
                className="mt-1"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeWifi}
                onChange={(e) => setIncludeWifi(e.target.checked)}
              />
              Include Wi‑Fi credentials on code metadata
            </label>
            <p className="text-xs text-[var(--muted)]">
              Dark on light only. Contrast must be ≥ 4:1 so older phone cameras can read the code.
              {!allSelected && selected.size > 0
                ? ` Generating for ${selected.size} selected tables.`
                : null}
            </p>
          </div>

          {error ? (
            <p className="mt-4 text-sm text-red-700">{error}</p>
          ) : null}
          {progress ? (
            <p className="mt-2 text-sm text-[var(--success)]">{progress}</p>
          ) : null}
          {warnings.map((w) => (
            <p key={w} className="mt-1 text-sm text-[var(--warn)]">
              {w}
            </p>
          ))}

          <Button
            type="button"
            className="mt-4"
            disabled={busy || selected.size === 0}
            onClick={() => void generate()}
          >
            {busy ? "Generating…" : `Generate ${selected.size || ""} codes`}
          </Button>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Preview & short URLs
          </h2>
          {created.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Generated codes appear here with short URLs ready to print.
            </p>
          ) : (
            <>
              {firstSvg ? (
                <div
                  className="mb-4 inline-block rounded-[6px] border border-[var(--border)] bg-white p-4"
                  dangerouslySetInnerHTML={{ __html: firstSvg }}
                />
              ) : null}
              <ul className="space-y-2">
                {created.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-[6px] border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{c.label}</span>
                    <a
                      href={c.shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block break-all font-mono text-xs text-[var(--accent)]"
                    >
                      {c.shortUrl}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <Link href="/qr/print">
                  <Button>Open print layout</Button>
                </Link>
                <Link href="/qr">
                  <Button variant="secondary">Back to list</Button>
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
