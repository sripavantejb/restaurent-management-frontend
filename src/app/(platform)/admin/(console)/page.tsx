"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { platformFetch } from "@/components/PlatformAuthProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface Counts {
  total: number;
  active: number;
  pending: number;
  suspended: number;
}

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  branchCount: number;
  contactEmail: string;
  createdAt: string | null;
}

function statusTone(status: string): "success" | "warn" | "danger" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING") return "warn";
  if (status === "SUSPENDED") return "danger";
  return "neutral";
}

export default function PlatformOverviewPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recent, setRecent] = useState<RestaurantRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await platformFetch("/api/platform/restaurants");
      setCounts(data.counts);
      setRecent(data.restaurants.slice(0, 5));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="p-6">
        <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}. Run `npm run seed` if the database is empty.
        </p>
      </div>
    );
  }

  if (!counts) {
    return <div className="p-6 text-[var(--muted)]">Loading platform overview…</div>;
  }

  const tiles = [
    { label: "Total restaurants", value: counts.total },
    { label: "Active", value: counts.active },
    { label: "Pending", value: counts.pending },
    { label: "Suspended", value: counts.suspended },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
            Platform overview
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            SaaS control for restaurant registrations and tenant status.
          </p>
        </div>
        <Link href="/admin/restaurants/new">
          <Button>Register restaurant</Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              {t.label}
            </p>
            <p className="num mt-2 text-3xl font-semibold text-[var(--ink)]">{t.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Recent registrations</h2>
          <Link
            href="/admin/restaurants"
            className="text-sm text-[var(--accent)] hover:underline"
          >
            View all
          </Link>
        </div>
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Restaurant</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Branches</th>
                <th className="px-4 py-3 font-medium">Contact</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                    No restaurants yet. Register the first tenant.
                  </td>
                </tr>
              ) : (
                recent.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/restaurants/${r.id}`}
                        className="font-medium text-[var(--ink)] hover:text-[var(--accent)]"
                      >
                        {r.name}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">{r.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3 num">{r.branchCount}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {r.contactEmail || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
