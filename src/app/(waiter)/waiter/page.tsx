"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Bell } from "lucide-react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import {
  ServiceRequestInbox,
  type ServiceReq,
} from "@/components/ServiceRequestInbox";
import { formatMoney } from "@/lib/money";
import {
  ORDER_STATUS_LABEL,
  SERVICE_TYPE_LABEL,
  SESSION_STATUS_LABEL,
  TABLE_STATUS_LABEL,
  label,
} from "@/lib/labels";
import { ApprovalQueue } from "@/components/ApprovalQueue";
import { FloorSkeleton } from "@/components/ui/Skeleton";

interface TableRow {
  id: string;
  number: number;
  status: string;
  capacity: number;
  shape: string;
  x: number;
  y: number;
  currentSession: {
    id: string;
    status: string;
    rounds: number;
    total: number;
    dueAmount: number;
  } | null;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  variants: { name: string; priceDelta: number }[];
  addons: { name: string; price: number }[];
}

interface Category {
  id: string;
  name: string;
}

interface Line {
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  variant: string;
  addons: string[];
  notes: string;
  isVeg: boolean;
}

interface TableOrder {
  id: string;
  orderNumber: string;
  status: string;
  roundNumber: number | null;
  total: number;
  items: { name: string; qty: number }[];
}

type Tab = "floor" | "order" | "status" | "calls";

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "#2A9D8F",
  FREE: "#2A9D8F",
  OCCUPIED: "#E9C46A",
  PREPARING_BILL: "#3B82F6",
  BILLED: "#3B82F6",
  CLEANING: "#A78BFA",
  RESERVED: "#6B6560",
  BLOCKED: "#EF4444",
  OUT_OF_SERVICE: "#9CA3AF",
};

export default function WaiterFloorPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selected, setSelected] = useState<TableRow | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [tableOrders, setTableOrders] = useState<TableOrder[]>([]);
  const [catId, setCatId] = useState("all");
  const [tab, setTab] = useState<Tab>("floor");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [openCalls, setOpenCalls] = useState(0);
  const [alertFlash, setAlertFlash] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const seenCallsRef = useRef<Set<string>>(new Set());
  const callsPrimedRef = useRef(false);

  const canOrder =
    hasPermission("waiter.floor") || hasPermission("orders.create");

  const beep = useCallback(() => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      /* ignore */
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  };

  const pollCalls = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const data = await apiFetch("/api/service-requests?status=active", {
        branchId: activeBranchId,
      });
      const next = (data.requests ?? []) as ServiceReq[];
      setOpenCalls(next.filter((r) => r.status === "OPEN").length);
      if (callsPrimedRef.current) {
        for (const r of next) {
          if (r.status === "OPEN" && !seenCallsRef.current.has(r.id)) {
            beep();
            setAlertFlash(true);
            setTimeout(() => setAlertFlash(false), 1200);
            showToast(
              `Table ${r.tableNumber ?? "?"} · ${label(SERVICE_TYPE_LABEL, r.type)}`
            );
            setTab("calls");
          }
        }
      }
      for (const r of next) seenCallsRef.current.add(r.id);
      callsPrimedRef.current = true;
    } catch {
      /* ignore transient */
    }
  }, [activeBranchId, beep]);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const [tbl, menu] = await Promise.all([
        apiFetch("/api/tables", { branchId: activeBranchId }),
        apiFetch("/api/menu", { branchId: activeBranchId }),
      ]);
      setTables(
        (tbl.tables as TableRow[]).slice().sort((a, b) => a.number - b.number)
      );
      setCategories(menu.categories);
      setItems(menu.items);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load floor");
    } finally {
      setReady(true);
    }
  }, [activeBranchId]);

  const loadTableOrders = useCallback(
    async (tableId: string) => {
      if (!activeBranchId) return;
      try {
        const data = await apiFetch("/api/orders?status=active", {
          branchId: activeBranchId,
        });
        const rows = (data.orders as (TableOrder & { tableId?: string })[])
          .filter((o) => o.tableId === tableId)
          .map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            roundNumber: o.roundNumber,
            total: o.total,
            items: o.items,
          }));
        setTableOrders(rows);
      } catch {
        setTableOrders([]);
      }
    },
    [activeBranchId]
  );

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    void pollCalls();
    const t = setInterval(() => void pollCalls(), 2000);
    return () => clearInterval(t);
  }, [pollCalls]);

  useEffect(() => {
    if (!selected) {
      setTableOrders([]);
      return;
    }
    const next = tables.find((t) => t.id === selected.id);
    if (next) setSelected(next);
    void loadTableOrders(selected.id);
    const t = setInterval(() => void loadTableOrders(selected.id), 3000);
    return () => clearInterval(t);
  }, [tables, selected?.id, loadTableOrders]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (catId !== "all" && it.categoryId !== catId) return false;
      return it.isAvailable;
    });
  }, [items, catId]);

  const cartTotal = useMemo(
    () => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0),
    [lines]
  );

  function selectTable(t: TableRow) {
    setSelected(t);
    setLines([]);
    setTab("order");
  }

  const maxX = Math.max(...tables.map((t) => t.x), 400) + 140;
  const maxY = Math.max(...tables.map((t) => t.y), 300) + 120;

  function addItem(item: MenuItem) {
    const variant = item.variants?.[0]?.name ?? "";
    const delta =
      item.variants?.find((v) => v.name === variant)?.priceDelta ?? 0;
    const unitPrice = item.price + delta;
    setLines((prev) => {
      const idx = prev.findIndex(
        (l) => l.menuItemId === item.id && l.variant === variant && !l.notes
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          qty: 1,
          unitPrice,
          variant,
          addons: [],
          notes: "",
          isVeg: item.isVeg,
        },
      ];
    });
  }

  async function sendOrder() {
    if (!selected || !lines.length) return;
    setBusy(true);
    try {
      await apiFetch("/api/orders", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({
          type: "DINE_IN",
          tableId: selected.id,
          source: "WAITER",
          items: lines.map((l) => ({
            menuItemId: l.menuItemId,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            variant: l.variant,
            addons: l.addons,
            notes: l.notes,
          })),
        }),
      });
      setLines([]);
      showToast(`Sent to kitchen · Table ${selected.number}`);
      setTab("status");
      await load();
      await loadTableOrders(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setBusy(false);
    }
  }

  async function collectBill() {
    if (!selected?.currentSession) return;
    if (
      !confirm(
        `Collect ${formatMoney(selected.currentSession.dueAmount)} for Table ${selected.number}? Table frees; same QR stays valid.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/payments", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({
          sessionId: selected.currentSession.id,
          method: "UPI",
        }),
      });
      showToast(`Bill paid · Table ${selected.number} ready for next guests`);
      setLines([]);
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Collect failed");
    } finally {
      setBusy(false);
    }
  }

  function handleSelectFromCall(tableId: string) {
    const t = tables.find((x) => x.id === tableId);
    if (t) {
      selectTable(t);
      setTab("order");
    }
  }

  if (!canOrder) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Waiter floor</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          You need waiter floor access. Ask a manager.
        </p>
      </div>
    );
  }

  if (!ready) return <FloorSkeleton />;

  return (
    <div
      className={`flex h-full flex-col overflow-hidden ${
        alertFlash ? "ring-4 ring-inset ring-[var(--accent)]" : ""
      }`}
    >
      {toast ? (
        <div className="flex items-center gap-2 border-b border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-2 text-sm text-[var(--ink)]">
          <Bell size={16} className="text-[var(--accent)]" />
          {toast}
        </div>
      ) : null}

      {error ? (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] p-2">
            {(
              [
                ["floor", "Floor plan"],
                ["order", "Take order"],
                ["status", "Order status"],
                ["calls", openCalls > 0 ? `Calls (${openCalls})` : "Calls"],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`h-9 rounded-[6px] px-3 text-sm font-medium ${
                  tab === id
                    ? "bg-[var(--ink)] text-white"
                    : "border border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {text}
              </button>
            ))}
            {selected ? (
              <span className="ml-auto num text-sm font-semibold text-[var(--muted)]">
                T{selected.number}
              </span>
            ) : null}
          </div>

          {tab === "floor" ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex flex-wrap gap-3 border-b border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted)]">
                {Object.entries(STATUS_COLOR)
                  .filter(([k]) => !["FREE", "BILLED"].includes(k))
                  .map(([k, c]) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: c }}
                    />
                    {label(TABLE_STATUS_LABEL, k)}
                  </span>
                ))}
                <span className="text-[var(--muted)]">
                  Tap a table to take an order
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-2)] p-4">
                {tables.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No tables on this branch yet.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:hidden">
                      {[...tables]
                        .sort((a, b) => a.number - b.number)
                        .map((t) => {
                          const billDue =
                            t.currentSession?.status === "BILL_REQUESTED";
                          const selectedHere = selected?.id === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => selectTable(t)}
                              className={`flex min-h-[72px] flex-col items-center justify-center rounded-[6px] border-2 bg-white p-2 text-sm font-medium ${
                                selectedHere
                                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                                  : "border-[var(--border)]"
                              }`}
                              style={{
                                borderColor: selectedHere
                                  ? undefined
                                  : billDue
                                    ? "#3B82F6"
                                    : STATUS_COLOR[t.status] || undefined,
                              }}
                            >
                              <span className="num text-lg font-bold">
                                T{t.number}
                              </span>
                              <span className="text-[10px] text-[var(--muted)]">
                                {billDue
                                  ? "Bill due"
                                  : t.currentSession
                                    ? `${t.currentSession.rounds} rounds`
                                    : label(TABLE_STATUS_LABEL, t.status)}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                    <div
                      className="relative mx-auto hidden md:block"
                      style={{ width: maxX, height: maxY, minHeight: 320 }}
                    >
                      {tables.map((t) => {
                        const billDue =
                          t.currentSession?.status === "BILL_REQUESTED";
                        const selectedHere = selected?.id === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => selectTable(t)}
                            className="absolute flex flex-col items-center justify-center border-2 bg-white text-sm font-medium shadow-sm transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                            style={{
                              left: t.x,
                              top: t.y,
                              width: t.shape === "RECT" ? 100 : 80,
                              height: t.shape === "RECT" ? 64 : 80,
                              borderRadius: t.shape === "ROUND" ? 999 : 6,
                              borderColor: selectedHere
                                ? "var(--accent)"
                                : billDue
                                  ? "#3B82F6"
                                  : STATUS_COLOR[t.status] || "#6B6560",
                              boxShadow: selectedHere
                                ? "0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent)"
                                : undefined,
                            }}
                          >
                            <span className="num text-lg font-bold">
                              T{t.number}
                            </span>
                            <span className="text-[10px] text-[var(--muted)]">
                              {billDue
                                ? "Bill"
                                : t.currentSession
                                  ? `${t.currentSession.rounds}r`
                                  : `${t.capacity}p`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : tab === "calls" ? (
            <div className="space-y-4 overflow-auto p-3">
              <ApprovalQueue
                tableNumbers={Object.fromEntries(
                  tables.map((t) => [t.id, t.number])
                )}
              />
              <ServiceRequestInbox
                maxHeightClass="max-h-[50vh]"
                onSelectTable={(tableId) => handleSelectFromCall(tableId)}
              />
            </div>
          ) : !selected ? (
            <div className="p-6">
              <p className="text-sm text-[var(--muted)]">
                Open the floor plan and tap a table first.
              </p>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() => setTab("floor")}
              >
                Show floor plan
              </Button>
            </div>
          ) : tab === "status" ? (
            <div className="overflow-auto p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="num text-lg font-semibold">
                    Table {selected.number}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {selected.currentSession
                      ? label(
                          SESSION_STATUS_LABEL,
                          selected.currentSession.status
                        )
                      : label(TABLE_STATUS_LABEL, selected.status)}
                  </p>
                </div>
                {selected.status === "CLEANING" ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await apiFetch(`/api/tables/${selected.id}`, {
                        method: "PATCH",
                        branchId: activeBranchId,
                        body: JSON.stringify({ status: "AVAILABLE" }),
                      });
                      setSelected(null);
                      void load();
                    }}
                  >
                    Mark available
                  </Button>
                ) : null}
                {selected.currentSession &&
                selected.currentSession.dueAmount > 0 &&
                hasPermission("payments.create") ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void collectBill()}
                  >
                    Collect bill
                  </Button>
                ) : null}
              </div>
              {tableOrders.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No active kitchen rounds for this table.
                </p>
              ) : (
                <ul className="space-y-2">
                  {tableOrders.map((o) => (
                    <li
                      key={o.id}
                      className="rounded-[6px] border border-[var(--border)] bg-white p-3"
                    >
                      <div className="flex justify-between gap-2">
                        <p className="num text-sm font-semibold">
                          {o.roundNumber != null
                            ? `Round ${o.roundNumber}`
                            : o.orderNumber}
                        </p>
                        <p className="text-xs font-medium text-[var(--teal,#2A9D8F)]">
                          {label(ORDER_STATUS_LABEL, o.status)}
                        </p>
                      </div>
                      <ul className="mt-2 text-sm text-[var(--muted)]">
                        {o.items.map((it, i) => (
                          <li key={i}>
                            <span className="num">{it.qty}×</span> {it.name}
                          </li>
                        ))}
                      </ul>
                      <p className="num mt-2 text-sm font-semibold">
                        {formatMoney(o.total)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
                <div>
                  <p className="num text-lg font-semibold">
                    Table {selected.number}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {selected.currentSession
                      ? `${selected.currentSession.rounds} rounds · due ${formatMoney(selected.currentSession.dueAmount)}`
                      : "First round opens the session"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setTab("floor")}
                  >
                    Floor
                  </Button>
                  {selected.currentSession &&
                  selected.currentSession.dueAmount > 0 &&
                  hasPermission("payments.create") ? (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void collectBill()}
                    >
                      Collect bill
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] p-2">
                <button
                  type="button"
                  onClick={() => setCatId("all")}
                  className={`h-9 shrink-0 rounded-[6px] px-3 text-sm ${
                    catId === "all"
                      ? "bg-[var(--ink)] text-white"
                      : "border border-[var(--border)]"
                  }`}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCatId(c.id)}
                    className={`h-9 shrink-0 rounded-[6px] px-3 text-sm ${
                      catId === c.id
                        ? "bg-[var(--ink)] text-white"
                        : "border border-[var(--border)]"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 overflow-auto p-3 sm:grid-cols-3">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    className="rounded-[6px] border border-[var(--border)] bg-white p-3 text-left hover:border-[var(--accent)]"
                  >
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="num text-xs text-[var(--muted)]">
                      {formatMoney(item.price)}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="flex min-h-0 flex-col border-t border-[var(--border)] lg:border-t-0 lg:border-l">
          <div className="hidden border-b border-[var(--border)] px-3 py-2 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase lg:block">
            QR approvals
          </div>
          <div className="hidden max-h-56 min-h-0 overflow-auto p-2 lg:block">
            <ApprovalQueue
              tableNumbers={Object.fromEntries(
                tables.map((t) => [t.id, t.number])
              )}
            />
          </div>
          <div className="hidden border-b border-[var(--border)] px-3 py-2 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase lg:block">
            Guest calls
          </div>
          <div className="hidden min-h-0 flex-1 overflow-auto p-2 lg:block">
            <ServiceRequestInbox
              maxHeightClass="max-h-full"
              onSelectTable={(tableId) => handleSelectFromCall(tableId)}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--border)] lg:flex-none lg:border-t">
            <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
              Ticket
            </div>
            <ul className="max-h-48 flex-1 overflow-auto p-3 lg:max-h-56">
              {lines.length === 0 ? (
                <li className="text-sm text-[var(--muted)]">
                  {selected
                    ? "No items yet — open Take order."
                    : "Tap a table on the floor plan."}
                </li>
              ) : (
                lines.map((l, i) => (
                  <li
                    key={`${l.menuItemId}-${i}`}
                    className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="num text-xs text-[var(--muted)]">
                        {formatMoney(l.unitPrice * l.qty)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--border)]"
                        onClick={() =>
                          setLines((prev) =>
                            prev
                              .map((x, j) =>
                                j === i ? { ...x, qty: x.qty - 1 } : x
                              )
                              .filter((x) => x.qty > 0)
                          )
                        }
                      >
                        <Minus size={14} />
                      </button>
                      <span className="num w-5 text-center text-sm">{l.qty}</span>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--border)]"
                        onClick={() =>
                          setLines((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, qty: x.qty + 1 } : x
                            )
                          )
                        }
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
            <div className="border-t border-[var(--border)] p-3">
              <p className="num mb-2 text-lg font-semibold">
                {formatMoney(cartTotal)}
              </p>
              <Button
                className="w-full"
                disabled={busy || !selected || !lines.length}
                onClick={() => void sendOrder()}
              >
                {busy ? "Sending…" : "Send to kitchen"}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
