"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/money";

interface PendingOrder {
  id: string;
  orderNumber: string;
  tableId: string | null;
  roundNumber: number | null;
  total: number;
  placedAt: string | null;
  createdAt: string | null;
  items: {
    name: string;
    qty: number;
    unitPrice: number;
    notes: string;
    variant?: string;
    guestLabel?: string;
  }[];
}

export function ApprovalQueue({
  tableNumbers,
}: {
  tableNumbers?: Record<string, number>;
}) {
  const { activeBranchId, hasPermission } = useAuth();
  const canApprove = hasPermission("orders.update");
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const data = await apiFetch("/api/orders?status=pending_approval", {
        branchId: activeBranchId,
      });
      setOrders(data.orders);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approvals");
    }
  }, [activeBranchId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [load]);

  async function act(id: string, action: "APPROVE" | "REJECT") {
    if (!canApprove) return;
    setBusyId(id);
    try {
      await apiFetch(`/api/orders/${id}/approve`, {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
          QR approval queue
        </p>
        {orders.length > 0 ? (
          <Badge tone="warn">{orders.length} waiting</Badge>
        ) : (
          <span className="text-xs text-[var(--muted)]">Clear</span>
        )}
      </div>

      {error ? (
        <p className="px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}

      {orders.length === 0 ? (
        <p className="px-3 py-6 text-sm text-[var(--muted)]">
          No guest rounds waiting. When QR approval mode is on, drafts land here
          before the kitchen.
        </p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-[var(--border)] overflow-auto">
          {orders.map((o) => {
            const tableNo =
              o.tableId && tableNumbers ? tableNumbers[o.tableId] : null;
            return (
              <li key={o.id} className="px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="num text-sm font-semibold">
                      {o.orderNumber}
                      {tableNo != null ? ` · T${tableNo}` : ""}
                      {o.roundNumber != null ? ` · R${o.roundNumber}` : ""}
                    </p>
                    <p className="num mt-0.5 text-sm text-[var(--muted)]">
                      {formatMoney(o.total)}
                    </p>
                  </div>
                  {canApprove ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        disabled={busyId === o.id}
                        onClick={() => void act(o.id, "APPROVE")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busyId === o.id}
                        onClick={() => void act(o.id, "REJECT")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <Badge tone="warn">PENDING</Badge>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {o.items.map((it, i) => (
                    <li key={i} className="text-[var(--ink)]">
                      <span className="num">{it.qty}×</span> {it.name}
                      {it.variant ? ` (${it.variant})` : ""}
                      {it.guestLabel ? (
                        <span className="text-[var(--muted)]"> · {it.guestLabel}</span>
                      ) : null}
                      {it.notes ? (
                        <span className="block text-xs font-medium text-[var(--accent)]">
                          {it.notes}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
