"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TablePageSkeleton } from "@/components/ui/Skeleton";

export default function ReservationsPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const canEdit = hasPermission("tables.update");
  const [rows, setRows] = useState<
    {
      id: string;
      guestName: string;
      phone: string;
      partySize: number;
      scheduledAt: string;
      status: string;
      notes: string;
    }[]
  >([]);
  const [form, setForm] = useState({
    guestName: "",
    phone: "",
    partySize: "2",
    scheduledAt: "",
    notes: "",
    status: "BOOKED",
  });
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const data = await apiFetch("/api/reservations", {
        branchId: activeBranchId,
      });
      setRows(data.reservations);
    } finally {
      setReady(true);
    }
  }, [activeBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return <TablePageSkeleton />;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reservations</h1>
      <p className="text-sm text-[var(--muted)]">
        Bookings · waitlist · no-show tracking
      </p>
      {canEdit ? (
        <div className="flex flex-wrap gap-2 rounded-[6px] border border-[var(--border)] p-3">
          <Input
            placeholder="Guest"
            value={form.guestName}
            onChange={(e) => setForm({ ...form, guestName: e.target.value })}
          />
          <Input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            className="w-20"
            value={form.partySize}
            onChange={(e) => setForm({ ...form, partySize: e.target.value })}
          />
          <Input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) =>
              setForm({ ...form, scheduledAt: e.target.value })
            }
          />
          <select
            className="h-10 rounded-[6px] border border-[var(--border)] px-2 text-sm"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="BOOKED">Booked</option>
            <option value="WAITLIST">Waitlist</option>
            <option value="CONFIRMED">Confirmed</option>
          </select>
          <Button
            onClick={async () => {
              await apiFetch("/api/reservations", {
                method: "POST",
                branchId: activeBranchId,
                body: JSON.stringify({
                  ...form,
                  partySize: Number(form.partySize),
                  scheduledAt: new Date(form.scheduledAt).toISOString(),
                }),
              });
              await load();
            }}
          >
            Add booking
          </Button>
        </div>
      ) : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[var(--border)] p-3 text-sm"
          >
            <div>
              <p className="font-medium">
                {r.guestName} · {r.partySize}p · {r.status}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {new Date(r.scheduledAt).toLocaleString("en-IN")} · {r.phone}
              </p>
            </div>
            {canEdit ? (
              <div className="flex flex-wrap gap-1">
                {["CONFIRMED", "SEATED", "COMPLETED", "NO_SHOW", "CANCELLED"].map(
                  (st) => (
                    <Button
                      key={st}
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        await apiFetch("/api/reservations", {
                          method: "PATCH",
                          branchId: activeBranchId,
                          body: JSON.stringify({ id: r.id, status: st }),
                        });
                        await load();
                      }}
                    >
                      {st}
                    </Button>
                  )
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
