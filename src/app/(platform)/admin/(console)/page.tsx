"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { platformFetch } from "@/components/PlatformAuthProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RESTAURANT_STATUS_LABEL, label } from "@/lib/labels";
import { ConsolePageSkeleton } from "@/components/ui/Skeleton";

interface Counts {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  trial?: number;
  billingActive?: number;
  pastDue?: number;
  cancelled?: number;
  trialExpiringSoon?: number;
  modulesOffTenants?: number;
}

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan?: string;
  billingStatus?: string;
  branchCount: number;
  contactEmail: string;
  createdAt: string | null;
  trialEndsAt?: string | null;
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
  const [all, setAll] = useState<RestaurantRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await platformFetch("/api/platform/restaurants");
      setCounts(data.counts);
      setAll(data.restaurants);
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
      <div className="p-4 sm:p-6">
        <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}. Run `npm run seed` if the database is empty.
        </p>
      </div>
    );
  }

  if (!counts) {
    return <ConsolePageSkeleton />;
  }

  const tiles = [
    { label: "Total restaurants", value: counts.total },
    { label: "Active", value: counts.active },
    { label: "Pending", value: counts.pending },
    { label: "Suspended", value: counts.suspended },
    { label: "On trial", value: counts.trial ?? 0 },
    { label: "Billing active", value: counts.billingActive ?? 0 },
    { label: "Past due", value: counts.pastDue ?? 0 },
    { label: "Trial ending ≤7d", value: counts.trialExpiringSoon ?? 0 },
  ];

  const now = Date.now();
  const soon = now + 7 * 86400000;
  const pendingQ = all.filter((r) => r.status === "PENDING");
  const suspendedQ = all.filter((r) => r.status === "SUSPENDED");
  const pastDueQ = all.filter((r) => r.billingStatus === "PAST_DUE");
  const trialEndingQ = all.filter((r) => {
    if (r.billingStatus !== "TRIAL" || !r.trialEndsAt) return false;
    const t = new Date(r.trialEndsAt).getTime();
    return t >= now && t <= soon;
  });

  const queues = [
    {
      title: "Pending activation",
      href: "/admin/restaurants?status=PENDING",
      rows: pendingQ,
      empty: "No pending restaurants",
    },
    {
      title: "Suspended",
      href: "/admin/restaurants?status=SUSPENDED",
      rows: suspendedQ,
      empty: "None suspended",
    },
    {
      title: "Trial ending soon",
      href: "/admin/billing?filter=trial_ending",
      rows: trialEndingQ,
      empty: "No trials ending this week",
    },
    {
      title: "Past due",
      href: "/admin/billing?billingStatus=PAST_DUE",
      rows: pastDueQ,
      empty: "No past-due accounts",
    },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
            Platform overview
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Control tenant status, billing, modules, and plan limits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/modules">
            <Button variant="secondary">Modules matrix</Button>
          </Link>
          <Link href="/admin/billing">
            <Button variant="secondary">Billing queue</Button>
          </Link>
          <Link href="/admin/restaurants/new">
            <Button>Register restaurant</Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              {t.label}
            </p>
            <p className="num mt-2 text-3xl font-semibold text-[var(--ink)]">
              {t.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {queues.map((q) => (
          <Card key={q.title} className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--ink)]">
                {q.title}{" "}
                <span className="num text-[var(--muted)]">({q.rows.length})</span>
              </h2>
              <Link
                href={q.href}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Open
              </Link>
            </div>
            {q.rows.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{q.empty}</p>
            ) : (
              <ul className="space-y-2">
                {q.rows.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/restaurants/${r.id}`}
                      className="flex items-center justify-between gap-2 text-sm hover:text-[var(--accent)]"
                    >
                      <span className="font-medium">{r.name}</span>
                      <Badge tone={statusTone(r.status)}>
                        {label(RESTAURANT_STATUS_LABEL, r.status)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--ink)]">
            Recent registrations
          </h2>
          <Link
            href="/admin/restaurants"
            className="text-sm text-[var(--accent)] hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="overflow-hidden rounded-[6px] border border-[var(--border)]">
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
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-[var(--muted)]"
                  >
                    No restaurants yet
                  </td>
                </tr>
              ) : (
                recent.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/restaurants/${r.id}`}
                        className="font-medium hover:text-[var(--accent)]"
                      >
                        {r.name}
                      </Link>
                      <p className="num text-xs text-[var(--muted)]">{r.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(r.status)}>
                        {label(RESTAURANT_STATUS_LABEL, r.status)}
                      </Badge>
                    </td>
                    <td className="num px-4 py-3">{r.branchCount}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {r.contactEmail || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
