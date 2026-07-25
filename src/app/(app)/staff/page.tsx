"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatMoney } from "@/lib/money";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface WaiterPerf {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  orders: number;
  completed: number;
  items: number;
  revenue: number;
  avgTicket: number;
}

export default function StaffPage() {
  const { activeBranchId, hasPermission, branches } = useAuth();
  const canManage = hasPermission("users.manage");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [perf, setPerf] = useState<WaiterPerf[]>([]);
  const [days, setDays] = useState(7);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "WAITER",
  });

  const load = useCallback(async () => {
    if (!activeBranchId || !canManage) return;
    try {
      const [u, p] = await Promise.all([
        apiFetch("/api/users?role=WAITER", { branchId: activeBranchId }),
        apiFetch(`/api/reports/waiters?days=${days}`, {
          branchId: activeBranchId,
        }),
      ]);
      setUsers(u.users);
      setPerf(p.waiters);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff");
    }
  }, [activeBranchId, canManage, days]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createWaiter() {
    setBusy(true);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify(form),
      });
      setCreateOpen(false);
      setForm({ name: "", email: "", password: "", role: "WAITER" });
      setToast("Waiter created");
      setTimeout(() => setToast(""), 2500);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: StaffUser) {
    setBusy(true);
    try {
      await apiFetch("/api/users", {
        method: "PATCH",
        branchId: activeBranchId,
        body: JSON.stringify({ id: u.id, isActive: !u.isActive }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Waiters</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Owner or manager access required to manage waiters.
        </p>
      </div>
    );
  }

  const branchName =
    branches.find((b) => b.id === activeBranchId)?.name ?? "Branch";

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Waiters</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage accounts and track performance for {branchName}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toast ? (
            <span className="rounded-[6px] bg-[var(--success)]/15 px-3 py-1 text-sm text-[var(--success)]">
              {toast}
            </span>
          ) : null}
          <select
            className="h-10 rounded-[6px] border border-[var(--border)] bg-white px-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <Button onClick={() => setCreateOpen(true)}>Add waiter</Button>
          <a href="/waiter">
            <Button variant="secondary">Open waiter floor</Button>
          </a>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[6px] border border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] px-4 py-3 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
            Accounts · {users.length}
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {users.length === 0 ? (
              <li className="px-4 py-8 text-sm text-[var(--muted)]">
                No waiters yet. Add one to use the Waiter floor page.
              </li>
            ) : (
              users.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {u.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={u.isActive ? "success" : "neutral"}>
                      {u.isActive ? "Active" : "Off"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void toggleActive(u)}
                    >
                      {u.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-[6px] border border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] px-4 py-3 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
            Performance · {days}d
          </div>
          <div className="space-y-2 p-3 sm:hidden">
            {perf.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted)]">
                No waiter orders in this window yet.
              </p>
            ) : (
              perf.map((w) => (
                <div
                  key={w.id}
                  className="rounded-[6px] border border-[var(--border)] p-3"
                >
                  <p className="font-medium">
                    {w.name}
                    {!w.isActive ? (
                      <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                        inactive
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-2 flex justify-between text-sm text-[var(--muted)]">
                    <span className="num">{w.orders} orders</span>
                    <span className="num">{formatMoney(w.revenue)}</span>
                    <span className="num">avg {formatMoney(w.avgTicket)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden overflow-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Waiter</th>
                  <th className="px-3 py-2 font-medium">Orders</th>
                  <th className="px-3 py-2 font-medium text-right">Revenue</th>
                  <th className="px-3 py-2 font-medium text-right">Avg</th>
                </tr>
              </thead>
              <tbody>
                {perf.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-[var(--muted)]"
                    >
                      No waiter orders in this window yet.
                    </td>
                  </tr>
                ) : (
                  perf.map((w) => (
                    <tr key={w.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{w.name}</p>
                        {!w.isActive ? (
                          <span className="text-xs text-[var(--muted)]">
                            inactive
                          </span>
                        ) : null}
                      </td>
                      <td className="num px-3 py-2.5">{w.orders}</td>
                      <td className="num px-3 py-2.5 text-right">
                        {formatMoney(w.revenue)}
                      </td>
                      <td className="num px-3 py-2.5 text-right">
                        {formatMoney(w.avgTicket)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add waiter"
      >
        <div className="space-y-3">
          <label className="block text-xs text-[var(--muted)]">
            Name
            <Input
              className="mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Login email
            <Input
              className="mt-1"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Temporary password
            <Input
              className="mt-1"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <Button
            className="w-full"
            disabled={
              busy || !form.name.trim() || !form.email.trim() || form.password.length < 6
            }
            onClick={() => void createWaiter()}
          >
            Create waiter
          </Button>
        </div>
      </Modal>
    </div>
  );
}
