"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { platformFetch } from "@/components/PlatformAuthProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { RESTAURANT_STATUS_LABEL, PLAN_LABEL, BILLING_STATUS_LABEL, label } from "@/lib/labels";
import { Skeleton } from "@/components/ui/Skeleton";

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  billingStatus: string;
  address: string;
  branchCount: number;
  contactEmail: string;
  contactPhone: string;
  createdAt: string | null;
}

function statusTone(status: string): "success" | "warn" | "danger" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING") return "warn";
  if (status === "SUSPENDED") return "danger";
  return "neutral";
}

function billingTone(
  status: string
): "success" | "warn" | "danger" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "TRIAL") return "warn";
  if (status === "PAST_DUE" || status === "CANCELLED") return "danger";
  return "neutral";
}

export default function RestaurantsListPage() {
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      const data = await platformFetch(
        `/api/platform/restaurants?${params.toString()}`
      );
      setRows(data.restaurants);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
            Restaurant registrations
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            All tenants on the RestaurantOS platform.
          </p>
        </div>
        <Link href="/admin/restaurants/new">
          <Button>Register restaurant</Button>
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search name, slug, email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-10 rounded-[6px] border border-[var(--border)] bg-white px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">
            {label(RESTAURANT_STATUS_LABEL, "ACTIVE")}
          </option>
          <option value="PENDING">
            {label(RESTAURANT_STATUS_LABEL, "PENDING")}
          </option>
          <option value="SUSPENDED">
            {label(RESTAURANT_STATUS_LABEL, "SUSPENDED")}
          </option>
        </select>
      </div>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4">
          <div className="space-y-2 sm:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <div className="mt-0 hidden space-y-2 sm:block">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <>
      <div className="mt-4 space-y-2 sm:hidden">
        {rows.length === 0 ? (
          <p className="rounded-[6px] border border-[var(--border)] bg-white px-4 py-8 text-center text-[var(--muted)]">
            No restaurants match this filter.
          </p>
        ) : (
          rows.map((r) => (
            <Link
              key={r.id}
              href={`/admin/restaurants/${r.id}`}
              className="block rounded-[6px] border border-[var(--border)] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--ink)]">{r.name}</p>
                  <p className="text-xs text-[var(--muted)]">{r.slug}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={statusTone(r.status)}>
                    {label(RESTAURANT_STATUS_LABEL, r.status)}
                  </Badge>
                  <Badge tone={billingTone(r.billingStatus)}>
                    {label(BILLING_STATUS_LABEL, r.billingStatus)}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {label(PLAN_LABEL, r.plan)} · {r.branchCount} branch
                {r.branchCount === 1 ? "" : "es"}
                {r.contactEmail ? ` · ${r.contactEmail}` : ""}
              </p>
            </Link>
          ))
        )}
      </div>

      <Card className="mt-4 hidden overflow-hidden sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Restaurant</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Billing</th>
              <th className="px-4 py-3 font-medium">Branches</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Registered</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                  No restaurants match this filter.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
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
                    <Badge tone={statusTone(r.status)}>
                      {label(RESTAURANT_STATUS_LABEL, r.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {label(PLAN_LABEL, r.plan)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={billingTone(r.billingStatus)}>
                      {label(BILLING_STATUS_LABEL, r.billingStatus)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 num">{r.branchCount}</td>
                  <td className="px-4 py-3">
                    <p>{r.contactEmail || "—"}</p>
                    {r.contactPhone ? (
                      <p className="text-xs text-[var(--muted)]">{r.contactPhone}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {r.createdAt
                      ? new Date(r.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
        </>
      )}
    </div>
  );
}
