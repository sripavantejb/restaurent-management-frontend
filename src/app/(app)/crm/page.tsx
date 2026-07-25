"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/money";

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
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    const data = await apiFetch(
      `/api/crm/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      { branchId: activeBranchId }
    );
    setCustomers(data.customers);
  }, [activeBranchId, q]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hasPermission("reports.view")) {
    return <div className="p-6 text-sm text-[var(--muted)]">No access</div>;
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
      <p className="text-sm text-[var(--muted)]">
        Customers · loyalty · wallet · membership
      </p>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
