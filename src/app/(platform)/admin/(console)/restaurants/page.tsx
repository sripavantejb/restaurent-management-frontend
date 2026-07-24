"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { platformFetch } from "@/components/PlatformAuthProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
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
    <div className="p-6 md:p-8">
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
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <Card className="mt-4 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Restaurant</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Branches</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Registered</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
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
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
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
    </div>
  );
}
