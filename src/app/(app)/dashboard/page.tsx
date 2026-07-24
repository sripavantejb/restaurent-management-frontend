"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";

interface Summary {
  kpis: {
    revenue: number;
    revenueChange: number;
    orderCount: number;
    orderCountChange: number;
    aov: number;
    aovChange: number;
    avgPrepMins: number;
    avgPrepChange: number;
  };
  hourly: { hour: number; revenue: number }[];
  topItems: { name: string; qty: number }[];
  occupancy: {
    occupied: number;
    total: number;
    tables: { id: string; number: number; x: number; y: number; status: string }[];
  };
  branchComparison: { id: string; name: string; revenue: number; orders: number }[];
}

function Change({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`num text-xs ${positive ? "text-[var(--success)]" : "text-[var(--accent)]"}`}
    >
      {positive ? "+" : ""}
      {value}% vs yesterday
    </span>
  );
}

export default function DashboardPage() {
  const { activeBranchId, user } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const res = await apiFetch("/api/reports/summary", {
        branchId: activeBranchId,
      });
      setData(res);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  }, [activeBranchId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  if (error) {
    return (
      <div className="p-6">
        <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}. Run `npm run seed` and confirm MongoDB is up.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-[var(--muted)]">Loading live branch metrics…</div>
    );
  }

  const maxHour = Math.max(...data.hourly.map((h) => h.revenue), 1);
  const maxQty = Math.max(...data.topItems.map((i) => i.qty), 1);
  const kpis = [
    {
      label: "Today's revenue",
      value: formatMoney(data.kpis.revenue),
      change: data.kpis.revenueChange,
    },
    {
      label: "Orders",
      value: String(data.kpis.orderCount),
      change: data.kpis.orderCountChange,
    },
    {
      label: "Avg order value",
      value: formatMoney(data.kpis.aov),
      change: data.kpis.aovChange,
    },
    {
      label: "Avg prep (min)",
      value: String(data.kpis.avgPrepMins),
      change: data.kpis.avgPrepChange,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Live numbers for the active branch. Switch branch in the sidebar to prove tenancy.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-xs text-[var(--muted)]">{k.label}</p>
            <p className="num mt-2 text-3xl font-semibold tracking-tight">{k.value}</p>
            <div className="mt-2">
              <Change value={k.change} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Revenue by hour</h2>
          <p className="text-xs text-[var(--muted)]">Today · hand-rolled SVG</p>
          <svg viewBox="0 0 480 180" className="mt-4 h-44 w-full" role="img">
            {data.hourly.map((h, i) => {
              const barH = (h.revenue / maxHour) * 140;
              const x = 10 + i * 19;
              const y = 160 - barH;
              return (
                <g key={h.hour}>
                  <rect
                    x={x}
                    y={y}
                    width={14}
                    height={barH}
                    fill={h.revenue ? "var(--accent)" : "var(--border)"}
                    rx={2}
                  />
                  {i % 3 === 0 ? (
                    <text
                      x={x + 7}
                      y={175}
                      textAnchor="middle"
                      fontSize="8"
                      fill="var(--muted)"
                      className="num"
                    >
                      {h.hour}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold">Top sellers this week</h2>
          <p className="text-xs text-[var(--muted)]">Ranked by quantity</p>
          {data.topItems.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--muted)]">
              No completed orders this week. Run the seed or close a bill on POS.
            </p>
          ) : (
            <ol className="mt-4 space-y-2">
              {data.topItems.map((item, idx) => (
                <li key={item.name} className="flex items-center gap-3 text-sm">
                  <span className="num w-5 text-[var(--muted)]">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="truncate">{item.name}</span>
                      <span className="num shrink-0">{item.qty}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-2)]">
                      <div
                        className="h-1.5 rounded-full bg-[var(--success)]"
                        style={{ width: `${(item.qty / maxQty) * 100}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Table occupancy</h2>
          <p className="num mt-1 text-2xl font-semibold">
            {data.occupancy.occupied} of {data.occupancy.total} occupied
          </p>
          <div className="relative mt-4 h-40 rounded-[6px] bg-[var(--surface-2)]">
            {data.occupancy.tables.map((t) => (
              <span
                key={t.id}
                title={`T${t.number} ${t.status}`}
                className="absolute h-5 w-5 rounded-[4px] border border-white"
                style={{
                  left: `${(t.x / 600) * 90 + 5}%`,
                  top: `${(t.y / 400) * 70 + 10}%`,
                  background:
                    t.status === "FREE"
                      ? "var(--success)"
                      : t.status === "OCCUPIED"
                        ? "var(--warn)"
                        : "var(--accent)",
                }}
              />
            ))}
          </div>
        </Card>

        {user?.role === "OWNER" && data.branchComparison.length > 0 ? (
          <Card className="p-4">
            <h2 className="text-sm font-semibold">Branch comparison</h2>
            <p className="text-xs text-[var(--muted)]">Today's completed revenue</p>
            <div className="mt-4 space-y-3">
              {data.branchComparison.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between border-b border-[var(--border)] pb-2 text-sm"
                >
                  <span>{b.name}</span>
                  <span className="num">
                    {formatMoney(b.revenue)} · {b.orders} orders
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-4">
            <h2 className="text-sm font-semibold">Shift tip</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Open POS to take a dine-in order, watch it on KDS, then bill from cashier.
              Revenue here updates within a few seconds of payment.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
