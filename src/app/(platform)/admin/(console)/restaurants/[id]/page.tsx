"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { platformFetch } from "@/components/PlatformAuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  RESTAURANT_STATUS_LABEL,
  PLAN_LABEL,
  BILLING_STATUS_LABEL,
  label,
} from "@/lib/labels";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";

interface Detail {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    plan: string;
    billingStatus: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    razorpayCustomerId: string;
    razorpaySubscriptionId: string;
    address: string;
    gstNumber: string;
    contactEmail: string;
    contactPhone: string;
    currency: string;
    timezone: string;
    createdAt: string | null;
  };
  usage: {
    branches: number;
    staff: number;
    tables: number;
    limits: {
      maxBranches: number;
      maxStaff: number;
      maxTables: number;
    };
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

function billingTone(
  status: string
): "success" | "warn" | "danger" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "TRIAL") return "warn";
  if (status === "PAST_DUE" || status === "CANCELLED") return "danger";
  return "neutral";
}

function fmtLimit(n: number) {
  return n < 0 ? "∞" : String(n);
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function RestaurantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState("GROWTH");
  const [checkoutMsg, setCheckoutMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await platformFetch(`/api/platform/restaurants/${id}`);
      setData(res);
      setCheckoutPlan(res.restaurant.plan || "STARTER");
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

  async function setPlan(plan: string) {
    setBusy(true);
    try {
      await platformFetch(`/api/platform/restaurants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ plan }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan update failed");
    } finally {
      setBusy(false);
    }
  }

  async function startCheckout() {
    setBusy(true);
    setCheckoutMsg("");
    try {
      const res = await platformFetch(
        `/api/platform/restaurants/${id}/billing/checkout`,
        {
          method: "POST",
          body: JSON.stringify({ plan: checkoutPlan }),
        }
      );
      if (res.shortUrl) {
        window.open(res.shortUrl as string, "_blank", "noopener,noreferrer");
        setCheckoutMsg(
          "Razorpay checkout opened. After payment, webhook will mark billing Active."
        );
      } else {
        setCheckoutMsg(`Subscription ${res.subscriptionId} created (${res.status}).`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className="p-4 sm:p-6">
        <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return <DetailPageSkeleton />;
  }

  const { restaurant, branches, owners, staffCount, usage } = data;

  return (
    <div className="p-4 sm:p-6 md:p-8">
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
            <Badge tone={statusTone(restaurant.status)}>
              {label(RESTAURANT_STATUS_LABEL, restaurant.status)}
            </Badge>
            <Badge tone={billingTone(restaurant.billingStatus)}>
              {label(BILLING_STATUS_LABEL, restaurant.billingStatus)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            <span className="num">{restaurant.slug}</span>
            {" · "}
            {label(PLAN_LABEL, restaurant.plan)}
            {restaurant.createdAt
              ? ` · registered ${fmtDate(restaurant.createdAt)}`
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
            Billing
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-[var(--muted)]">Plan</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-[6px] border border-[var(--border)] bg-white px-2 text-sm"
                  value={restaurant.plan}
                  disabled={busy}
                  onChange={(e) => void setPlan(e.target.value)}
                >
                  <option value="STARTER">Starter</option>
                  <option value="GROWTH">Growth</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Billing status</dt>
              <dd>{label(BILLING_STATUS_LABEL, restaurant.billingStatus)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Trial ends</dt>
              <dd>{fmtDate(restaurant.trialEndsAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Current period end</dt>
              <dd>{fmtDate(restaurant.currentPeriodEnd)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Usage vs limits</dt>
              <dd className="num mt-1 text-[var(--muted)]">
                Branches {usage.branches}/{fmtLimit(usage.limits.maxBranches)} ·
                Staff {usage.staff}/{fmtLimit(usage.limits.maxStaff)} · Tables{" "}
                {usage.tables}/{fmtLimit(usage.limits.maxTables)}
              </dd>
            </div>
            {restaurant.razorpaySubscriptionId ? (
              <div>
                <dt className="text-xs text-[var(--muted)]">Razorpay subscription</dt>
                <dd className="num break-all text-xs">
                  {restaurant.razorpaySubscriptionId}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <p className="text-xs font-medium text-[var(--muted)]">
              Start Razorpay subscription
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <select
                className="h-10 rounded-[6px] border border-[var(--border)] bg-white px-3 text-sm"
                value={checkoutPlan}
                disabled={busy}
                onChange={(e) => setCheckoutPlan(e.target.value)}
              >
                <option value="STARTER">Starter</option>
                <option value="GROWTH">Growth</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
              <Button disabled={busy} onClick={() => void startCheckout()}>
                Open checkout
              </Button>
            </div>
            {checkoutMsg ? (
              <p className="mt-2 text-xs text-[var(--muted)]">{checkoutMsg}</p>
            ) : null}
          </div>
        </Card>

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
              <p className="mt-2 text-xs text-[var(--muted)]">
                Day-to-day waiter accounts and performance live in the restaurant
                console under Waiters (owner/manager login).
              </p>
            </div>
          </dl>
        </Card>

        <Card className="p-5 lg:col-span-2">
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
              <tr
                key={b.id}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3 num">{b.code}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {b.address || "—"}
                </td>
                <td className="px-4 py-3">{b.isActive ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
