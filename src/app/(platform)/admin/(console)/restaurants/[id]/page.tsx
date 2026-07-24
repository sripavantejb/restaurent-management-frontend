"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { platformFetch } from "@/components/PlatformAuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface Detail {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    address: string;
    gstNumber: string;
    contactEmail: string;
    contactPhone: string;
    currency: string;
    timezone: string;
    createdAt: string | null;
  };
  branches: {
    id: string;
    name: string;
    code: string;
    address: string;
    isActive: boolean;
  }[];
  owners: { id: string; name: string; email: string; isActive: boolean }[];
  staffCount: number;
}

function statusTone(status: string): "success" | "warn" | "danger" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING") return "warn";
  if (status === "SUSPENDED") return "danger";
  return "neutral";
}

export default function RestaurantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await platformFetch(`/api/platform/restaurants/${id}`);
      setData(res);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await platformFetch(`/api/platform/restaurants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-[var(--muted)]">Loading restaurant…</div>;
  }

  const { restaurant, branches, owners, staffCount } = data;

  return (
    <div className="p-6 md:p-8">
      <Link
        href="/admin/restaurants"
        className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
      >
        ← Restaurants
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
              {restaurant.name}
            </h1>
            <Badge tone={statusTone(restaurant.status)}>{restaurant.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            <span className="num">{restaurant.slug}</span>
            {restaurant.createdAt
              ? ` · registered ${new Date(restaurant.createdAt).toLocaleDateString("en-IN")}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {restaurant.status !== "ACTIVE" ? (
            <Button disabled={busy} onClick={() => void setStatus("ACTIVE")}>
              Activate
            </Button>
          ) : null}
          {restaurant.status !== "PENDING" ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void setStatus("PENDING")}
            >
              Mark pending
            </Button>
          ) : null}
          {restaurant.status !== "SUSPENDED" ? (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void setStatus("SUSPENDED")}
            >
              Suspend
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Tenant details
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-[var(--muted)]">Address</dt>
              <dd>{restaurant.address || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">GST</dt>
              <dd className="num">{restaurant.gstNumber || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Contact</dt>
              <dd>
                {restaurant.contactEmail || "—"}
                {restaurant.contactPhone ? ` · ${restaurant.contactPhone}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Locale</dt>
              <dd>
                {restaurant.currency} · {restaurant.timezone}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Staff accounts</dt>
              <dd className="num">{staffCount}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Owners
          </h2>
          <ul className="mt-4 space-y-3">
            {owners.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">No owner accounts.</li>
            ) : (
              owners.map((o) => (
                <li key={o.id} className="text-sm">
                  <p className="font-medium text-[var(--ink)]">{o.name}</p>
                  <p className="text-[var(--muted)]">{o.email}</p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Branches
          </h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3 num">{b.code}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{b.address || "—"}</td>
                <td className="px-4 py-3">{b.isActive ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
