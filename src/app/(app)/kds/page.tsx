"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { KDS_COLUMN_LABEL, ORDER_TYPE_LABEL, label } from "@/lib/labels";
import { KdsSkeleton } from "@/components/ui/Skeleton";

interface OrderItem {
  id?: string;
  menuItemId?: string;
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

type KdsColumn = "NEW" | "COOKING" | "READY" | "SERVED";

const FLOW: { column: KdsColumn; status: Order["status"] }[] = [
  { column: "NEW", status: "PLACED" },
  { column: "COOKING", status: "PREPARING" },
  { column: "READY", status: "READY" },
  { column: "SERVED", status: "SERVED" },
];

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

function neighborStatus(status: string, dir: -1 | 1): string | null {
  const idx = FLOW.findIndex((f) => f.status === status);
  if (idx < 0) return null;
  const next = FLOW[idx + dir];
  return next?.status ?? null;
}

export default function KdsPage() {
  const { activeBranchId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Record<string, number>>({});
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stations, setStations] = useState<
    { id: string; name: string; code: string }[]
  >([]);
  const [stationFilter, setStationFilter] = useState("");
  const [newStation, setNewStation] = useState("");
  const [stationByMenuId, setStationByMenuId] = useState<
    Record<string, string>
  >({});
  const mapRef = useRef<Map<string, Order>>(new Map());

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const [ord, tbl, st, menu] = await Promise.all([
        apiFetch("/api/orders?status=active", { branchId: activeBranchId }),
        apiFetch("/api/tables", { branchId: activeBranchId }),
        apiFetch("/api/kds/stations", { branchId: activeBranchId }).catch(
          () => ({ stations: [] })
        ),
        apiFetch("/api/menu", { branchId: activeBranchId }).catch(() => ({
          items: [],
        })),
      ]);
      const next = new Map<string, Order>();
      for (const o of ord.orders as Order[]) {
        const prev = mapRef.current.get(o.id);
        next.set(o.id, prev ? { ...o, placedAt: o.placedAt || prev.placedAt } : o);
      }
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
      setStations(st.stations ?? []);
      const smap: Record<string, string> = {};
      for (const it of menu.items ?? []) {
        if (it.stationCode) smap[it.id] = String(it.stationCode).toUpperCase();
      }
      setStationByMenuId(smap);
      setSyncedAt(new Date());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "KDS sync failed");
    } finally {
      setReady(true);
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

  async function shift(order: Order, dir: -1 | 1) {
    const status = neighborStatus(order.status, dir);
    if (!status || busyId === order.id) return;
    setBusyId(order.id);
    try {
      await apiFetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        branchId: activeBranchId,
        body: JSON.stringify({ status }),
      });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update order");
    } finally {
      setBusyId(null);
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

  const matchStation = (o: Order) => {
    if (!stationFilter) return true;
    return o.items.some((it) => {
      const code = it.menuItemId
        ? stationByMenuId[it.menuItemId]
        : undefined;
      return code === stationFilter;
    });
  };

  const filtered = orders.filter(matchStation);

  const cols = {
    NEW: filtered.filter((o) => o.status === "PLACED"),
    COOKING: filtered.filter((o) => o.status === "PREPARING"),
    READY: filtered.filter((o) => o.status === "READY"),
    SERVED: filtered.filter(
      (o) =>
        o.status === "SERVED" &&
        o.servedAt &&
        Date.now() - new Date(o.servedAt).getTime() < 15 * 60 * 1000
    ),
  };

  if (!ready) return <KdsSkeleton />;

  return (
    <div className="flex h-full flex-col bg-[var(--kds-bg)] text-[#f3efe8]">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-[#2a2622] px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Kitchen Display
          </p>
          <h1 className="text-base font-semibold sm:text-lg">Live tickets</h1>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2 text-sm text-[#9a938a] sm:gap-3">
          <select
            className="h-9 max-w-[10rem] rounded border border-[#3a3530] bg-[#1a1714] px-2 text-xs text-[#f3efe8] sm:h-8"
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            aria-label="Station filter"
          >
            <option value="">All stations</option>
            {stations.map((s) => (
              <option key={s.id} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          <form
            className="flex items-center gap-1 sm:flex"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newStation.trim()) return;
              await apiFetch("/api/kds/stations", {
                method: "POST",
                branchId: activeBranchId,
                body: JSON.stringify({
                  name: newStation.trim(),
                  code: newStation.trim().slice(0, 4).toUpperCase(),
                }),
              });
              setNewStation("");
              void load();
            }}
          >
            <input
              className="h-9 w-24 rounded border border-[#3a3530] bg-[#1a1714] px-2 text-xs sm:h-8 sm:w-28"
              placeholder="New station"
              value={newStation}
              onChange={(e) => setNewStation(e.target.value)}
            />
          </form>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
            Live
          </span>
          <span className="num hidden sm:inline">
            Synced{" "}
            {syncedAt
              ? syncedAt.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "—"}
          </span>
        </div>
      </header>

      {error ? (
        <p className="bg-red-950 px-4 py-2 text-sm text-red-200">
          {error}. Check network and that you have kds.view permission.
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto p-2 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["NEW", cols.NEW],
            ["COOKING", cols.COOKING],
            ["READY", cols.READY],
            ["SERVED", cols.SERVED],
          ] as const
        ).map(([title, list]) => (
          <section
            key={title}
            className="flex min-h-[280px] flex-col rounded-[6px] bg-[#1a1714] p-2 xl:min-h-0"
          >
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-[0.15em] text-[#9a938a] uppercase">
              {label(KDS_COLUMN_LABEL, title)} · {list.length}
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
                  const canBack = Boolean(neighborStatus(order.status, -1));
                  const canForward = Boolean(neighborStatus(order.status, 1));
                  const busy = busyId === order.id;
                  return (
                    <article
                      key={order.id}
                      className={`w-full rounded-[6px] border-2 bg-[#221e1a] p-3 text-left ${ageClass(age)} ${
                        faded ? "opacity-45" : ""
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="num text-2xl font-semibold tracking-tight">
                            {order.orderNumber}
                          </p>
                          <p className="text-sm text-[#c4bdb3]">
                            {order.type === "TAKEAWAY"
                              ? label(ORDER_TYPE_LABEL, "TAKEAWAY")
                              : order.placedBy === "GUEST" && order.roundNumber
                                ? `Table ${tables[order.tableId ?? ""] ?? "?"} · Round ${order.roundNumber} · QR`
                                : order.tableId
                                  ? `Table ${tables[order.tableId] ?? "?"}`
                                  : label(ORDER_TYPE_LABEL, "DINE_IN")}
                          </p>
                        </div>
                        <p className="num text-xl text-[var(--warn)]">
                          {formatElapsed(age)}
                        </p>
                      </div>

                      <div className="mb-3 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!canBack || busy}
                          onClick={() => void shift(order, -1)}
                          className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-[6px] border border-[#3a3530] text-sm font-medium text-[#c4bdb3] transition hover:border-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                          aria-label="Move ticket back"
                        >
                          <ChevronLeft size={18} />
                          Back
                        </button>
                        <button
                          type="button"
                          disabled={!canForward || busy}
                          onClick={() => void shift(order, 1)}
                          className="inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-[6px] border border-[var(--accent)] bg-[var(--accent)]/15 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                          aria-label="Move ticket forward"
                        >
                          Next
                          <ChevronRight size={18} />
                        </button>
                      </div>

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
                              <span className="num font-semibold">{it.qty}×</span>{" "}
                              {it.name}
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
