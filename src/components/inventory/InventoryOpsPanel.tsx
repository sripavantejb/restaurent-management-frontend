"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/money";

/** Counts, reports, labels, warehouses — PRD ops panel */
export function InventoryOpsPanel({
  branchId,
  canEdit,
  items,
  mode,
}: {
  branchId: string | null;
  canEdit: boolean;
  items: { id: string; name: string; quantityOnHand: number; unit: string }[];
  mode: "counts" | "reports" | "labels" | "warehouses";
}) {
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [counts, setCounts] = useState<
    {
      id: string;
      countNumber: string;
      status: string;
      cycle: boolean;
      varianceTotal: number;
    }[]
  >([]);
  const [countLines, setCountLines] = useState<
    Record<string, string>
  >({});
  const [dead, setDead] = useState<
    { name: string; qty: number; unit: string; valuePaise: number }[]
  >([]);
  const [over, setOver] = useState<
    { name: string; qty: number; maxStock: number; excess: number }[]
  >([]);
  const [labels, setLabels] = useState<
    {
      id: string;
      name: string;
      sku: string;
      barcode: string;
      qrPayload: string;
      unit: string;
    }[]
  >([]);
  const [warehouses, setWarehouses] = useState<
    { id: string; name: string; code: string; isDefault: boolean }[]
  >([]);
  const [whForm, setWhForm] = useState({ name: "", code: "" });
  const [prices, setPrices] = useState<
    { item: string; supplier: string; unitCostPaise: number; recordedAt: string }[]
  >([]);
  const [returnForm, setReturnForm] = useState({
    inventoryItemId: "",
    qty: "1",
  });

  const tip = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };

  const load = useCallback(async () => {
    if (!branchId) return;
    try {
      if (mode === "counts") {
        const d = await apiFetch("/api/inventory/counts", { branchId });
        setCounts(d.counts);
      }
      if (mode === "reports") {
        const [d1, d2, d3] = await Promise.all([
          apiFetch("/api/inventory/reports?report=dead", { branchId }),
          apiFetch("/api/inventory/reports?report=overstock", { branchId }),
          apiFetch("/api/inventory/reports?report=prices", { branchId }),
        ]);
        setDead(d1.deadStock);
        setOver(d2.overstock);
        setPrices(d3.prices);
      }
      if (mode === "labels") {
        const d = await apiFetch("/api/inventory/reports?report=labels", {
          branchId,
        });
        setLabels(d.labels);
      }
      if (mode === "warehouses") {
        const d = await apiFetch("/api/inventory/reports?report=warehouses", {
          branchId,
        });
        setWarehouses(d.warehouses);
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [branchId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {error}
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {toast ? (
        <p className="text-sm text-[var(--success)]">{toast}</p>
      ) : null}

      {mode === "counts" ? (
        <>
          {canEdit ? (
            <div className="rounded-[6px] border border-[var(--border)] p-3">
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                Physical / cycle count
              </p>
              <div className="mt-2 max-h-48 space-y-2 overflow-auto">
                {items.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {i.name}{" "}
                      <span className="text-[var(--muted)]">
                        (sys {i.quantityOnHand})
                      </span>
                    </span>
                    <Input
                      className="w-24"
                      placeholder="Count"
                      value={countLines[i.id] ?? ""}
                      onChange={(e) =>
                        setCountLines((p) => ({
                          ...p,
                          [i.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    const lines = Object.entries(countLines)
                      .filter(([, v]) => v !== "")
                      .map(([inventoryItemId, v]) => ({
                        inventoryItemId,
                        countedQty: Number(v),
                      }));
                    if (!lines.length) return;
                    await apiFetch("/api/inventory/counts", {
                      method: "POST",
                      branchId,
                      body: JSON.stringify({
                        action: "create",
                        cycle: lines.length < items.length,
                        lines,
                      }),
                    });
                    setCountLines({});
                    tip("Count saved — reconcile when ready");
                    await load();
                  }}
                >
                  Save count
                </Button>
              </div>
            </div>
          ) : null}
          <ul className="space-y-2">
            {counts.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[var(--border)] p-3 text-sm"
              >
                <span>
                  {c.countNumber} · {c.status}
                  {c.cycle ? " · cycle" : ""} · |var|{" "}
                  {c.varianceTotal}
                </span>
                {canEdit && c.status === "OPEN" ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await apiFetch("/api/inventory/counts", {
                        method: "POST",
                        branchId,
                        body: JSON.stringify({
                          action: "reconcile",
                          countId: c.id,
                        }),
                      });
                      tip("Reconciled to ledger");
                      await load();
                    }}
                  >
                    Reconcile
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {mode === "reports" ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const res = await fetch("/api/inventory/reports?report=export", {
                  credentials: "include",
                  headers: branchId ? { "x-branch-id": branchId } : {},
                });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "inventory.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export CSV
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[6px] border border-[var(--border)] p-3">
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                Dead stock (30d)
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {dead.length === 0 ? (
                  <li className="text-[var(--muted)]">None</li>
                ) : (
                  dead.map((d) => (
                    <li key={d.name}>
                      {d.name}: {d.qty} {d.unit} · {formatMoney(d.valuePaise)}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="rounded-[6px] border border-[var(--border)] p-3">
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                Overstock
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {over.length === 0 ? (
                  <li className="text-[var(--muted)]">None</li>
                ) : (
                  over.map((d) => (
                    <li key={d.name}>
                      {d.name}: {d.qty} / max {d.maxStock} (+{d.excess})
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
          <div className="rounded-[6px] border border-[var(--border)] p-3">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Supplier price history
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">
              {prices.map((p, i) => (
                <li key={i}>
                  {p.item} · {p.supplier} · {formatMoney(p.unitCostPaise)} ·{" "}
                  {p.recordedAt
                    ? new Date(p.recordedAt).toLocaleDateString("en-IN")
                    : ""}
                </li>
              ))}
            </ul>
          </div>
          {canEdit ? (
            <div className="rounded-[6px] border border-[var(--border)] p-3">
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                Purchase return
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  className="h-10 rounded-[6px] border border-[var(--border)] px-2 text-sm"
                  value={returnForm.inventoryItemId}
                  onChange={(e) =>
                    setReturnForm({
                      ...returnForm,
                      inventoryItemId: e.target.value,
                    })
                  }
                >
                  <option value="">Item</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <Input
                  className="w-24"
                  value={returnForm.qty}
                  onChange={(e) =>
                    setReturnForm({ ...returnForm, qty: e.target.value })
                  }
                />
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    await apiFetch("/api/inventory/reports", {
                      method: "POST",
                      branchId,
                      body: JSON.stringify({
                        action: "return",
                        inventoryItemId: returnForm.inventoryItemId,
                        qty: Number(returnForm.qty),
                      }),
                    });
                    tip("Return posted to ledger");
                  }}
                >
                  Return to supplier
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {mode === "labels" ? (
        <div>
          <Button
            size="sm"
            className="mb-3"
            onClick={() => window.print()}
          >
            Print labels
          </Button>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
            {labels.map((l) => (
              <div
                key={l.id}
                className="rounded-[6px] border border-[var(--border)] p-3 text-center"
              >
                <p className="font-semibold">{l.name}</p>
                <p className="mt-1 font-mono text-xs">{l.barcode || l.sku}</p>
                <p className="mt-2 break-all font-mono text-[10px] text-[var(--muted)]">
                  {l.qrPayload}
                </p>
                <p className="mt-1 text-[10px] text-[var(--muted)]">{l.unit}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {mode === "warehouses" ? (
        <>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Name"
                value={whForm.name}
                onChange={(e) =>
                  setWhForm({ ...whForm, name: e.target.value })
                }
              />
              <Input
                placeholder="Code"
                value={whForm.code}
                onChange={(e) =>
                  setWhForm({ ...whForm, code: e.target.value })
                }
              />
              <Button
                size="sm"
                onClick={async () => {
                  await apiFetch("/api/inventory/reports", {
                    method: "POST",
                    branchId,
                    body: JSON.stringify({
                      action: "warehouse",
                      ...whForm,
                    }),
                  });
                  setWhForm({ name: "", code: "" });
                  tip("Warehouse created");
                  await load();
                }}
              >
                Add warehouse
              </Button>
            </div>
          ) : null}
          <ul className="space-y-2">
            {warehouses.map((w) => (
              <li
                key={w.id}
                className="rounded-[6px] border border-[var(--border)] px-3 py-2 text-sm"
              >
                <span className="font-medium">{w.name}</span>
                <span className="ml-2 text-[var(--muted)]">{w.code}</span>
                {w.isDefault ? (
                  <span className="ml-2 text-xs text-[var(--accent)]">
                    default
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
