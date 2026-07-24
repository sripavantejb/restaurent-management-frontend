"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";

interface OrderItem {
  id?: string;
  name: string;
  qty: number;
  notes: string;
  status: string;
  variant?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  type: string;
  tableId: string | null;
  status: string;
  items: OrderItem[];
  placedAt: string | null;
  servedAt: string | null;
  roundNumber?: number;
  placedBy?: "STAFF" | "GUEST";
}

function ageMs(placedAt: string | null) {
  if (!placedAt) return 0;
  return Date.now() - new Date(placedAt).getTime();
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function ageClass(ms: number) {
  const mins = ms / 60000;
  if (mins > 10) return "border-[var(--accent)] age-pulse";
  if (mins > 5) return "border-[var(--warn)]";
  return "border-[#3a3530]";
}

export default function KdsPage() {
  const { activeBranchId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Record<string, number>>({});
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const mapRef = useRef<Map<string, Order>>(new Map());

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const [ord, tbl] = await Promise.all([
        apiFetch("/api/orders?status=active", { branchId: activeBranchId }),
        apiFetch("/api/tables", { branchId: activeBranchId }),
      ]);
      const next = new Map<string, Order>();
      for (const o of ord.orders as Order[]) {
        const prev = mapRef.current.get(o.id);
        next.set(o.id, prev ? { ...o, placedAt: o.placedAt || prev.placedAt } : o);
      }
      // Keep recently SERVED from previous poll if within 15 min
      for (const [id, prev] of mapRef.current) {
        if (
          prev.status === "SERVED" &&
          prev.servedAt &&
          Date.now() - new Date(prev.servedAt).getTime() < 15 * 60 * 1000 &&
          !next.has(id)
        ) {
          next.set(id, prev);
        }
      }
      mapRef.current = next;
      setOrders([...next.values()]);
      const tmap: Record<string, number> = {};
      for (const t of tbl.tables) tmap[t.id] = t.number;
      setTables(tmap);
      setSyncedAt(new Date());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "KDS sync failed");
    }
  }, [activeBranchId]);

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 2000);
    const clock = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  async function advance(order: Order) {
    try {
      await apiFetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        branchId: activeBranchId,
        body: JSON.stringify({}),
      });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update order");
    }
  }

  async function markItem(orderId: string, itemId: string | undefined) {
    if (!itemId) return;
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        branchId: activeBranchId,
        body: JSON.stringify({ itemId, itemStatus: "READY" }),
      });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update item");
    }
  }

  void tick;

  const cols = {
    NEW: orders.filter((o) => o.status === "PLACED"),
    COOKING: orders.filter((o) => o.status === "PREPARING"),
    READY: orders.filter((o) => o.status === "READY"),
    SERVED: orders.filter(
      (o) =>
        o.status === "SERVED" &&
        o.servedAt &&
        Date.now() - new Date(o.servedAt).getTime() < 15 * 60 * 1000
    ),
  };

  return (
    <div className="flex h-full flex-col bg-[var(--kds-bg)] text-[#f3efe8]">
      <header className="flex h-14 items-center justify-between border-b border-[#2a2622] px-4">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Kitchen Display
          </p>
          <h1 className="text-lg font-semibold">Live tickets</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-[#9a938a]">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
            Live
          </span>
          <span className="num">
            Synced{" "}
            {syncedAt
              ? syncedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
              : "—"}
          </span>
        </div>
      </header>

      {error ? (
        <p className="bg-red-950 px-4 py-2 text-sm text-red-200">
          {error}. Check network and that you have kds.view permission.
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-4 gap-2 p-2">
        {(
          [
            ["NEW", cols.NEW],
            ["COOKING", cols.COOKING],
            ["READY", cols.READY],
            ["SERVED", cols.SERVED],
          ] as const
        ).map(([title, list]) => (
          <section key={title} className="flex min-h-0 flex-col rounded-[6px] bg-[#1a1714] p-2">
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-[0.15em] text-[#9a938a] uppercase">
              {title} · {list.length}
            </h2>
            <div className="min-h-0 flex-1 space-y-2 overflow-auto">
              {list.length === 0 ? (
                <p className="px-1 text-sm text-[#6b6560]">
                  {title === "NEW"
                    ? "Waiting for POS to send tickets."
                    : "Nothing here yet."}
                </p>
              ) : (
                list.map((order) => {
                  const age = ageMs(order.placedAt);
                  const faded = title === "SERVED";
                  const canAdvance = title !== "SERVED";
                  return (
                    <article
                      key={order.id}
                      className={`w-full rounded-[6px] border-2 bg-[#221e1a] p-3 text-left ${ageClass(age)} ${
                        faded ? "opacity-45" : ""
                      }`}
                    >
                      <button
                        type="button"
                        disabled={!canAdvance}
                        onClick={() => canAdvance && void advance(order)}
                        className="mb-2 flex w-full items-start justify-between gap-2 rounded-[6px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-default"
                      >
                        <div>
                          <p className="num text-2xl font-semibold tracking-tight">
                            {order.orderNumber}
                          </p>
                          <p className="text-sm text-[#c4bdb3]">
                            {order.type === "TAKEAWAY"
                              ? "TAKEAWAY"
                              : order.placedBy === "GUEST" && order.roundNumber
                                ? `Table ${tables[order.tableId ?? ""] ?? "?"} · Round ${order.roundNumber} · QR`
                                : order.tableId
                                  ? `Table ${tables[order.tableId] ?? "?"}`
                                  : "Dine-in"}
                          </p>
                          {canAdvance ? (
                            <p className="mt-1 text-xs text-[#6b6560]">
                              Tap header to advance
                            </p>
                          ) : null}
                        </div>
                        <p className="num text-xl text-[var(--warn)]">{formatElapsed(age)}</p>
                      </button>
                      <ul className="space-y-1.5">
                        {order.items.map((it, idx) => (
                          <li key={it.id ?? idx}>
                            <button
                              type="button"
                              className={`block w-full rounded-[6px] px-2 py-2 text-left text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                                it.status === "READY"
                                  ? "text-[#6b6560] line-through"
                                  : "text-[#f3efe8] hover:bg-[#2a2622]"
                              }`}
                              onClick={() => void markItem(order.id, it.id)}
                            >
                              <span className="num font-semibold">{it.qty}×</span> {it.name}
                              {it.variant ? ` (${it.variant})` : ""}
                              {it.notes ? (
                                <span className="mt-0.5 block font-bold text-[var(--warn)]">
                                  {it.notes}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
