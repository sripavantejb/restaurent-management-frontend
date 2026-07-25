"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { TablePageSkeleton } from "@/components/ui/Skeleton";
import { apiUrl } from "@/lib/api-url";

export default function HrPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<
    {
      userId: string;
      name: string;
      role: string;
      status: string;
      checkInAt: string | null;
      checkOutAt: string | null;
    }[]
  >([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const data = await apiFetch("/api/hr/attendance", {
        branchId: activeBranchId,
      });
      setDate(data.date);
      setRows(data.attendance);
    } finally {
      setReady(true);
    }
  }, [activeBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hasPermission("users.manage")) {
    return (
      <div className="p-6 text-sm text-[var(--muted)]">
        Managers can manage attendance. Staff profiles remain under Waiters.
      </div>
    );
  }

  if (!ready) return <TablePageSkeleton />;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">HR · Attendance</h1>
      <p className="text-sm text-[var(--muted)]">Today · {date}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            const period = new Date().toISOString().slice(0, 7);
            await apiFetch("/api/hr/payroll", {
              method: "POST",
              branchId: activeBranchId,
              body: "{}",
            });
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
          }}
        >
          Build payroll + export CSV
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.userId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[var(--border)] p-3 text-sm"
          >
            <div>
              <p className="font-medium">
                {r.name} · {r.role}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {r.status}
                {r.checkInAt
                  ? ` · in ${new Date(r.checkInAt).toLocaleTimeString("en-IN")}`
                  : ""}
                {r.checkOutAt
                  ? ` · out ${new Date(r.checkOutAt).toLocaleTimeString("en-IN")}`
                  : ""}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={async () => {
                  await apiFetch("/api/hr/attendance", {
                    method: "POST",
                    branchId: activeBranchId,
                    body: JSON.stringify({
                      userId: r.userId,
                      action: "checkin",
                    }),
                  });
                  await load();
                }}
              >
                Check in
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await apiFetch("/api/hr/attendance", {
                    method: "POST",
                    branchId: activeBranchId,
                    body: JSON.stringify({
                      userId: r.userId,
                      action: "checkout",
                    }),
                  });
                  await load();
                }}
              >
                Check out
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await apiFetch("/api/hr/attendance", {
                    method: "POST",
                    branchId: activeBranchId,
                    body: JSON.stringify({
                      userId: r.userId,
                      action: "leave",
                    }),
                  });
                  await load();
                }}
              >
                Leave
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
