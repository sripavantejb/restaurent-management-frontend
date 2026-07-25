"use client";

import { useCallback, useEffect, useState } from "react";
import { Package } from "lucide-react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/money";
import { InventoryOpsPanel } from "@/components/inventory/InventoryOpsPanel";

type Tab =
  | "overview"
  | "stock"
  | "ledger"
  | "batches"
  | "suppliers"
  | "purchases"
  | "transfers"
  | "recipes"
  | "counts"
  | "reports"
  | "labels"
  | "warehouses";

const WASTE_REASONS = [
  "SPOILAGE",
  "KITCHEN_WASTE",
  "CUSTOMER_RETURN",
  "DAMAGED",
  "EXPIRED",
  "STAFF_MEAL",
  "TESTING",
] as const;

interface StockItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  costPerUnit: number;
  valuePaise: number;
  lowStock: boolean;
}

export default function InventoryPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const canEdit = hasPermission("inventory.edit");
  const canPurchase = hasPermission("inventory.purchase");
  const canApprove = hasPermission("inventory.approve");
  const canTransfer = hasPermission("inventory.transfer");
  const canFinance = hasPermission("inventory.finance");

  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [items, setItems] = useState<StockItem[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [lowOnly, setLowOnly] = useState(false);

  const [analytics, setAnalytics] = useState<{
    kpis: Record<string, number>;
    expiry: Record<string, number>;
    suggestions: string[];
    topIngredients: { name: string; qty: number; unit: string }[];
    charts: { stockValue: { x: string; y: number }[] };
  } | null>(null);

  const [ledger, setLedger] = useState<
    {
      id: string;
      date: string;
      type: string;
      quantity: number;
      itemName: string;
      unit: string;
      note: string;
      wasteReason: string | null;
      menuItemName: string;
      reference: string;
    }[]
  >([]);

  const [batches, setBatches] = useState<
    {
      id: string;
      batchCode: string;
      itemName: string;
      unit: string;
      remainingQty: number;
      receivedQty: number;
      expiryDate: string | null;
      supplier: string | null;
      unitCostPaise: number;
    }[]
  >([]);
  const [expiryCounts, setExpiryCounts] = useState<Record<string, number>>({});

  const [suppliers, setSuppliers] = useState<
    {
      id: string;
      company: string;
      gstNumber: string;
      phone: string;
      rating: number;
      lastPurchaseAt: string | null;
    }[]
  >([]);

  const [purchases, setPurchases] = useState<{
    requests: {
      id: string;
      requestNumber: string;
      status: string;
      lines: { name: string; qty: number; unit: string }[];
    }[];
    orders: {
      id: string;
      poNumber: string;
      status: string;
      supplier: string;
      lines: {
        inventoryItemId: string;
        name: string;
        qtyOrdered: number;
        qtyReceived: number;
        unitCostPaise: number;
        unit: string;
      }[];
    }[];
    suppliers: { id: string; company: string }[];
    items: {
      id: string;
      name: string;
      unit: string;
      lowStock: boolean;
    }[];
  } | null>(null);

  const [transfers, setTransfers] = useState<{
    transfers: {
      id: string;
      transferNumber: string;
      status: string;
      qty: number;
      unit: string;
      itemName: string;
      fromBranch: string;
      toBranch: string;
    }[];
    branches: { id: string; name: string }[];
  } | null>(null);

  const [recipes, setRecipes] = useState<
    {
      id: string;
      menuItemName: string;
      lines: {
        inventoryItemName: string;
        unit: string;
        qtyPerServe: number;
      }[];
    }[]
  >([]);
  const [menuItems, setMenuItems] = useState<{ id: string; name: string }[]>(
    []
  );
  const [invOptions, setInvOptions] = useState<
    { id: string; name: string; unit: string }[]
  >([]);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    unit: "KG",
    quantityOnHand: "0",
    reorderLevel: "5",
    costPerUnit: "0",
    expiryDate: "",
  });
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<StockItem | null>(null);
  const [receiveQty, setReceiveQty] = useState("");
  const [wasteQty, setWasteQty] = useState("");
  const [wasteReason, setWasteReason] =
    useState<(typeof WASTE_REASONS)[number]>("SPOILAGE");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    company: "",
    gstNumber: "",
    phone: "",
    address: "",
  });
  const [poOpen, setPoOpen] = useState(false);
  const [poForm, setPoForm] = useState({
    supplierId: "",
    inventoryItemId: "",
    qty: "10",
    unitCost: "100",
  });
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    toBranchId: "",
    inventoryItemId: "",
    qty: "1",
  });
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    menuItemId: "",
    inventoryItemId: "",
    qtyPerServe: "0.2",
  });
  const [recipeLines, setRecipeLines] = useState<
    { inventoryItemId: string; qtyPerServe: number }[]
  >([]);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2800);
  };

  const loadCore = useCallback(async () => {
    if (!activeBranchId) return;
    const q = lowOnly ? "?lowStock=1" : "";
    const [stock, analyticsData, rec] = await Promise.all([
      apiFetch(`/api/inventory${q}`, { branchId: activeBranchId }),
      apiFetch("/api/inventory/analytics", { branchId: activeBranchId }),
      apiFetch("/api/inventory/recipes", { branchId: activeBranchId }),
    ]);
    setItems(stock.items);
    setLowStockCount(stock.lowStockCount);
    setInventoryValue(stock.inventoryValuePaise ?? 0);
    setAnalytics(analyticsData);
    setRecipes(rec.recipes);
    setMenuItems(rec.menuItems);
    setInvOptions(rec.inventoryItems);
  }, [activeBranchId, lowOnly]);

  const loadTabData = useCallback(async () => {
    if (!activeBranchId) return;
    if (tab === "ledger") {
      const data = await apiFetch("/api/inventory/ledger", {
        branchId: activeBranchId,
      });
      setLedger(data.movements);
    }
    if (tab === "batches") {
      const [list, exp] = await Promise.all([
        apiFetch("/api/inventory/batches", { branchId: activeBranchId }),
        apiFetch("/api/inventory/batches?mode=expiry", {
          branchId: activeBranchId,
        }),
      ]);
      setBatches(list.batches);
      setExpiryCounts(exp.counts);
    }
    if (tab === "suppliers") {
      const data = await apiFetch("/api/inventory/suppliers", {
        branchId: activeBranchId,
      });
      setSuppliers(data.suppliers);
    }
    if (tab === "purchases") {
      const data = await apiFetch("/api/inventory/purchases", {
        branchId: activeBranchId,
      });
      setPurchases(data);
    }
    if (tab === "transfers") {
      const data = await apiFetch("/api/inventory/transfers", {
        branchId: activeBranchId,
      });
      setTransfers(data);
    }
  }, [activeBranchId, tab]);

  useEffect(() => {
    void loadCore().catch((e) =>
      setError(e instanceof Error ? e.message : "Load failed")
    );
  }, [loadCore]);

  useEffect(() => {
    void loadTabData().catch((e) =>
      setError(e instanceof Error ? e.message : "Load failed")
    );
  }, [loadTabData]);

  async function createItem() {
    if (!canEdit) return;
    await apiFetch("/api/inventory", {
      method: "POST",
      branchId: activeBranchId,
      body: JSON.stringify({
        name: form.name,
        sku: form.sku,
        unit: form.unit,
        quantityOnHand: Number(form.quantityOnHand) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        costPerUnit: Math.round(Number(form.costPerUnit) * 100) || 0,
        expiryDate: form.expiryDate || null,
      }),
    });
    setCreateOpen(false);
    showToast("Item created with batch");
    await loadCore();
  }

  async function submitWaste() {
    if (!adjusting || !canEdit) return;
    const qty = Number(wasteQty);
    if (!qty) return;
    await apiFetch(`/api/inventory/${adjusting.id}/waste`, {
      method: "POST",
      branchId: activeBranchId,
      body: JSON.stringify({ quantity: qty, reason: wasteReason }),
    });
    setAdjustOpen(false);
    showToast("Waste recorded (FIFO)");
    await loadCore();
  }

  async function submitReceive() {
    if (!adjusting || !canEdit) return;
    const qty = Number(receiveQty);
    if (!qty) return;
    await apiFetch(`/api/inventory/${adjusting.id}`, {
      method: "PATCH",
      branchId: activeBranchId,
      body: JSON.stringify({ adjustBy: qty }),
    });
    setAdjustOpen(false);
    showToast("Stock received");
    await loadCore();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "stock", label: "Stock" },
    { id: "ledger", label: "Ledger" },
    { id: "batches", label: "Batches" },
    { id: "counts", label: "Counts" },
    { id: "suppliers", label: "Suppliers" },
    { id: "purchases", label: "Purchases" },
    { id: "transfers", label: "Transfers" },
    { id: "warehouses", label: "Warehouses" },
    { id: "recipes", label: "Recipes" },
    { id: "reports", label: "Reports" },
    { id: "labels", label: "Labels" },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Package size={22} className="text-[var(--accent)]" />
            Inventory OS
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            FIFO batches · expiry · purchases · transfers · auto-deduct on pay
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {toast ? (
            <span className="rounded-[6px] bg-[var(--success)]/15 px-3 py-1 text-sm text-[var(--success)]">
              {toast}
            </span>
          ) : null}
          {canEdit ? (
            <Button onClick={() => setCreateOpen(true)}>Add item</Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-[var(--border)] pb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-[6px] px-3 py-2 text-sm ${
              tab === t.id
                ? "bg-[var(--ink)] text-white"
                : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {tab === "overview" && analytics ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Inventory value",
                value: formatMoney(analytics.kpis.inventoryValuePaise ?? inventoryValue),
              },
              {
                label: "Low stock",
                value: String(analytics.kpis.lowStockCount ?? lowStockCount),
              },
              {
                label: "Today consumption cost",
                value: formatMoney(
                  analytics.kpis.dailyConsumptionCostPaise ?? 0
                ),
              },
              {
                label: "Month waste cost",
                value: formatMoney(analytics.kpis.monthlyWasteCostPaise ?? 0),
              },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-[6px] border border-[var(--border)] px-3 py-3"
              >
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  {k.label}
                </p>
                <p className="num mt-1 text-lg font-semibold">{k.value}</p>
              </div>
            ))}
          </div>
          {canFinance && analytics.kpis.foodCostPct != null ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[6px] border border-[var(--border)] px-3 py-3">
                <p className="text-[10px] uppercase text-[var(--muted)]">
                  Food cost %
                </p>
                <p className="num text-lg font-semibold">
                  {analytics.kpis.foodCostPct}%
                </p>
              </div>
              <div className="rounded-[6px] border border-[var(--border)] px-3 py-3">
                <p className="text-[10px] uppercase text-[var(--muted)]">
                  Gross margin
                </p>
                <p className="num text-lg font-semibold">
                  {analytics.kpis.grossMarginPct}%
                </p>
              </div>
              <div className="rounded-[6px] border border-[var(--border)] px-3 py-3">
                <p className="text-[10px] uppercase text-[var(--muted)]">
                  Est. profit today
                </p>
                <p className="num text-lg font-semibold">
                  {formatMoney(analytics.kpis.profitPaise ?? 0)}
                </p>
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Expired", expiryCounts.expired ?? analytics.expiry.expired],
              [
                "Expiring today",
                expiryCounts.expiringToday ?? analytics.expiry.expiringToday,
              ],
              [
                "Within 3 days",
                expiryCounts.within3Days ?? analytics.expiry.within3Days,
              ],
              [
                "Within week",
                expiryCounts.withinWeek ?? analytics.expiry.withinWeek,
              ],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-center"
              >
                <p className="num text-xl font-semibold">{val}</p>
                <p className="text-[11px] text-[var(--muted)]">{label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[6px] border border-[var(--border)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              AI suggestions
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {analytics.suggestions.map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
            {canPurchase ? (
              <Button
                className="mt-3"
                size="sm"
                onClick={async () => {
                  await apiFetch("/api/inventory/purchases", {
                    method: "POST",
                    branchId: activeBranchId,
                    body: JSON.stringify({ kind: "fromLowStock" }),
                  });
                  showToast("Purchase request created from low stock");
                  setTab("purchases");
                }}
              >
                Create PR from low stock
              </Button>
            ) : null}
          </div>
          {analytics.topIngredients?.length ? (
            <div className="rounded-[6px] border border-[var(--border)] p-3">
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                Top ingredients today
              </p>
              <div className="mt-2 flex h-28 items-end gap-1">
                {analytics.topIngredients.map((t) => {
                  const max = Math.max(
                    ...analytics.topIngredients.map((x) => x.qty),
                    1
                  );
                  return (
                    <div
                      key={t.name}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <div
                        className="w-full rounded-t bg-[var(--accent)]"
                        style={{ height: `${(t.qty / max) * 100}%` }}
                      />
                      <span className="max-w-full truncate text-[9px] text-[var(--muted)]">
                        {t.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "stock" ? (
        <div className="mt-4">
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => setLowOnly(e.target.checked)}
            />
            Low stock only ({lowStockCount})
          </label>
          <div className="overflow-auto rounded-[6px] border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">On hand</th>
                  <th className="px-3 py-2">Reorder</th>
                  <th className="px-3 py-2">Avg cost</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">
                      <p className="font-medium">{i.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {i.sku || i.barcode || "—"} · {i.unit}
                        {i.lowStock ? (
                          <Badge className="ml-2">Low</Badge>
                        ) : null}
                      </p>
                    </td>
                    <td className="num px-3 py-2">{i.quantityOnHand}</td>
                    <td className="num px-3 py-2">{i.reorderLevel}</td>
                    <td className="num px-3 py-2">
                      {formatMoney(i.costPerUnit)}
                    </td>
                    <td className="num px-3 py-2">
                      {formatMoney(i.valuePaise)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canEdit ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setAdjusting(i);
                            setReceiveQty("");
                            setWasteQty("");
                            setAdjustOpen(true);
                          }}
                        >
                          Adjust
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "ledger" ? (
        <div className="mt-4 overflow-auto rounded-[6px] border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((m) => (
                <tr key={m.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-xs text-[var(--muted)]">
                    {m.date
                      ? new Date(m.date).toLocaleString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge>{m.type}</Badge>
                  </td>
                  <td className="px-3 py-2">{m.itemName}</td>
                  <td
                    className={`num px-3 py-2 ${
                      m.quantity < 0 ? "text-red-600" : "text-[var(--success)]"
                    }`}
                  >
                    {m.quantity > 0 ? "+" : ""}
                    {m.quantity} {m.unit}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--muted)]">
                    {m.menuItemName || m.wasteReason || m.note || m.reference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "batches" ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(
              expiryCounts.expired != null
                ? {
                    Expired: expiryCounts.expired,
                    Today: expiryCounts.expiringToday,
                    "3 days": expiryCounts.within3Days,
                    Week: expiryCounts.withinWeek,
                  }
                : {}
            ).map(([k, v]) => (
              <div
                key={k}
                className="rounded-[6px] border border-[var(--border)] px-3 py-2 text-center"
              >
                <p className="num text-lg font-semibold">{v}</p>
                <p className="text-[11px] text-[var(--muted)]">{k}</p>
              </div>
            ))}
          </div>
          <div className="overflow-auto rounded-[6px] border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Batch</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Remaining</th>
                  <th className="px-3 py-2">Expiry</th>
                  <th className="px-3 py-2">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t border-[var(--border)]">
                    <td className="num px-3 py-2 font-medium">{b.batchCode}</td>
                    <td className="px-3 py-2">{b.itemName}</td>
                    <td className="num px-3 py-2">
                      {b.remainingQty}/{b.receivedQty} {b.unit}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {b.expiryDate
                        ? new Date(b.expiryDate).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--muted)]">
                      {b.supplier ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "suppliers" ? (
        <div className="mt-4">
          {canPurchase ? (
            <Button className="mb-3" onClick={() => setSupplierOpen(true)}>
              Add supplier
            </Button>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((s) => (
              <div
                key={s.id}
                className="rounded-[6px] border border-[var(--border)] p-3"
              >
                <p className="font-semibold">{s.company}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  GST {s.gstNumber || "—"} · {s.phone || "—"}
                </p>
                <p className="mt-1 text-xs">
                  Rating {s.rating}/5
                  {s.lastPurchaseAt
                    ? ` · last ${new Date(s.lastPurchaseAt).toLocaleDateString("en-IN")}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "purchases" && purchases ? (
        <div className="mt-4 space-y-6">
          <div className="flex flex-wrap gap-2">
            {canPurchase ? (
              <>
                <Button
                  size="sm"
                  onClick={async () => {
                    await apiFetch("/api/inventory/purchases", {
                      method: "POST",
                      branchId: activeBranchId,
                      body: JSON.stringify({ kind: "fromLowStock" }),
                    });
                    showToast("PR from low stock");
                    await loadTabData();
                  }}
                >
                  PR from low stock
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPoOpen(true)}
                >
                  Create PO
                </Button>
              </>
            ) : null}
          </div>
          <div>
            <h2 className="text-sm font-semibold">Purchase requests</h2>
            <ul className="mt-2 space-y-2">
              {purchases.requests.map((r) => (
                <li
                  key={r.id}
                  className="rounded-[6px] border border-[var(--border)] p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {r.requestNumber} · {r.status}
                    </span>
                    {canApprove && r.status === "PENDING" ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={async () => {
                            await apiFetch("/api/inventory/purchases", {
                              method: "POST",
                              branchId: activeBranchId,
                              body: JSON.stringify({
                                kind: "approve",
                                requestId: r.id,
                                approve: true,
                              }),
                            });
                            await loadTabData();
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            await apiFetch("/api/inventory/purchases", {
                              method: "POST",
                              branchId: activeBranchId,
                              body: JSON.stringify({
                                kind: "approve",
                                requestId: r.id,
                                approve: false,
                              }),
                            });
                            await loadTabData();
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {r.lines
                      .map((l) => `${l.qty} ${l.unit} ${l.name}`)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Purchase orders</h2>
            <ul className="mt-2 space-y-2">
              {purchases.orders.map((o) => (
                <li
                  key={o.id}
                  className="rounded-[6px] border border-[var(--border)] p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {o.poNumber} · {o.supplier} · {o.status}
                    </span>
                    {canEdit && o.status !== "RECEIVED" ? (
                      <Button
                        size="sm"
                        onClick={async () => {
                          await apiFetch("/api/inventory/purchases", {
                            method: "POST",
                            branchId: activeBranchId,
                            body: JSON.stringify({
                              kind: "receive",
                              purchaseOrderId: o.id,
                              qualityOk: true,
                              qualityNotes: "Inspected OK",
                              lines: o.lines.map((l) => ({
                                inventoryItemId: l.inventoryItemId,
                                qty: Math.max(
                                  l.qtyOrdered - l.qtyReceived,
                                  0
                                ) || l.qtyOrdered,
                                expiryDate: null,
                              })),
                            }),
                          });
                          showToast("Goods received · batches created");
                          await loadCore();
                          await loadTabData();
                        }}
                      >
                        Receive goods
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {o.lines
                      .map(
                        (l) =>
                          `${l.name}: ${l.qtyReceived}/${l.qtyOrdered} ${l.unit}`
                      )
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {tab === "transfers" && transfers ? (
        <div className="mt-4">
          {canTransfer ? (
            <Button className="mb-3" onClick={() => setTransferOpen(true)}>
              New transfer
            </Button>
          ) : null}
          <ul className="space-y-2">
            {transfers.transfers.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[var(--border)] p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {t.transferNumber} · {t.status}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {t.qty} {t.unit} {t.itemName} · {t.fromBranch} →{" "}
                    {t.toBranch}
                  </p>
                </div>
                {canTransfer && t.status === "IN_TRANSIT" ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await apiFetch("/api/inventory/transfers", {
                        method: "POST",
                        branchId: activeBranchId,
                        body: JSON.stringify({
                          action: "accept",
                          transferId: t.id,
                        }),
                      });
                      showToast("Transfer accepted");
                      await loadCore();
                      await loadTabData();
                    }}
                  >
                    Accept
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "recipes" ? (
        <div className="mt-4">
          {canEdit ? (
            <Button className="mb-3" onClick={() => setRecipeOpen(true)}>
              Link recipe
            </Button>
          ) : null}
          <ul className="space-y-2">
            {recipes.map((r) => (
              <li
                key={r.id}
                className="rounded-[6px] border border-[var(--border)] p-3 text-sm"
              >
                <p className="font-medium">{r.menuItemName}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {r.lines
                    .map(
                      (l) =>
                        `${l.qtyPerServe} ${l.unit} ${l.inventoryItemName}`
                    )
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "counts" ||
      tab === "reports" ||
      tab === "labels" ||
      tab === "warehouses" ? (
        <InventoryOpsPanel
          branchId={activeBranchId}
          canEdit={canEdit}
          items={items}
          mode={tab}
        />
      ) : null}

      {/* Modals */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add inventory item">
        <div className="space-y-2">
          <Input
            placeholder="Name (e.g. Chicken)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="SKU / barcode"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
          <select
            className="h-10 w-full rounded-[6px] border border-[var(--border)] px-2"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          >
            {[
              "KG",
              "G",
              "L",
              "ML",
              "PCS",
              "BOX",
              "CARTON",
              "BOTTLE",
              "PACK",
              "DOZEN",
            ].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <Input
            placeholder="Opening qty"
            value={form.quantityOnHand}
            onChange={(e) =>
              setForm({ ...form, quantityOnHand: e.target.value })
            }
          />
          <Input
            placeholder="Reorder level"
            value={form.reorderLevel}
            onChange={(e) =>
              setForm({ ...form, reorderLevel: e.target.value })
            }
          />
          <Input
            placeholder="Cost per unit (₹)"
            value={form.costPerUnit}
            onChange={(e) =>
              setForm({ ...form, costPerUnit: e.target.value })
            }
          />
          <Input
            type="date"
            value={form.expiryDate}
            onChange={(e) =>
              setForm({ ...form, expiryDate: e.target.value })
            }
          />
          <Button className="w-full" onClick={() => void createItem()}>
            Create + batch
          </Button>
        </div>
      </Modal>

      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={adjusting ? `Adjust ${adjusting.name}` : "Adjust"}
      >
        <div className="space-y-3">
          <div>
            <p className="text-xs text-[var(--muted)]">Receive (+)</p>
            <Input
              value={receiveQty}
              onChange={(e) => setReceiveQty(e.target.value)}
              placeholder="Qty"
            />
            <Button
              className="mt-2 w-full"
              size="sm"
              onClick={() => void submitReceive()}
            >
              Receive
            </Button>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Waste (−) FIFO</p>
            <select
              className="mb-2 h-10 w-full rounded-[6px] border border-[var(--border)] px-2 text-sm"
              value={wasteReason}
              onChange={(e) =>
                setWasteReason(e.target.value as (typeof WASTE_REASONS)[number])
              }
            >
              {WASTE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <Input
              value={wasteQty}
              onChange={(e) => setWasteQty(e.target.value)}
              placeholder="Qty"
            />
            <Button
              className="mt-2 w-full"
              size="sm"
              variant="danger"
              onClick={() => void submitWaste()}
            >
              Record waste
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={supplierOpen}
        onClose={() => setSupplierOpen(false)}
        title="Add supplier"
      >
        <div className="space-y-2">
          <Input
            placeholder="Company"
            value={supplierForm.company}
            onChange={(e) =>
              setSupplierForm({ ...supplierForm, company: e.target.value })
            }
          />
          <Input
            placeholder="GST"
            value={supplierForm.gstNumber}
            onChange={(e) =>
              setSupplierForm({ ...supplierForm, gstNumber: e.target.value })
            }
          />
          <Input
            placeholder="Phone"
            value={supplierForm.phone}
            onChange={(e) =>
              setSupplierForm({ ...supplierForm, phone: e.target.value })
            }
          />
          <Button
            className="w-full"
            onClick={async () => {
              await apiFetch("/api/inventory/suppliers", {
                method: "POST",
                branchId: activeBranchId,
                body: JSON.stringify(supplierForm),
              });
              setSupplierOpen(false);
              showToast("Supplier added");
              await loadTabData();
            }}
          >
            Save
          </Button>
        </div>
      </Modal>

      <Modal open={poOpen} onClose={() => setPoOpen(false)} title="Create PO">
        <div className="space-y-2">
          <select
            className="h-10 w-full rounded-[6px] border border-[var(--border)] px-2"
            value={poForm.supplierId}
            onChange={(e) =>
              setPoForm({ ...poForm, supplierId: e.target.value })
            }
          >
            <option value="">Supplier</option>
            {(purchases?.suppliers ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.company}
              </option>
            ))}
          </select>
          <select
            className="h-10 w-full rounded-[6px] border border-[var(--border)] px-2"
            value={poForm.inventoryItemId}
            onChange={(e) =>
              setPoForm({ ...poForm, inventoryItemId: e.target.value })
            }
          >
            <option value="">Item</option>
            {(purchases?.items ?? items).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Qty"
            value={poForm.qty}
            onChange={(e) => setPoForm({ ...poForm, qty: e.target.value })}
          />
          <Input
            placeholder="Unit cost ₹"
            value={poForm.unitCost}
            onChange={(e) => setPoForm({ ...poForm, unitCost: e.target.value })}
          />
          <Button
            className="w-full"
            onClick={async () => {
              await apiFetch("/api/inventory/purchases", {
                method: "POST",
                branchId: activeBranchId,
                body: JSON.stringify({
                  kind: "order",
                  supplierId: poForm.supplierId,
                  lines: [
                    {
                      inventoryItemId: poForm.inventoryItemId,
                      qtyOrdered: Number(poForm.qty),
                      unitCostPaise: Math.round(Number(poForm.unitCost) * 100),
                    },
                  ],
                }),
              });
              setPoOpen(false);
              showToast("PO created");
              await loadTabData();
            }}
          >
            Create PO
          </Button>
        </div>
      </Modal>

      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Branch transfer"
      >
        <div className="space-y-2">
          <select
            className="h-10 w-full rounded-[6px] border border-[var(--border)] px-2"
            value={transferForm.toBranchId}
            onChange={(e) =>
              setTransferForm({ ...transferForm, toBranchId: e.target.value })
            }
          >
            <option value="">Destination branch</option>
            {(transfers?.branches ?? [])
              .filter((b) => b.id !== activeBranchId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
          <select
            className="h-10 w-full rounded-[6px] border border-[var(--border)] px-2"
            value={transferForm.inventoryItemId}
            onChange={(e) =>
              setTransferForm({
                ...transferForm,
                inventoryItemId: e.target.value,
              })
            }
          >
            <option value="">Item</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.quantityOnHand})
              </option>
            ))}
          </select>
          <Input
            value={transferForm.qty}
            onChange={(e) =>
              setTransferForm({ ...transferForm, qty: e.target.value })
            }
            placeholder="Qty"
          />
          <Button
            className="w-full"
            onClick={async () => {
              await apiFetch("/api/inventory/transfers", {
                method: "POST",
                branchId: activeBranchId,
                body: JSON.stringify({
                  action: "create",
                  ...transferForm,
                  qty: Number(transferForm.qty),
                }),
              });
              setTransferOpen(false);
              showToast("Transfer sent");
              await loadCore();
              await loadTabData();
            }}
          >
            Send transfer
          </Button>
        </div>
      </Modal>

      <Modal
        open={recipeOpen}
        onClose={() => setRecipeOpen(false)}
        title="Link recipe"
      >
        <div className="space-y-2">
          <select
            className="h-10 w-full rounded-[6px] border border-[var(--border)] px-2"
            value={recipeForm.menuItemId}
            onChange={(e) =>
              setRecipeForm({ ...recipeForm, menuItemId: e.target.value })
            }
          >
            <option value="">Menu item</option>
            {menuItems.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              className="h-10 flex-1 rounded-[6px] border border-[var(--border)] px-2"
              value={recipeForm.inventoryItemId}
              onChange={(e) =>
                setRecipeForm({
                  ...recipeForm,
                  inventoryItemId: e.target.value,
                })
              }
            >
              <option value="">Ingredient</option>
              {invOptions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </select>
            <Input
              className="w-24"
              value={recipeForm.qtyPerServe}
              onChange={(e) =>
                setRecipeForm({ ...recipeForm, qtyPerServe: e.target.value })
              }
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!recipeForm.inventoryItemId) return;
                setRecipeLines((prev) => [
                  ...prev,
                  {
                    inventoryItemId: recipeForm.inventoryItemId,
                    qtyPerServe: Number(recipeForm.qtyPerServe) || 0,
                  },
                ]);
              }}
            >
              Add
            </Button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            {recipeLines.length} lines staged
          </p>
          <Button
            className="w-full"
            onClick={async () => {
              await apiFetch("/api/inventory/recipes", {
                method: "POST",
                branchId: activeBranchId,
                body: JSON.stringify({
                  menuItemId: recipeForm.menuItemId,
                  lines: recipeLines,
                }),
              });
              setRecipeOpen(false);
              setRecipeLines([]);
              showToast("Recipe saved — sales will FIFO-deduct");
              await loadCore();
            }}
          >
            Save recipe
          </Button>
        </div>
      </Modal>
    </div>
  );
}
