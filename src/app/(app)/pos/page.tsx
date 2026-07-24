"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Search } from "lucide-react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/pos/cartStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { calcTax, calcTotal, formatMoney } from "@/lib/money";

interface Category {
  id: string;
  name: string;
}
interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  variants: { name: string; priceDelta: number }[];
  addons: { name: string; price: number }[];
}
interface TableRow {
  id: string;
  number: number;
  status: string;
}

export default function PosPage() {
  const { user, activeBranchId } = useAuth();
  const cart = useCart();
  const setUserKey = useCart((s) => s.setUserKey);
  const searchRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [catId, setCatId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [tableOpen, setTableOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [configItem, setConfigItem] = useState<MenuItem | null>(null);
  const [cfgVariant, setCfgVariant] = useState("");
  const [cfgAddons, setCfgAddons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [payMethod, setPayMethod] = useState<"CASH" | "CARD" | "UPI">("UPI");
  const [tendered, setTendered] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const [menu, tbl] = await Promise.all([
        apiFetch("/api/menu", { branchId: activeBranchId }),
        apiFetch("/api/tables", { branchId: activeBranchId }),
      ]);
      setCategories(menu.categories);
      setItems(menu.items);
      setTables(tbl.tables);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load menu");
    }
  }, [activeBranchId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (user?.id) setUserKey(user.id);
  }, [user?.id, setUserKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Enter" && document.activeElement === searchRef.current) {
        const first = filtered[0];
        if (first) addItem(first);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, catId, q]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (catId !== "all" && i.categoryId !== catId) return false;
      if (q && !i.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [items, catId, q]);

  function addItem(item: MenuItem) {
    if (!item.isAvailable) return;
    if ((item.variants?.length ?? 0) > 0 || (item.addons?.length ?? 0) > 0) {
      setConfigItem(item);
      setCfgVariant(item.variants[0]?.name ?? "");
      setCfgAddons([]);
      return;
    }
    cart.addLine({
      menuItemId: item.id,
      name: item.name,
      unitPrice: item.price,
      addons: [],
      notes: "",
      isVeg: item.isVeg,
    });
  }

  function confirmConfig() {
    if (!configItem) return;
    const variantDelta =
      configItem.variants.find((v) => v.name === cfgVariant)?.priceDelta ?? 0;
    const addonPrice = configItem.addons
      .filter((a) => cfgAddons.includes(a.name))
      .reduce((s, a) => s + a.price, 0);
    cart.addLine({
      menuItemId: configItem.id,
      name: configItem.name,
      unitPrice: configItem.price + variantDelta + addonPrice,
      variant: cfgVariant,
      addons: cfgAddons,
      notes: "",
      isVeg: configItem.isVeg,
    });
    setConfigItem(null);
  }

  const subtotal = cart.subtotal();
  const discountAmount = cart.discountAmount();
  const taxAmount = calcTax(subtotal, discountAmount);
  const total = calcTotal(subtotal, discountAmount, taxAmount);

  async function sendToKitchen() {
    if (!cart.lines.length) return;
    if (cart.type === "DINE_IN" && !cart.tableId) {
      setTableOpen(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await apiFetch("/api/orders", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({
          type: cart.type,
          tableId: cart.tableId,
          discountAmount,
          items: cart.lines.map((l) => ({
            menuItemId: l.menuItemId,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            variant: l.variant ?? "",
            addons: l.addons,
            notes: l.notes,
          })),
        }),
      });
      setToast(`Order ${data.orderNumber} sent to kitchen`);
      setTimeout(() => setToast(""), 3500);
      cart.clear();
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to place order");
    } finally {
      setBusy(false);
    }
  }

  async function openBillPay() {
    if (!cart.lines.length && !pendingOrderId) return;
    if (cart.type === "DINE_IN" && !cart.tableId && !pendingOrderId) {
      setTableOpen(true);
      return;
    }
    if (!pendingOrderId) {
      setBusy(true);
      try {
        const data = await apiFetch("/api/orders", {
          method: "POST",
          branchId: activeBranchId,
          body: JSON.stringify({
            type: cart.type,
            tableId: cart.tableId,
            discountAmount,
            items: cart.lines.map((l) => ({
              menuItemId: l.menuItemId,
              name: l.name,
              qty: l.qty,
              unitPrice: l.unitPrice,
              variant: l.variant ?? "",
              addons: l.addons,
              notes: l.notes,
            })),
          }),
        });
        setPendingOrderId(data.id);
        setTendered(String(Math.ceil(total / 100) * 100));
        setPayOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create order");
      } finally {
        setBusy(false);
      }
    } else {
      setPayOpen(true);
    }
  }

  async function confirmPay() {
    if (!pendingOrderId) return;
    setBusy(true);
    try {
      const tenderedPaise =
        payMethod === "CASH" ? Math.round(Number(tendered)) : total;
      await apiFetch("/api/payments", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({
          orderId: pendingOrderId,
          method: payMethod,
          tenderedAmount: tenderedPaise,
        }),
      });
      setToast("Payment recorded — table freed");
      setTimeout(() => setToast(""), 3500);
      setPayOpen(false);
      setPendingOrderId(null);
      cart.clear();
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  const statusColor: Record<string, string> = {
    FREE: "bg-[var(--success)]",
    OCCUPIED: "bg-[var(--warn)]",
    BILLED: "bg-sky-500",
    RESERVED: "bg-[var(--muted)]",
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <div className="flex items-center gap-2">
          {(["DINE_IN", "TAKEAWAY"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => cart.setType(t)}
              className={`h-10 rounded-[6px] px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                cart.type === t
                  ? "bg-[var(--ink)] text-white"
                  : "border border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {t === "DINE_IN" ? "Dine-In" : "Takeaway"}
            </button>
          ))}
          {cart.type === "DINE_IN" ? (
            <Button variant="secondary" onClick={() => setTableOpen(true)}>
              {cart.tableNumber ? `Table ${cart.tableNumber}` : "Pick table"}
            </Button>
          ) : null}
        </div>
        {toast ? (
          <p className="rounded-[6px] bg-[var(--success)]/15 px-3 py-1 text-sm text-[var(--success)]">
            {toast}
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error} — refresh or check MongoDB / seed.
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Category rail */}
        <div className="flex w-[200px] shrink-0 flex-col gap-1 overflow-auto border-r border-[var(--border)] p-2">
          <button
            type="button"
            onClick={() => setCatId("all")}
            className={`min-h-12 rounded-[6px] px-3 text-left text-sm font-medium ${
              catId === "all" ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--surface-2)]"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatId(c.id)}
              className={`min-h-12 rounded-[6px] px-3 text-left text-sm font-medium ${
                catId === c.id ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--surface-2)]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Menu grid */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative border-b border-[var(--border)] p-3">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-6 -translate-y-1/2 text-[var(--muted)]"
            />
            <Input
              ref={searchRef}
              className="pl-9"
              placeholder="Search menu — press / to focus"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 overflow-auto p-3 lg:grid-cols-4">
            {filtered.length === 0 ? (
              <p className="col-span-full text-sm text-[var(--muted)]">
                No items match. Clear search or pick another category.
              </p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.isAvailable}
                  onClick={() => addItem(item)}
                  className={`min-h-[96px] rounded-[6px] border border-[var(--border)] p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                    item.isAvailable
                      ? "bg-white hover:border-[var(--accent)]"
                      : "cursor-not-allowed bg-[var(--surface-2)] opacity-50"
                  }`}
                >
                  <span className="mb-1 flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-sm border ${
                        item.isVeg ? "border-green-700 bg-green-600" : "border-red-700 bg-red-600"
                      }`}
                    />
                    <span className="line-clamp-2 text-sm font-medium">{item.name}</span>
                  </span>
                  <span className="num text-sm text-[var(--muted)]">
                    {formatMoney(item.price)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="flex w-[380px] shrink-0 flex-col border-l border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="font-semibold">Current bill</h2>
            <p className="text-xs text-[var(--muted)]">
              {cart.type === "DINE_IN"
                ? cart.tableNumber
                  ? `Table ${cart.tableNumber}`
                  : "No table selected"
                : "Takeaway"}
            </p>
          </div>
          <div className="flex-1 space-y-2 overflow-auto p-3">
            {cart.lines.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Tap a menu item to start the bill.
              </p>
            ) : (
              cart.lines.map((l) => (
                <div key={l.key} className="rounded-[6px] border border-[var(--border)] p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{l.name}</p>
                      {l.variant || l.addons.length ? (
                        <p className="text-xs text-[var(--muted)]">
                          {[l.variant, ...l.addons].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <p className="num text-sm">{formatMoney(l.unitPrice * l.qty)}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-[var(--border)]"
                      onClick={() => cart.updateQty(l.key, l.qty - 1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="num w-6 text-center">{l.qty}</span>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-[var(--border)]"
                      onClick={() => cart.updateQty(l.key, l.qty + 1)}
                    >
                      <Plus size={14} />
                    </button>
                    <Input
                      className="h-9 flex-1 text-xs"
                      placeholder="Notes"
                      value={l.notes}
                      onChange={(e) => cart.setNotes(l.key, e.target.value)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 border-t border-[var(--border)] p-4">
            <div className="flex gap-2">
              <select
                className="h-9 rounded-[6px] border border-[var(--border)] px-2 text-xs"
                value={cart.discountType}
                onChange={(e) =>
                  cart.setDiscount(
                    e.target.value as "flat" | "percent",
                    cart.discountValue
                  )
                }
              >
                <option value="flat">₹ off</option>
                <option value="percent">% off</option>
              </select>
              <Input
                className="h-9"
                type="number"
                min={0}
                value={
                  cart.discountType === "flat"
                    ? cart.discountValue / 100
                    : cart.discountValue
                }
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  cart.setDiscount(
                    cart.discountType,
                    cart.discountType === "flat" ? Math.round(v * 100) : v
                  );
                }}
              />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-[var(--muted)]">
                <span>Subtotal</span>
                <span className="num">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[var(--muted)]">
                <span>Discount</span>
                <span className="num">−{formatMoney(discountAmount)}</span>
              </div>
              <div className="flex justify-between text-[var(--muted)]">
                <span>GST 5%</span>
                <span className="num">{formatMoney(taxAmount)}</span>
              </div>
              <div className="flex justify-between pt-1 text-xl font-semibold">
                <span>Total</span>
                <span className="num">{formatMoney(total)}</span>
              </div>
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={!cart.lines.length || busy}
              onClick={() => void sendToKitchen()}
            >
              Save & Send to Kitchen
            </Button>
            <Button
              className="w-full"
              size="lg"
              variant="secondary"
              disabled={!cart.lines.length || busy}
              onClick={() => void openBillPay()}
            >
              Bill & Pay
            </Button>
          </div>
        </div>
      </div>

      <Modal open={tableOpen} onClose={() => setTableOpen(false)} title="Select table" wide>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Free tables start a new bill. Occupied tables add another round to the open session.
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {tables.map((t) => {
            const selectable = t.status === "FREE" || t.status === "OCCUPIED" || t.status === "BILLED";
            const selected = t.id === cart.tableId;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!selectable}
                onClick={() => {
                  cart.setTable(t.id, t.number);
                  setTableOpen(false);
                }}
                className={`flex min-h-20 flex-col items-center justify-center rounded-[6px] border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)] hover:border-[var(--accent)]"
                }`}
              >
                <span className={`mb-2 h-2.5 w-2.5 rounded-full ${statusColor[t.status]}`} />
                <span className="font-medium">T{t.number}</span>
                <span className="text-xs text-[var(--muted)]">{t.status}</span>
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={!!configItem}
        onClose={() => setConfigItem(null)}
        title={configItem?.name ?? "Configure"}
      >
        {configItem ? (
          <div className="space-y-4">
            {configItem.variants.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--muted)]">Variant</p>
                <div className="flex flex-wrap gap-2">
                  {configItem.variants.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => setCfgVariant(v.name)}
                      className={`h-10 rounded-[6px] border px-3 text-sm ${
                        cfgVariant === v.name
                          ? "border-[var(--accent)] bg-[var(--accent)]/10"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {v.name}
                      {v.priceDelta
                        ? ` (${v.priceDelta > 0 ? "+" : ""}${formatMoney(v.priceDelta)})`
                        : ""}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {configItem.addons.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--muted)]">Add-ons</p>
                <div className="flex flex-wrap gap-2">
                  {configItem.addons.map((a) => {
                    const on = cfgAddons.includes(a.name);
                    return (
                      <button
                        key={a.name}
                        type="button"
                        onClick={() =>
                          setCfgAddons((prev) =>
                            on ? prev.filter((x) => x !== a.name) : [...prev, a.name]
                          )
                        }
                        className={`h-10 rounded-[6px] border px-3 text-sm ${
                          on
                            ? "border-[var(--accent)] bg-[var(--accent)]/10"
                            : "border-[var(--border)]"
                        }`}
                      >
                        {a.name} (+{formatMoney(a.price)})
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <Button className="w-full" onClick={confirmConfig}>
              Add to bill
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Collect payment">
        <div className="space-y-4">
          <p className="num text-3xl font-semibold">{formatMoney(total)}</p>
          <div className="flex gap-2">
            {(["CASH", "CARD", "UPI"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPayMethod(m)}
                className={`h-11 flex-1 rounded-[6px] border text-sm font-medium ${
                  payMethod === m
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {payMethod === "CASH" ? (
            <label className="block text-xs text-[var(--muted)]">
              Tendered (paise)
              <Input
                className="mt-1"
                type="number"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
              />
              <span className="mt-1 block num">
                Change:{" "}
                {formatMoney(Math.max(0, (Number(tendered) || 0) - total))}
              </span>
            </label>
          ) : null}
          <Button className="w-full" size="lg" disabled={busy} onClick={() => void confirmPay()}>
            Confirm payment
          </Button>
        </div>
      </Modal>
    </div>
  );
}
