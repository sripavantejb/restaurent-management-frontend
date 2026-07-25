"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { platformFetch } from "@/components/PlatformAuthProvider";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  BILLING_STATUS_LABEL,
  PLAN_LABEL,
  RESTAURANT_STATUS_LABEL,
  label,
} from "@/lib/labels";
import { ConsolePageSkeleton } from "@/components/ui/Skeleton";

type Row = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  billingStatus: string;
  trialEndsAt: string | null;
  contactEmail: string;
};

function billingTone(
  status: string
): "success" | "warn" | "danger" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "TRIAL") return "warn";
  if (status === "PAST_DUE" || status === "CANCELLED") return "danger";
  return "neutral";
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BillingQueuePage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [billingFilter, setBillingFilter] = useState("ALL");
  const [special, setSpecial] = useState("");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const bs = sp.get("billingStatus");
    const f = sp.get("filter");
    if (bs) setBillingFilter(bs);
    if (f) setSpecial(f);
  }, []);

  const load = useCallback(async () => {
    try {
      const qs =
        billingFilter !== "ALL" ? `?billingStatus=${billingFilter}` : "";
      const data = await platformFetch(`/api/platform/restaurants${qs}`);
      setRows(data.restaurants);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    }
  }, [billingFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (special !== "trial_ending") return rows;
    const now = Date.now();
    const soon = now + 7 * 86400000;
    return rows.filter((r) => {
      if (r.billingStatus !== "TRIAL" || !r.trialEndsAt) return false;
      const t = new Date(r.trialEndsAt).getTime();
      return t >= now && t <= soon;
    });
  }, [rows, special]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    try {
      await platformFetch(`/api/platform/restaurants/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  if (rows === null) return <ConsolePageSkeleton />;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Override billing status, extend trials, and suspend tenants.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-10 rounded-[6px] border border-[var(--border)] bg-white px-3 text-sm"
            value={billingFilter}
            onChange={(e) => {
              setSpecial("");
              setBillingFilter(e.target.value);
            }}
          >
            <option value="ALL">All billing</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="PAST_DUE">Past due</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <Button
            variant={special === "trial_ending" ? "primary" : "secondary"}
            onClick={() =>
              setSpecial((s) => (s === "trial_ending" ? "" : "trial_ending"))
            }
          >
            Trial ending ≤7d
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-[6px] border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Restaurant</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Billing</th>
              <th className="px-4 py-3 font-medium">Trial ends</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
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
                  <p className="text-xs text-[var(--muted)]">
                    {label(RESTAURANT_STATUS_LABEL, r.status)} · {r.contactEmail}
                  </p>
                </td>
                <td className="px-4 py-3">{label(PLAN_LABEL, r.plan)}</td>
                <td className="px-4 py-3">
                  <Badge tone={billingTone(r.billingStatus)}>
                    {label(BILLING_STATUS_LABEL, r.billingStatus)}
                  </Badge>
                </td>
                <td className="px-4 py-3">{fmtDate(r.trialEndsAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === r.id}
                      onClick={() => void patch(r.id, { extendDays: 7 })}
                    >
                      +7d trial
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === r.id}
                      onClick={() => void patch(r.id, { extendDays: 14 })}
                    >
                      +14d
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy === r.id}
                      onClick={() =>
                        void patch(r.id, { billingStatus: "ACTIVE" })
                      }
                    >
                      Mark active
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy === r.id}
                      onClick={() => void patch(r.id, { status: "SUSPENDED" })}
                    >
                      Suspend
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-[var(--muted)]">No matching tenants.</p>
        ) : null}
      </div>
    </div>
  );
}
