"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatMoney, toPaise } from "@/lib/money";
import { TablePageSkeleton } from "@/components/ui/Skeleton";

interface Category {
  id: string;
  name: string;
}
interface Item {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  prepTimeMins: number;
  allergens?: string[];
  hsnCode?: string;
  stationCode?: string;
}

export default function MenuPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    isVeg: true,
    prepTimeMins: "15",
    allergens: "",
    hsnCode: "996331",
    stationCode: "",
  });

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const data = await apiFetch("/api/menu", { branchId: activeBranchId });
      setCategories(data.categories);
      setItems(data.items);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load menu");
    } finally {
      setReady(true);
    }
  }, [activeBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleAvailable(item: Item) {
    if (!hasPermission("menu.edit")) return;
    try {
      await apiFetch(`/api/menu/${item.id}`, {
        method: "PATCH",
        branchId: activeBranchId,
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update availability");
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      price: "",
      categoryId: categories[0]?.id ?? "",
      isVeg: true,
      prepTimeMins: "15",
      allergens: "",
      hsnCode: "996331",
      stationCode: "",
    });
    setEditOpen(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description,
      price: String(item.price / 100),
      categoryId: item.categoryId,
      isVeg: item.isVeg,
      prepTimeMins: String(item.prepTimeMins),
      allergens: (item.allergens || []).join(", "),
      hsnCode: item.hsnCode || "996331",
      stationCode: item.stationCode || "",
    });
    setEditOpen(true);
  }

  async function save() {
    try {
      const payload = {
        name: form.name,
        description: form.description,
        price: toPaise(Number(form.price)),
        categoryId: form.categoryId,
        isVeg: form.isVeg,
        prepTimeMins: Number(form.prepTimeMins) || 15,
        allergens: form.allergens
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        hsnCode: form.hsnCode.trim() || "996331",
        stationCode: form.stationCode.trim().toUpperCase(),
      };
      if (editing) {
        await apiFetch(`/api/menu/${editing.id}`, {
          method: "PATCH",
          branchId: activeBranchId,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/menu", {
          method: "POST",
          branchId: activeBranchId,
          body: JSON.stringify(payload),
        });
      }
      setEditOpen(false);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  const catName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "—";

  if (!ready) return <TablePageSkeleton />;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Mark items sold out — POS greys them out on the next refresh.
          </p>
        </div>
        {hasPermission("menu.edit") ? (
          <Button onClick={openCreate}>Add item</Button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-2 sm:hidden">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-[6px] border border-[var(--border)] bg-white p-3 ${
              item.isAvailable ? "" : "opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-sm border border-current"
                    style={{
                      color: item.isVeg ? "#15803d" : "#b91c1c",
                      background: item.isVeg ? "#16a34a" : "#dc2626",
                    }}
                  />
                  <span className="truncate">{item.name}</span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {catName(item.categoryId)} · {formatMoney(item.price)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => void toggleAvailable(item)}
                  className={`h-8 rounded-[6px] px-3 text-xs font-medium ${
                    item.isAvailable
                      ? "bg-[var(--success)]/15 text-[var(--success)]"
                      : "bg-[var(--surface-2)] text-[var(--muted)]"
                  }`}
                >
                  {item.isAvailable ? "Available" : "Sold out"}
                </button>
                {hasPermission("menu.edit") ? (
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                    Edit
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 hidden overflow-auto rounded-[6px] border border-[var(--border)] bg-white sm:block">
        <div className="table-scroll">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Available</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={`border-b border-[var(--border)] ${
                  item.isAvailable ? "" : "bg-[var(--surface-2)] opacity-60"
                }`}
              >
                <td className="px-3 py-2.5">
                  <span className="mr-2 inline-block h-2 w-2 rounded-sm border border-current"
                    style={{ color: item.isVeg ? "#15803d" : "#b91c1c", background: item.isVeg ? "#16a34a" : "#dc2626" }}
                  />
                  {item.name}
                </td>
                <td className="px-3 py-2.5 text-[var(--muted)]">
                  {catName(item.categoryId)}
                </td>
                <td className="num px-3 py-2.5">{formatMoney(item.price)}</td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => void toggleAvailable(item)}
                    className={`h-8 rounded-[6px] px-3 text-xs font-medium ${
                      item.isAvailable
                        ? "bg-[var(--success)]/15 text-[var(--success)]"
                        : "bg-[var(--surface-2)] text-[var(--muted)]"
                    }`}
                  >
                    {item.isAvailable ? "Available" : "Sold out"}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {hasPermission("menu.edit") ? (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                      Edit
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editing ? "Edit item" : "New item"}
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
            Description
            <Input
              className="mt-1"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Price (₹)
            <Input
              className="mt-1"
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Category
            <select
              className="mt-1 h-10 w-full rounded-[6px] border border-[var(--border)] px-2"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isVeg}
              onChange={(e) => setForm({ ...form, isVeg: e.target.checked })}
            />
            Vegetarian
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Allergens (comma-separated)
            <Input
              className="mt-1"
              placeholder="dairy, nuts, gluten"
              value={form.allergens}
              onChange={(e) => setForm({ ...form, allergens: e.target.value })}
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            HSN code
            <Input
              className="mt-1"
              value={form.hsnCode}
              onChange={(e) => setForm({ ...form, hsnCode: e.target.value })}
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            KDS station code
            <Input
              className="mt-1"
              placeholder="GRILL / BAR / COLD"
              value={form.stationCode}
              onChange={(e) =>
                setForm({ ...form, stationCode: e.target.value })
              }
            />
          </label>
          <Button className="w-full" onClick={() => void save()}>
            Save
          </Button>
        </div>
      </Modal>
    </div>
  );
}
