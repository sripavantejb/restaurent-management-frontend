"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoney, toPaise } from "@/lib/money";
import { TablePageSkeleton } from "@/components/ui/Skeleton";

export default function CrmPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const [customers, setCustomers] = useState<
    {
      id: string;
      name: string;
      phone: string;
      loyaltyPoints: number;
      walletPaise: number;
      membership: string;
      totalSpendPaise: number;
      visitCount: number;
    }[]
  >([]);
  const [coupons, setCoupons] = useState<
    {
      id: string;
      code: string;
      type: string;
      value: number;
      redeemedCount: number;
      maxRedemptions: number;
      isActive: boolean;
    }[]
  >([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [couponForm, setCouponForm] = useState({
    code: "",
    type: "PERCENT" as "PERCENT" | "FLAT",
    value: "10",
  });
  const [q, setQ] = useState("");
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const [data, coup] = await Promise.all([
        apiFetch(
          `/api/crm/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`,
          { branchId: activeBranchId }
        ),
        apiFetch("/api/coupons", { branchId: activeBranchId }).catch(() => ({
          coupons: [],
        })),
      ]);
      setCustomers(data.customers);
      setCoupons(coup.coupons ?? []);
    } finally {
      setReady(true);
    }
  }, [activeBranchId, q]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hasPermission("reports.view")) {
    return <div className="p-6 text-sm text-[var(--muted)]">No access</div>;
  }

  if (!ready) return <TablePageSkeleton />;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
        <p className="text-sm text-[var(--muted)]">
          Customers · loyalty · wallet · coupons
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Button
          onClick={async () => {
            await apiFetch("/api/crm/customers", {
              method: "POST",
              branchId: activeBranchId,
              body: JSON.stringify(form),
            });
            setForm({ name: "", phone: "", email: "" });
            await load();
          }}
        >
          Add customer
        </Button>
      </div>

      <div className="overflow-auto rounded-[6px] border border-[var(--border)]">
        <div className="table-scroll">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Visits</th>
              <th className="px-3 py-2">Loyalty</th>
              <th className="px-3 py-2">Wallet</th>
              <th className="px-3 py-2">Spend</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <p className="font-medium">{c.name || "—"}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {c.phone} · {c.membership}
                  </p>
                </td>
                <td className="num px-3 py-2">{c.visitCount}</td>
                <td className="num px-3 py-2">{c.loyaltyPoints}</td>
                <td className="num px-3 py-2">
                  {formatMoney(c.walletPaise)}
                </td>
                <td className="num px-3 py-2">
                  {formatMoney(c.totalSpendPaise)}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        await apiFetch("/api/crm/customers", {
                          method: "PATCH",
                          branchId: activeBranchId,
                          body: JSON.stringify({
                            id: c.id,
                            loyaltyPointsDelta: 10,
                          }),
                        });
                        await load();
                      }}
                    >
                      +10 pts
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        const amt = window.prompt("Top up wallet (₹)", "500");
                        if (!amt) return;
                        const paise = toPaise(Number(amt));
                        if (!paise) return;
                        await apiFetch("/api/crm/customers", {
                          method: "PATCH",
                          branchId: activeBranchId,
                          body: JSON.stringify({
                            id: c.id,
                            walletPaiseDelta: paise,
                          }),
                        });
                        await load();
                      }}
                    >
                      + Wallet
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Coupons</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="CODE"
            value={couponForm.code}
            onChange={(e) =>
              setCouponForm({ ...couponForm, code: e.target.value })
            }
          />
          <select
            className="h-10 rounded-[6px] border border-[var(--border)] px-2 text-sm"
            value={couponForm.type}
            onChange={(e) =>
              setCouponForm({
                ...couponForm,
                type: e.target.value as "PERCENT" | "FLAT",
              })
            }
          >
            <option value="PERCENT">Percent</option>
            <option value="FLAT">Flat ₹</option>
          </select>
          <Input
            placeholder={couponForm.type === "PERCENT" ? "% off" : "₹ off"}
            value={couponForm.value}
            onChange={(e) =>
              setCouponForm({ ...couponForm, value: e.target.value })
            }
          />
          <Button
            onClick={async () => {
              await apiFetch("/api/coupons", {
                method: "POST",
                branchId: activeBranchId,
                body: JSON.stringify({
                  code: couponForm.code,
                  type: couponForm.type,
                  value:
                    couponForm.type === "FLAT"
                      ? toPaise(Number(couponForm.value))
                      : Number(couponForm.value),
                }),
              });
              setCouponForm({ code: "", type: "PERCENT", value: "10" });
              await load();
            }}
          >
            Create coupon
          </Button>
        </div>
        <ul className="space-y-2 text-sm">
          {coupons.map((c) => (
            <li
              key={c.id}
              className="flex justify-between gap-2 rounded-[6px] border border-[var(--border)] px-3 py-2"
            >
              <span className="font-medium">{c.code}</span>
              <span className="text-[var(--muted)]">
                {c.type === "PERCENT"
                  ? `${c.value}%`
                  : formatMoney(c.value)}{" "}
                · {c.redeemedCount}/{c.maxRedemptions}
                {!c.isActive ? " · inactive" : ""}
              </span>
            </li>
          ))}
          {coupons.length === 0 ? (
            <li className="text-[var(--muted)]">No coupons yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
