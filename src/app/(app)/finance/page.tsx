"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/money";
import { ConsolePageSkeleton } from "@/components/ui/Skeleton";

export default function FinancePage() {
  const { activeBranchId, hasPermission } = useAuth();
  const canEdit = hasPermission("inventory.finance");
  const [expenses, setExpenses] = useState<
    {
      id: string;
      category: string;
      description: string;
      amountPaise: number;
      paidAt: string;
      vendor: string;
    }[]
  >([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [pnl, setPnl] = useState<{
    revenuePaise: number;
    expensesPaise: number;
    profitPaise: number;
    taxPaise: number;
  } | null>(null);
  const [form, setForm] = useState({
    category: "Utilities",
    description: "",
    amount: "",
    vendor: "",
  });
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const [list, report] = await Promise.all([
        apiFetch("/api/finance/expenses", { branchId: activeBranchId }),
        apiFetch("/api/finance/expenses?report=pnl", {
          branchId: activeBranchId,
        }),
      ]);
      setExpenses(list.expenses);
      setTodayTotal(list.todayTotalPaise);
      setPnl(report.pnl);
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

  if (!ready) return <ConsolePageSkeleton />;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          ["Revenue (MTD)", pnl?.revenuePaise],
          ["Expenses (MTD)", pnl?.expensesPaise],
          ["Profit (MTD)", pnl?.profitPaise],
          ["Today expenses", todayTotal],
        ].map(([label, val]) => (
          <div
            key={String(label)}
            className="rounded-[6px] border border-[var(--border)] px-3 py-3"
          >
            <p className="text-[10px] uppercase text-[var(--muted)]">{label}</p>
            <p className="num mt-1 text-lg font-semibold">
              {formatMoney(Number(val) || 0)}
            </p>
          </div>
        ))}
      </div>
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <Input
            placeholder="Amount ₹"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <Input
            placeholder="Vendor"
            value={form.vendor}
            onChange={(e) => setForm({ ...form, vendor: e.target.value })}
          />
          <Button
            onClick={async () => {
              await apiFetch("/api/finance/expenses", {
                method: "POST",
                branchId: activeBranchId,
                body: JSON.stringify({
                  category: form.category,
                  description: form.description,
                  vendor: form.vendor,
                  amountPaise: Math.round(Number(form.amount) * 100),
                }),
              });
              setForm({ ...form, amount: "", vendor: "" });
              await load();
            }}
          >
            Add expense
          </Button>
        </div>
      ) : null}
      <ul className="space-y-2">
        {expenses.map((e) => (
          <li
            key={e.id}
            className="rounded-[6px] border border-[var(--border)] px-3 py-2 text-sm"
          >
            <span className="font-medium">{e.category}</span>
            <span className="num ml-2">{formatMoney(e.amountPaise)}</span>
            <span className="ml-2 text-xs text-[var(--muted)]">
              {e.vendor} · {new Date(e.paidAt).toLocaleDateString("en-IN")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
