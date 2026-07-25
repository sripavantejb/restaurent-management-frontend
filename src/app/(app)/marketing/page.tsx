"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TablePageSkeleton } from "@/components/ui/Skeleton";

export default function MarketingPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const canEdit = hasPermission("menu.edit");
  const [campaigns, setCampaigns] = useState<
    { id: string; name: string; channel: string; status: string; message: string }[]
  >([]);
  const [coupons, setCoupons] = useState<
    { id: string; code: string; type: string; value: number; redeemedCount: number }[]
  >([]);
  const [cForm, setCForm] = useState({
    name: "",
    channel: "WHATSAPP",
    message: "",
  });
  const [couponForm, setCouponForm] = useState({
    code: "",
    type: "PERCENT",
    value: "10",
  });
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const data = await apiFetch("/api/marketing", { branchId: activeBranchId });
      setCampaigns(data.campaigns);
      setCoupons(data.coupons);
    } finally {
      setReady(true);
    }
  }, [activeBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hasPermission("reports.view")) {
    return <div className="p-6 text-sm text-[var(--muted)]">No access</div>;
  }

  if (!ready) return <TablePageSkeleton />;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
      <p className="text-sm text-[var(--muted)]">
        WhatsApp / Email / SMS campaigns · coupons · festival offers
      </p>

      {canEdit ? (
        <div className="space-y-2 rounded-[6px] border border-[var(--border)] p-3">
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">
            New campaign
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Name"
              value={cForm.name}
              onChange={(e) => setCForm({ ...cForm, name: e.target.value })}
            />
            <select
              className="h-10 rounded-[6px] border border-[var(--border)] px-2 text-sm"
              value={cForm.channel}
              onChange={(e) => setCForm({ ...cForm, channel: e.target.value })}
            >
              {["WHATSAPP", "EMAIL", "SMS", "PUSH", "IN_APP"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <Input
              className="min-w-[200px] flex-1"
              placeholder="Message"
              value={cForm.message}
              onChange={(e) => setCForm({ ...cForm, message: e.target.value })}
            />
            <Button
              onClick={async () => {
                await apiFetch("/api/marketing", {
                  method: "POST",
                  branchId: activeBranchId,
                  body: JSON.stringify({
                    kind: "campaign",
                    ...cForm,
                    sendNow: true,
                  }),
                });
                await load();
              }}
            >
              Send / save
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-2">
        {campaigns.map((c) => (
          <li
            key={c.id}
            className="rounded-[6px] border border-[var(--border)] p-3 text-sm"
          >
            <p className="font-medium">
              {c.name} · {c.channel} · {c.status}
            </p>
            <p className="text-xs text-[var(--muted)]">{c.message}</p>
          </li>
        ))}
      </ul>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Coupon code"
            value={couponForm.code}
            onChange={(e) =>
              setCouponForm({ ...couponForm, code: e.target.value })
            }
          />
          <select
            className="h-10 rounded-[6px] border border-[var(--border)] px-2 text-sm"
            value={couponForm.type}
            onChange={(e) =>
              setCouponForm({ ...couponForm, type: e.target.value })
            }
          >
            <option value="PERCENT">%</option>
            <option value="FLAT">Flat ₹</option>
          </select>
          <Input
            className="w-24"
            value={couponForm.value}
            onChange={(e) =>
              setCouponForm({ ...couponForm, value: e.target.value })
            }
          />
          <Button
            onClick={async () => {
              await apiFetch("/api/marketing", {
                method: "POST",
                branchId: activeBranchId,
                body: JSON.stringify({
                  kind: "coupon",
                  code: couponForm.code,
                  type: couponForm.type,
                  value: Number(couponForm.value),
                }),
              });
              await load();
            }}
          >
            Create coupon
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {coupons.map((c) => (
          <span
            key={c.id}
            className="rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            <span className="font-mono font-semibold">{c.code}</span> ·{" "}
            {c.type === "PERCENT" ? `${c.value}%` : `₹${c.value}`} · used{" "}
            {c.redeemedCount}
          </span>
        ))}
      </div>
    </div>
  );
}
