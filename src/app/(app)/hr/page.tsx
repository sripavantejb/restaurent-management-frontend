"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TablePageSkeleton } from "@/components/ui/Skeleton";
import { apiUrl } from "@/lib/api-url";
import { formatMoney } from "@/lib/money";

type Tab = "overview" | "attendance" | "leaves" | "payroll" | "staff";

type Overview = {
  today: string;
  period: string;
  headcount: number;
  present: number;
  late: number;
  onLeave: number;
  absent: number;
  pendingLeaves: number;
  leaveDaysMonth: number;
  payrollTotalPaise: number;
  payrollRows: number;
  byRole: Record<string, number>;
  staff: { id: string; name: string; role: string }[];
};

type AttRow = {
  userId: string;
  name: string;
  role: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
};

type MonthMatrix = {
  period: string;
  days: string[];
  matrix: {
    userId: string;
    name: string;
    role: string;
    days: Record<string, { status: string }>;
    summary: { present: number; late: number; leave: number; absent: number };
  }[];
};

type LeaveRow = {
  id: string;
  userId: string;
  name: string;
  role: string;
  type: string;
  status: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  reviewNote: string;
};

type Balance = {
  userId: string;
  name: string;
  role: string;
  year: string;
  byType: {
    type: string;
    entitled: number;
    used: number;
    remaining: number;
  }[];
  totalUsed: number;
  totalRemaining: number;
};

type PayrollRow = {
  name: string;
  email: string;
  role: string;
  period: string;
  daysPresent: number;
  daysLeave: number;
  basePaise: number;
  netPaise: number;
  netInr: number;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "attendance", label: "Attendance" },
  { id: "leaves", label: "Leaves" },
  { id: "payroll", label: "Payroll" },
  { id: "staff", label: "Staff" },
];

const LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "UNPAID", "COMP_OFF"] as const;

function periodNow() {
  return new Date().toISOString().slice(0, 7);
}

function todayNow() {
  return new Date().toISOString().slice(0, 10);
}

function statusColor(status: string) {
  switch (status) {
    case "PRESENT":
      return "text-emerald-700";
    case "LATE":
      return "text-amber-700";
    case "LEAVE":
      return "text-sky-700";
    case "ABSENT":
      return "text-red-700";
    case "APPROVED":
      return "text-emerald-700";
    case "PENDING":
      return "text-amber-700";
    case "REJECTED":
    case "CANCELLED":
      return "text-red-700";
    default:
      return "text-[var(--muted)]";
  }
}

function dayCell(status: string) {
  const letter =
    status === "PRESENT"
      ? "P"
      : status === "LATE"
        ? "L"
        : status === "LEAVE"
          ? "V"
          : status === "ABSENT"
            ? "A"
            : "·";
  const bg =
    status === "PRESENT"
      ? "bg-emerald-100 text-emerald-800"
      : status === "LATE"
        ? "bg-amber-100 text-amber-800"
        : status === "LEAVE"
          ? "bg-sky-100 text-sky-800"
          : status === "ABSENT"
            ? "bg-red-100 text-red-800"
            : "bg-[var(--surface-2)] text-[var(--muted)]";
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold ${bg}`}
      title={status}
    >
      {letter}
    </span>
  );
}

export default function HrPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [period, setPeriod] = useState(periodNow);
  const [date, setDate] = useState(todayNow);
  const [staffFilter, setStaffFilter] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [attRows, setAttRows] = useState<AttRow[]>([]);
  const [month, setMonth] = useState<MonthMatrix | null>(null);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("ALL");
  const [attView, setAttView] = useState<"day" | "month">("day");

  const [leaveForm, setLeaveForm] = useState({
    userId: "",
    type: "CASUAL" as (typeof LEAVE_TYPES)[number],
    fromDate: todayNow(),
    toDate: todayNow(),
    reason: "",
    autoApprove: false,
  });

  const staffOptions = useMemo(
    () => overview?.staff ?? [],
    [overview?.staff]
  );

  const loadOverview = useCallback(async () => {
    if (!activeBranchId) return;
    const data = await apiFetch("/api/hr/overview", {
      branchId: activeBranchId,
    });
    setOverview(data);
    if (!leaveForm.userId && data.staff?.[0]) {
      setLeaveForm((f) => ({ ...f, userId: data.staff[0].id }));
    }
  }, [activeBranchId, leaveForm.userId]);

  const loadAttendance = useCallback(async () => {
    if (!activeBranchId) return;
    const q = staffFilter ? `&userId=${staffFilter}` : "";
    if (attView === "month") {
      const data = await apiFetch(
        `/api/hr/attendance?period=${period}${q}`,
        { branchId: activeBranchId }
      );
      setMonth(data);
    } else {
      const data = await apiFetch(
        `/api/hr/attendance?date=${date}${q}`,
        { branchId: activeBranchId }
      );
      setAttRows(data.attendance);
      setDate(data.date);
    }
  }, [activeBranchId, attView, date, period, staffFilter]);

  const loadLeaves = useCallback(async () => {
    if (!activeBranchId) return;
    const parts = [`period=${period}`];
    if (staffFilter) parts.push(`userId=${staffFilter}`);
    if (leaveStatusFilter !== "ALL") {
      parts.push(`status=${leaveStatusFilter}`);
    }
    const data = await apiFetch(`/api/hr/leaves?${parts.join("&")}`, {
      branchId: activeBranchId,
    });
    setLeaves(data.leaves);
    setBalances(data.balances);
  }, [activeBranchId, period, staffFilter, leaveStatusFilter]);

  const loadPayroll = useCallback(async () => {
    if (!activeBranchId) return;
    const data = await apiFetch(`/api/hr/payroll?period=${period}`, {
      branchId: activeBranchId,
    });
    setPayroll(data.rows);
  }, [activeBranchId, period]);

  const loadAll = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      await loadOverview();
      if (tab === "attendance" || tab === "overview") await loadAttendance();
      if (tab === "leaves" || tab === "overview") await loadLeaves();
      if (tab === "payroll") await loadPayroll();
    } finally {
      setReady(true);
    }
  }, [
    activeBranchId,
    tab,
    loadOverview,
    loadAttendance,
    loadLeaves,
    loadPayroll,
  ]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function markAttendance(
    userId: string,
    action: "checkin" | "checkout" | "leave" | "absent" | "present"
  ) {
    setBusy(true);
    try {
      await apiFetch("/api/hr/attendance", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({ userId, action, date }),
      });
      await loadAttendance();
      await loadOverview();
    } finally {
      setBusy(false);
    }
  }

  async function reviewLeave(
    id: string,
    action: "approve" | "reject" | "cancel"
  ) {
    setBusy(true);
    try {
      await apiFetch(`/api/hr/leaves/${id}`, {
        method: "PATCH",
        branchId: activeBranchId,
        body: JSON.stringify({ action }),
      });
      await loadLeaves();
      await loadOverview();
      await loadAttendance();
    } finally {
      setBusy(false);
    }
  }

  async function submitLeave() {
    if (!leaveForm.userId) return;
    setBusy(true);
    try {
      await apiFetch("/api/hr/leaves", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify(leaveForm),
      });
      setLeaveForm((f) => ({ ...f, reason: "" }));
      await loadLeaves();
      await loadOverview();
      await loadAttendance();
    } finally {
      setBusy(false);
    }
  }

  async function buildPayroll() {
    setBusy(true);
    try {
      await apiFetch("/api/hr/payroll", {
        method: "POST",
        branchId: activeBranchId,
        body: "{}",
      });
      await loadPayroll();
      await loadOverview();
    } finally {
      setBusy(false);
    }
  }

  async function exportPayrollCsv() {
    const res = await fetch(
      apiUrl(`/api/hr/payroll?format=csv&period=${period}`),
      {
        credentials: "include",
        headers: activeBranchId
          ? { "x-branch-id": activeBranchId }
          : undefined,
      }
    );
    if (!res.ok) {
      window.alert("Payroll export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!hasPermission("users.manage")) {
    return (
      <div className="p-6 text-sm text-[var(--muted)]">
        Managers can manage HR. Staff profiles remain under Waiters.
      </div>
    );
  }

  if (!ready) return <TablePageSkeleton />;

  const filteredBalances = staffFilter
    ? balances.filter((b) => b.userId === staffFilter)
    : balances;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">HR</h1>
          <p className="text-sm text-[var(--muted)]">
            Attendance, leaves, balances, and payroll
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-[var(--muted)]">
            Month
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="mt-1 w-[150px]"
            />
          </label>
          <label className="text-xs text-[var(--muted)]">
            Staff
            <select
              className="mt-1 block h-10 w-[180px] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
            >
              <option value="">All staff</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-[6px] px-3 py-1.5 text-sm ${
              tab === t.id
                ? "bg-[var(--ink)] text-white"
                : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && overview && (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-4">
            {[
              ["Headcount", overview.headcount],
              ["Present today", overview.present],
              ["Late", overview.late],
              ["On leave", overview.onLeave],
              ["Absent", overview.absent],
              ["Pending leaves", overview.pendingLeaves],
              ["Leave days (month)", overview.leaveDaysMonth],
              [
                "Payroll (month)",
                formatMoney(overview.payrollTotalPaise),
              ],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                className="rounded-[6px] border border-[var(--border)] px-3 py-3"
              >
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  {label}
                </p>
                <p className="num mt-1 text-lg font-semibold">{val}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[6px] border border-[var(--border)] p-3">
            <p className="mb-2 text-sm font-medium">Team by role</p>
            <div className="flex flex-wrap gap-2 text-sm">
              {Object.entries(overview.byRole).map(([role, n]) => (
                <span
                  key={role}
                  className="rounded-[6px] bg-[var(--surface-2)] px-2 py-1"
                >
                  {role} · {n}
                </span>
              ))}
            </div>
          </div>
          {overview.pendingLeaves > 0 && (
            <p className="text-sm text-amber-700">
              {overview.pendingLeaves} leave request
              {overview.pendingLeaves === 1 ? "" : "s"} awaiting approval — open
              Leaves tab.
            </p>
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={attView === "day" ? "primary" : "secondary"}
                onClick={() => setAttView("day")}
              >
                Day
              </Button>
              <Button
                size="sm"
                variant={attView === "month" ? "primary" : "secondary"}
                onClick={() => setAttView("month")}
              >
                Month
              </Button>
            </div>
            {attView === "day" && (
              <label className="text-xs text-[var(--muted)]">
                Date
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-[160px]"
                />
              </label>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void loadAttendance()}
            >
              Refresh
            </Button>
          </div>

          {attView === "day" ? (
            <ul className="space-y-2">
              {attRows.map((r) => (
                <li
                  key={r.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[var(--border)] p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {r.name} · {r.role}
                    </p>
                    <p className={`text-xs ${statusColor(r.status)}`}>
                      {r.status}
                      {r.checkInAt
                        ? ` · in ${new Date(r.checkInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                      {r.checkOutAt
                        ? ` · out ${new Date(r.checkOutAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void markAttendance(r.userId, "checkin")}
                    >
                      Check in
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void markAttendance(r.userId, "checkout")}
                    >
                      Check out
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void markAttendance(r.userId, "leave")}
                    >
                      Leave
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void markAttendance(r.userId, "absent")}
                    >
                      Absent
                    </Button>
                  </div>
                </li>
              ))}
              {attRows.length === 0 && (
                <p className="text-sm text-[var(--muted)]">No staff found.</p>
              )}
            </ul>
          ) : month ? (
            <div className="space-y-3 overflow-x-auto">
              <p className="text-xs text-[var(--muted)]">
                P present · L late · V leave · A absent
              </p>
              {month.matrix.map((row) => (
                <div
                  key={row.userId}
                  className="min-w-[640px] rounded-[6px] border border-[var(--border)] p-3"
                >
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">
                      {row.name}{" "}
                      <span className="text-[var(--muted)]">· {row.role}</span>
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      P{row.summary.present} L{row.summary.late} V
                      {row.summary.leave} A{row.summary.absent}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {month.days.map((d) => (
                      <div key={d} className="text-center">
                        <p className="mb-0.5 text-[9px] text-[var(--muted)]">
                          {d.slice(8)}
                        </p>
                        {dayCell(row.days[d]?.status ?? "—")}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {tab === "leaves" && (
        <div className="space-y-6">
          <div className="rounded-[6px] border border-[var(--border)] p-4">
            <p className="mb-3 text-sm font-medium">Request leave</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-[var(--muted)]">
                Employee
                <select
                  className="mt-1 block h-10 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
                  value={leaveForm.userId}
                  onChange={(e) =>
                    setLeaveForm((f) => ({ ...f, userId: e.target.value }))
                  }
                >
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[var(--muted)]">
                Type
                <select
                  className="mt-1 block h-10 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
                  value={leaveForm.type}
                  onChange={(e) =>
                    setLeaveForm((f) => ({
                      ...f,
                      type: e.target.value as (typeof LEAVE_TYPES)[number],
                    }))
                  }
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[var(--muted)]">
                From
                <Input
                  type="date"
                  className="mt-1"
                  value={leaveForm.fromDate}
                  onChange={(e) =>
                    setLeaveForm((f) => ({ ...f, fromDate: e.target.value }))
                  }
                />
              </label>
              <label className="text-xs text-[var(--muted)]">
                To
                <Input
                  type="date"
                  className="mt-1"
                  value={leaveForm.toDate}
                  onChange={(e) =>
                    setLeaveForm((f) => ({ ...f, toDate: e.target.value }))
                  }
                />
              </label>
              <label className="text-xs text-[var(--muted)] sm:col-span-2">
                Reason
                <Input
                  className="mt-1"
                  value={leaveForm.reason}
                  onChange={(e) =>
                    setLeaveForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={leaveForm.autoApprove}
                  onChange={(e) =>
                    setLeaveForm((f) => ({
                      ...f,
                      autoApprove: e.target.checked,
                    }))
                  }
                />
                Auto-approve
              </label>
              <Button disabled={busy} onClick={() => void submitLeave()}>
                Submit leave
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Leave balances ({period.slice(0, 4)})</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBalances.map((b) => (
                <div
                  key={b.userId}
                  className="rounded-[6px] border border-[var(--border)] p-3 text-sm"
                >
                  <p className="font-medium">
                    {b.name}{" "}
                    <span className="text-[var(--muted)]">· {b.role}</span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Used {b.totalUsed} · Remaining {b.totalRemaining}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {b.byType
                      .filter((t) => t.type !== "UNPAID")
                      .map((t) => (
                        <li key={t.type} className="flex justify-between">
                          <span>{t.type}</span>
                          <span className="num">
                            {t.used}/{t.entitled}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Requests · {period}</p>
              <select
                className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                value={leaveStatusFilter}
                onChange={(e) => setLeaveStatusFilter(e.target.value)}
              >
                {["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  )
                )}
              </select>
            </div>
            <ul className="space-y-2">
              {leaves.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[var(--border)] p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {l.name} · {l.type}{" "}
                      <span className={statusColor(l.status)}>
                        · {l.status}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {l.fromDate} → {l.toDate} · {l.days} day
                      {l.days === 1 ? "" : "s"}
                      {l.reason ? ` · ${l.reason}` : ""}
                    </p>
                  </div>
                  {l.status === "PENDING" && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void reviewLeave(l.id, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => void reviewLeave(l.id, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  {(l.status === "PENDING" || l.status === "APPROVED") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void reviewLeave(l.id, "cancel")}
                    >
                      Cancel
                    </Button>
                  )}
                </li>
              ))}
              {leaves.length === 0 && (
                <p className="text-sm text-[var(--muted)]">
                  No leave requests for this filter.
                </p>
              )}
            </ul>
          </div>
        </div>
      )}

      {tab === "payroll" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void buildPayroll()}>
              Rebuild from attendance
            </Button>
            <Button
              variant="secondary"
              onClick={() => void exportPayrollCsv()}
            >
              Export CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadPayroll()}
            >
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto rounded-[6px] border border-[var(--border)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Present</th>
                  <th className="px-3 py-2 font-medium">Leave</th>
                  <th className="px-3 py-2 font-medium">Base</th>
                  <th className="px-3 py-2 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {payroll.map((r) => (
                  <tr
                    key={`${r.email}-${r.period}`}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-[var(--muted)]">{r.email}</p>
                    </td>
                    <td className="px-3 py-2">{r.role}</td>
                    <td className="num px-3 py-2">{r.daysPresent}</td>
                    <td className="num px-3 py-2">{r.daysLeave}</td>
                    <td className="num px-3 py-2">
                      {formatMoney(r.basePaise)}
                    </td>
                    <td className="num px-3 py-2 font-medium">
                      {formatMoney(r.netPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payroll.length === 0 && (
              <p className="p-4 text-sm text-[var(--muted)]">
                No payroll rows yet — click Rebuild from attendance.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "staff" && overview && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted)]">
            Active branch staff · open Leaves or Attendance with the staff
            filter for individual history.
          </p>
          <ul className="divide-y divide-[var(--border)] rounded-[6px] border border-[var(--border)]">
            {overview.staff
              .filter((s) => !staffFilter || s.id === staffFilter)
              .map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-[var(--muted)]">{s.role}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setStaffFilter(s.id);
                        setTab("leaves");
                      }}
                    >
                      Leaves
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setStaffFilter(s.id);
                        setAttView("month");
                        setTab("attendance");
                      }}
                    >
                      Month attendance
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
