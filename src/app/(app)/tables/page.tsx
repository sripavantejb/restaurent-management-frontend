"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatMoney } from "@/lib/money";

interface TableRow {
  id: string;
  number: number;
  capacity: number;
  shape: string;
  x: number;
  y: number;
  status: string;
  currentOrder: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
  } | null;
}

const STATUS_COLOR: Record<string, string> = {
  FREE: "#2A9D8F",
  OCCUPIED: "#E9C46A",
  BILLED: "#3B82F6",
  RESERVED: "#6B6560",
};

const SHAPES = ["SQUARE", "ROUND", "RECT"] as const;

export default function TablesPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const canEdit = hasPermission("tables.update");

  const [tables, setTables] = useState<TableRow[]>([]);
  const [selected, setSelected] = useState<TableRow | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    number: "",
    capacity: "4",
    shape: "SQUARE" as (typeof SHAPES)[number],
    status: "FREE",
  });

  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const floorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (force = false) => {
      if (!activeBranchId) return;
      if (!force && dirty && editMode) return;
      try {
        const data = await apiFetch("/api/tables", { branchId: activeBranchId });
        setTables(data.tables);
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load tables");
      }
    },
    [activeBranchId, dirty, editMode]
  );

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), editMode ? 10000 : 2000);
    return () => clearInterval(t);
  }, [load, editMode]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  }

  function openCreate() {
    const next =
      tables.length === 0
        ? 1
        : Math.max(...tables.map((t) => t.number)) + 1;
    setForm({
      number: String(next),
      capacity: "4",
      shape: "SQUARE",
      status: "FREE",
    });
    setCreateOpen(true);
  }

  function openEdit(t: TableRow) {
    setSelected(t);
    setForm({
      number: String(t.number),
      capacity: String(t.capacity),
      shape: (SHAPES.includes(t.shape as (typeof SHAPES)[number])
        ? t.shape
        : "SQUARE") as (typeof SHAPES)[number],
      status: t.status,
    });
  }

  async function createTable() {
    setBusy(true);
    try {
      await apiFetch("/api/tables", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({
          number: form.number ? Number(form.number) : undefined,
          capacity: Number(form.capacity) || 4,
          shape: form.shape,
          status: "FREE",
        }),
      });
      setCreateOpen(false);
      setDirty(false);
      showToast("Table created");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await apiFetch(`/api/tables/${selected.id}`, {
        method: "PATCH",
        branchId: activeBranchId,
        body: JSON.stringify({
          number: Number(form.number),
          capacity: Number(form.capacity) || 4,
          shape: form.shape,
          status: form.status,
        }),
      });
      setTables((prev) =>
        prev.map((t) =>
          t.id === selected.id
            ? {
                ...t,
                number: updated.number,
                capacity: updated.capacity,
                shape: updated.shape,
                status: updated.status,
              }
            : t
        )
      );
      setSelected(null);
      showToast(`Table ${updated.number} saved`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!confirm(`Delete table ${selected.number}? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/tables/${selected.id}`, {
        method: "DELETE",
        branchId: activeBranchId,
      });
      setTables((prev) => prev.filter((t) => t.id !== selected.id));
      setSelected(null);
      showToast("Table deleted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveLayout() {
    setBusy(true);
    try {
      await apiFetch("/api/tables", {
        method: "PUT",
        branchId: activeBranchId,
        body: JSON.stringify({
          tables: tables.map((t) => ({
            id: t.id,
            x: t.x,
            y: t.y,
            number: t.number,
          })),
        }),
      });
      setDirty(false);
      showToast("Floor layout saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Layout save failed");
    } finally {
      setBusy(false);
    }
  }

  function autoGrid() {
    const sorted = [...tables].sort((a, b) => a.number - b.number);
    const next = sorted.map((t, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      return { ...t, x: 40 + col * 140, y: 40 + row * 120 };
    });
    setTables(next);
    setDirty(true);
  }

  function renumberByPosition() {
    const sorted = [...tables].sort((a, b) => a.y - b.y || a.x - b.x);
    const next = tables.map((t) => {
      const idx = sorted.findIndex((s) => s.id === t.id);
      return { ...t, number: idx + 1 };
    });
    setTables(next);
    setDirty(true);
  }

  function moveNumber(id: string, dir: -1 | 1) {
    const sorted = [...tables].sort((a, b) => a.number - b.number);
    const idx = sorted.findIndex((t) => t.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swap];
    setTables((prev) =>
      prev.map((t) => {
        if (t.id === a.id) return { ...t, number: b.number };
        if (t.id === b.id) return { ...t, number: a.number };
        return t;
      })
    );
    setDirty(true);
  }

  function onPointerDown(e: ReactPointerEvent, t: TableRow) {
    if (!editMode || !canEdit) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      id: t.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: t.x,
      origY: t.y,
      moved: false,
    };
  }

  function onPointerMove(e: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    setTables((prev) =>
      prev.map((t) =>
        t.id === drag.id
          ? {
              ...t,
              x: Math.max(0, Math.round(drag.origX + dx)),
              y: Math.max(0, Math.round(drag.origY + dy)),
            }
          : t
      )
    );
    if (drag.moved) setDirty(true);
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  const maxX = Math.max(...tables.map((t) => t.x), 400) + 140;
  const maxY = Math.max(...tables.map((t) => t.y), 300) + 120;
  const listSorted = [...tables].sort((a, b) => a.number - b.number);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Floor plan</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {canEdit
              ? "Live status, create tables, and drag to rearrange the floor."
              : "Live table status. Ask a manager to change the layout."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toast ? (
            <span className="rounded-[6px] bg-[var(--success)]/15 px-3 py-1 text-sm text-[var(--success)]">
              {toast}
            </span>
          ) : null}
          {canEdit ? (
            <>
              <Button
                variant={editMode ? "primary" : "secondary"}
                onClick={() => {
                  if (editMode && dirty) {
                    if (
                      !confirm(
                        "Discard unsaved layout changes and leave edit mode?"
                      )
                    ) {
                      return;
                    }
                    setDirty(false);
                    void load(true);
                  }
                  setEditMode((v) => !v);
                }}
              >
                {editMode ? "Exit edit" : "Edit layout"}
              </Button>
              <Button onClick={openCreate}>Add table</Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        {Object.entries(STATUS_COLOR).map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            {k}
          </span>
        ))}
      </div>

      {editMode && canEdit ? (
        <div className="mt-4 flex flex-wrap gap-2 rounded-[6px] border border-[var(--border)] bg-white p-3">
          <Button variant="secondary" size="sm" onClick={autoGrid}>
            Snap to grid
          </Button>
          <Button variant="secondary" size="sm" onClick={renumberByPosition}>
            Renumber by position
          </Button>
          <Button
            size="sm"
            disabled={!dirty || busy}
            onClick={() => void saveLayout()}
          >
            Save layout
          </Button>
          {dirty ? (
            <span className="self-center text-xs text-[var(--accent)]">
              Unsaved position / number changes
            </span>
          ) : (
            <span className="self-center text-xs text-[var(--muted)]">
              Drag tables on the floor to reorder positions
            </span>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div
          className="overflow-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] p-4"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {tables.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No tables on this branch.{" "}
              {canEdit
                ? "Click Add table to place the first one."
                : "Ask a manager to add tables."}
            </p>
          ) : (
            <div
              ref={floorRef}
              className="relative"
              style={{ width: maxX, height: maxY, minHeight: 320 }}
            >
              {tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (dragRef.current?.moved) return;
                    openEdit(t);
                  }}
                  onPointerDown={(e) => onPointerDown(e, t)}
                  className={`absolute flex flex-col items-center justify-center border-2 bg-white text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                    editMode ? "cursor-grab active:cursor-grabbing" : ""
                  }`}
                  style={{
                    left: t.x,
                    top: t.y,
                    width: t.shape === "RECT" ? 100 : 80,
                    height: t.shape === "RECT" ? 64 : 80,
                    borderRadius: t.shape === "ROUND" ? 999 : 6,
                    borderColor: STATUS_COLOR[t.status],
                    touchAction: editMode ? "none" : undefined,
                  }}
                >
                  <span className="num text-lg">T{t.number}</span>
                  <span className="text-[10px] text-[var(--muted)]">
                    {t.capacity}p
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[6px] border border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
            Tables · {tables.length}
          </div>
          <ul className="max-h-[480px] overflow-auto">
            {listSorted.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-sm"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left hover:text-[var(--accent)]"
                  onClick={() => openEdit(t)}
                >
                  <span className="num font-medium">T{t.number}</span>
                  <span className="ml-2 text-xs text-[var(--muted)]">
                    {t.capacity}p · {t.status}
                  </span>
                </button>
                {editMode && canEdit ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="h-8 w-8 rounded-[6px] border border-[var(--border)] text-xs"
                      aria-label="Move number up"
                      onClick={() => moveNumber(t.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-[6px] border border-[var(--border)] text-xs"
                      aria-label="Move number down"
                      onClick={() => moveNumber(t.id, 1)}
                    >
                      ↓
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add table">
        <div className="space-y-3">
          <label className="block text-xs text-[var(--muted)]">
            Number
            <Input
              className="mt-1"
              type="number"
              min={1}
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Capacity
            <Input
              className="mt-1"
              type="number"
              min={1}
              max={40}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Shape
            <select
              className="mt-1 h-10 w-full rounded-[6px] border border-[var(--border)] px-2"
              value={form.shape}
              onChange={(e) =>
                setForm({
                  ...form,
                  shape: e.target.value as (typeof SHAPES)[number],
                })
              }
            >
              {SHAPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => void createTable()}
          >
            Create table
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Table ${selected.number}` : "Table"}
      >
        {selected ? (
          <div className="space-y-3 text-sm">
            {canEdit ? (
              <>
                <label className="block text-xs text-[var(--muted)]">
                  Number
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    value={form.number}
                    onChange={(e) =>
                      setForm({ ...form, number: e.target.value })
                    }
                  />
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Capacity
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    max={40}
                    value={form.capacity}
                    onChange={(e) =>
                      setForm({ ...form, capacity: e.target.value })
                    }
                  />
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Shape
                  <select
                    className="mt-1 h-10 w-full rounded-[6px] border border-[var(--border)] px-2"
                    value={form.shape}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        shape: e.target.value as (typeof SHAPES)[number],
                      })
                    }
                  >
                    {SHAPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Status
                  <select
                    className="mt-1 h-10 w-full rounded-[6px] border border-[var(--border)] px-2"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                  >
                    {Object.keys(STATUS_COLOR).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <p>
                  Status:{" "}
                  <strong style={{ color: STATUS_COLOR[selected.status] }}>
                    {selected.status}
                  </strong>
                </p>
                <p>Capacity: {selected.capacity}</p>
              </>
            )}

            {selected.currentOrder ? (
              <div className="rounded-[6px] border border-[var(--border)] p-3">
                <p className="num font-semibold">
                  {selected.currentOrder.orderNumber}
                </p>
                <p className="text-[var(--muted)]">
                  {selected.currentOrder.status}
                </p>
                <p className="num mt-1 text-lg">
                  {formatMoney(selected.currentOrder.total)}
                </p>
              </div>
            ) : (
              <p className="text-[var(--muted)]">
                No open order. Seat guests from POS and send to kitchen.
              </p>
            )}

            {canEdit ? (
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void saveSelected()}
                >
                  Save
                </Button>
                <Button
                  variant="danger"
                  disabled={busy || selected.status !== "FREE"}
                  onClick={() => void deleteSelected()}
                >
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
