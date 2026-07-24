"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatMoney } from "@/lib/money";

interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  total: number;
  placedAt: string | null;
  items: { name: string; qty: number; unitPrice: number; notes: string }[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
}

export default function OrdersPage() {
  const { activeBranchId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [payment, setPayment] = useState<{
    method: string;
    amount: number;
    paidAt: string;
  } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      const data = await apiFetch(`/api/orders?${params}`, {
        branchId: activeBranchId,
      });
      setOrders(data.orders);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    }
  }, [activeBranchId, status, type, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(order: Order) {
    setSelected(order);
    try {
      const data = await apiFetch(`/api/orders/${order.id}`, {
        branchId: activeBranchId,
      });
      setPayment(data.payment);
    } catch {
      setPayment(null);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Filter by date, status, or type. Click a row for the full bill.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          className="h-10 rounded-[6px] border border-[var(--border)] bg-white px-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {["PLACED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            )
          )}
        </select>
        <select
          className="h-10 rounded-[6px] border border-[var(--border)] bg-white px-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All types</option>
          <option value="DINE_IN">Dine-in</option>
          <option value="TAKEAWAY">Takeaway</option>
        </select>
        <Input type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button variant="secondary" onClick={() => void load()}>
          Apply
        </Button>
      </div>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-auto rounded-[6px] border border-[var(--border)] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Placed</th>
              <th className="px-3 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">
                  No orders in this range. Place one from POS or widen the filters.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={o.id}
                  className="cursor-pointer border-b border-[var(--border)] hover:bg-[var(--surface-2)]"
                  onClick={() => void openDetail(o)}
                >
                  <td className="num px-3 py-2.5 font-medium">{o.orderNumber}</td>
                  <td className="px-3 py-2.5">{o.type}</td>
                  <td className="px-3 py-2.5">
                    <Badge
                      tone={
                        o.status === "COMPLETED"
                          ? "success"
                          : o.status === "CANCELLED"
                            ? "danger"
                            : "accent"
                      }
                    >
                      {o.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    {o.placedAt
                      ? new Date(o.placedAt).toLocaleString("en-IN")
                      : "—"}
                  </td>
                  <td className="num px-3 py-2.5 text-right">{formatMoney(o.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Order ${selected.orderNumber}` : "Order"}
      >
        {selected ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Badge>{selected.type}</Badge>
              <Badge tone="accent">{selected.status}</Badge>
            </div>
            <ul className="space-y-2 border-y border-[var(--border)] py-3">
              {selected.items.map((it, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span>
                    {it.qty}× {it.name}
                    {it.notes ? (
                      <span className="block font-semibold text-[var(--accent)]">
                        {it.notes}
                      </span>
                    ) : null}
                  </span>
                  <span className="num">{formatMoney(it.unitPrice * it.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-[var(--muted)]">
                <span>Subtotal</span>
                <span className="num">{formatMoney(selected.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[var(--muted)]">
                <span>Discount</span>
                <span className="num">−{formatMoney(selected.discountAmount)}</span>
              </div>
              <div className="flex justify-between text-[var(--muted)]">
                <span>Tax</span>
                <span className="num">{formatMoney(selected.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span className="num">{formatMoney(selected.total)}</span>
              </div>
            </div>
            {payment ? (
              <p className="rounded-[6px] bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]">
                Paid via {payment.method} · {formatMoney(payment.amount)} ·{" "}
                {new Date(payment.paidAt).toLocaleString("en-IN")}
              </p>
            ) : selected.status !== "CANCELLED" && selected.status !== "COMPLETED" ? (
              <div className="space-y-2">
                <p className="text-sm text-[var(--muted)]">
                  Unpaid. Collect with UPI / Card / Cash below (cashier).
                </p>
                <div className="flex gap-2">
                  {(["UPI", "CARD", "CASH"] as const).map((m) => (
                    <Button
                      key={m}
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await apiFetch("/api/payments", {
                            method: "POST",
                            branchId: activeBranchId,
                            body: JSON.stringify({
                              orderId: selected.id,
                              method: m,
                              tenderedAmount:
                                m === "CASH"
                                  ? selected.total + 10000
                                  : selected.total,
                            }),
                          });
                          setSelected(null);
                          void load();
                        } catch (e) {
                          setError(
                            e instanceof Error ? e.message : "Payment failed"
                          );
                        }
                      }}
                    >
                      Pay {m}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">No payment on file.</p>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
