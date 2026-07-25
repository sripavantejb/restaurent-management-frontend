"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Search } from "lucide-react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/pos/cartStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  ORDER_TYPE_LABEL,
  PAY_METHOD_LABEL,
  TABLE_STATUS_LABEL,
  isTableSelectable,
  label,
} from "@/lib/labels";
import { calcTax, calcTotal, formatMoney } from "@/lib/money";
import { printInvoiceText } from "@/lib/print-invoice";

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
  /** Mobile-only: Menu vs Bill pane (desktop always shows both). */
  const [mobilePane, setMobilePane] = useState<"menu" | "bill">("menu");
  const [heldOpen, setHeldOpen] = useState(false);
  const [heldBills, setHeldBills] = useState<
    {
      id: string;
      label: string;
      type: string;
      tableId: string | null;
      tableNumber: number | null;
      lines: {
        menuItemId: string;
        name: string;
        qty: number;
        unitPrice: number;
        variant?: string;
        addons?: string[];
        notes?: string;
      }[];
      discountPaise: number;
    }[]
  >([]);

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

  const lineCount = cart.lines.reduce((s, l) => s + l.qty, 0);

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
      try {
        const inv = await apiFetch(`/api/orders/${pendingOrderId}/invoice`, {
          branchId: activeBranchId,
        });
        if (inv.printText) printInvoiceText(inv.printText, "Invoice");
      } catch {
        /* invoice print is best-effort */
      }
      setToast("Payment recorded — table → Cleaning");
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

  async function holdBill() {
    if (!cart.lines.length || !activeBranchId) return;
    setBusy(true);
    try {
      const labelText =
        cart.type === "DINE_IN" && cart.tableNumber
          ? `Table ${cart.tableNumber}`
          : cart.type === "TAKEAWAY"
            ? "Takeaway hold"
            : "Held bill";
      await apiFetch("/api/pos/held", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({
          label: labelText,
          type: cart.type,
          tableId: cart.tableId,
          tableNumber: cart.tableNumber,
          discountPaise: discountAmount,
          lines: cart.lines.map((l) => ({
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
      cart.clear();
      setPendingOrderId(null);
      setToast("Bill held — resume from Held bills");
      setTimeout(() => setToast(""), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hold failed");
    } finally {
      setBusy(false);
    }
  }

  async function openHeld() {
    if (!activeBranchId) return;
    setBusy(true);
    try {
      const data = await apiFetch("/api/pos/held", { branchId: activeBranchId });
      setHeldBills(data.held ?? []);
      setHeldOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load held bills");
    } finally {
      setBusy(false);
    }
  }

  async function resumeHeld(id: string) {
    const bill = heldBills.find((b) => b.id === id);
    if (!bill || !activeBranchId) return;
    setBusy(true);
    try {
      cart.replaceCart({
        type: bill.type === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN",
        tableId: bill.tableId,
        tableNumber: bill.tableNumber,
        discountType: "flat",
        discountValue: bill.discountPaise ?? 0,
        lines: bill.lines.map((l) => ({
          key: [l.menuItemId, l.variant ?? "", (l.addons ?? []).join(","), l.notes ?? ""].join(
            "|"
          ),
          menuItemId: l.menuItemId,
          name: l.name,
          qty: l.qty,
          unitPrice: l.unitPrice,
          variant: l.variant ?? "",
          addons: l.addons ?? [],
          notes: l.notes ?? "",
          isVeg: true,
        })),
      });
      await apiFetch(`/api/pos/held?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        branchId: activeBranchId,
      });
      setHeldOpen(false);
      setMobilePane("bill");
      setToast("Held bill resumed");
      setTimeout(() => setToast(""), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resume failed");
    } finally {
      setBusy(false);
    }
  }

  const statusColor: Record<string, string> = {
    AVAILABLE: "bg-[var(--success)]",
    FREE: "bg-[var(--success)]",
    OCCUPIED: "bg-[var(--warn)]",
    PREPARING_BILL: "bg-sky-500",
    BILLED: "bg-sky-500",
    CLEANING: "bg-violet-400",
    RESERVED: "bg-[var(--muted)]",
    BLOCKED: "bg-red-500",
    OUT_OF_SERVICE: "bg-neutral-400",
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-auto min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["DINE_IN", "TAKEAWAY"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => cart.setType(t)}
              className={`h-10 rounded-[6px] px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:px-4 ${
                cart.type === t
                  ? "bg-[var(--ink)] text-white"
                  : "border border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {t === "DINE_IN"
                ? label(ORDER_TYPE_LABEL, "DINE_IN")
                : label(ORDER_TYPE_LABEL, "TAKEAWAY")}
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

      <div className="flex shrink-0 gap-1 border-b border-[var(--border)] p-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePane("menu")}
          className={`h-10 flex-1 rounded-[6px] text-sm font-medium ${
            mobilePane === "menu"
              ? "bg-[var(--ink)] text-white"
              : "border border-[var(--border)] text-[var(--muted)]"
          }`}
        >
          Menu
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("bill")}
          className={`h-10 flex-1 rounded-[6px] text-sm font-medium ${
            mobilePane === "bill"
              ? "bg-[var(--ink)] text-white"
              : "border border-[var(--border)] text-[var(--muted)]"
          }`}
        >
          Bill{lineCount ? ` (${lineCount})` : ""}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Category rail — horizontal on mobile, vertical on desktop */}
        <div
          className={`shrink-0 gap-1 overflow-x-auto border-b border-[var(--border)] p-2 lg:flex lg:w-[200px] lg:flex-col lg:overflow-auto lg:border-r lg:border-b-0 ${
            mobilePane === "menu" ? "flex" : "hidden lg:flex"
          }`}
        >
          <button
            type="button"
            onClick={() => setCatId("all")}
            className={`min-h-10 shrink-0 rounded-[6px] px-3 text-left text-sm font-medium whitespace-nowrap lg:min-h-12 ${
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
              className={`min-h-10 shrink-0 rounded-[6px] px-3 text-left text-sm font-medium whitespace-nowrap lg:min-h-12 ${
                catId === c.id ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--surface-2)]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Menu grid */}
        <div
          className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
            mobilePane === "menu" ? "flex" : "hidden lg:flex"
          }`}
        >
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
          <div className="grid grid-cols-2 gap-2 overflow-auto p-3 sm:grid-cols-3 lg:grid-cols-4">
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
          {lineCount > 0 ? (
            <div className="border-t border-[var(--border)] p-3 lg:hidden">
              <Button className="w-full" onClick={() => setMobilePane("bill")}>
                View bill · {lineCount} item{lineCount === 1 ? "" : "s"} · {formatMoney(total)}
              </Button>
            </div>
          ) : null}
        </div>

        {/* Cart */}
        <div
          className={`w-full shrink-0 flex-col border-[var(--border)] bg-white lg:flex lg:w-[380px] lg:border-t-0 lg:border-l ${
            mobilePane === "bill" ? "flex min-h-0 flex-1 border-t-0" : "hidden"
          }`}
        >
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
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="w-full"
                variant="secondary"
                disabled={!cart.lines.length || busy}
                onClick={() => void holdBill()}
              >
                Hold bill
              </Button>
              <Button
                className="w-full"
                variant="secondary"
                disabled={busy}
                onClick={() => void openHeld()}
              >
                Resume held
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={tableOpen} onClose={() => setTableOpen(false)} title="Select table" wide>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Free tables start a new bill. Occupied tables add another round to the open session.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {tables.map((t) => {
            const selectable = isTableSelectable(t.status);
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
                <span className="text-xs text-[var(--muted)]">
                  {label(TABLE_STATUS_LABEL, t.status)}
                </span>
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
                {label(PAY_METHOD_LABEL, m)}
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

      <Modal open={heldOpen} onClose={() => setHeldOpen(false)} title="Held bills">
        {heldBills.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No held bills for this branch.</p>
        ) : (
          <ul className="space-y-2">
            {heldBills.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-[6px] border border-[var(--border)] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.label}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {b.lines.length} line(s)
                    {b.tableNumber != null ? ` · Table ${b.tableNumber}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void resumeHeld(b.id)}
                >
                  Resume
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
