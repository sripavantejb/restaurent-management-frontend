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
import { ServiceRequestInbox } from "@/components/ServiceRequestInbox";
import {
  ORDER_STATUS_LABEL,
  TABLE_SHAPE_LABEL,
  TABLE_STATUS_LABEL,
  isTableAvailable,
  label,
  tableDisplayStatus,
} from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { SplitPaneSkeleton } from "@/components/ui/Skeleton";

interface TableRow {
  id: string;
  number: number;
  capacity: number;
  shape: string;
  x: number;
  y: number;
  status: string;
  isVip?: boolean;
  isOutdoor?: boolean;
  floorId?: string | null;
  sectionId?: string | null;
  mergeGroupId?: string | null;
  currentSessionId?: string | null;
  currentSession: {
    id: string;
    sessionNumber: string;
    status: string;
    guestCount: number;
    rounds: number;
    total: number;
    dueAmount: number;
  } | null;
  currentOrder: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
  } | null;
  qrCode: {
    id: string;
    shortCode: string;
    shortUrl: string;
    label: string;
    scanCount: number;
    lastScannedAt: string | null;
  } | null;
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "#2A9D8F",
  FREE: "#2A9D8F",
  OCCUPIED: "#E9C46A",
  RESERVED: "#6B6560",
  PREPARING_BILL: "#3B82F6",
  BILLED: "#3B82F6",
  CLEANING: "#A78BFA",
  BLOCKED: "#EF4444",
  OUT_OF_SERVICE: "#9CA3AF",
};

const EDIT_STATUSES = [
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "PREPARING_BILL",
  "CLEANING",
  "BLOCKED",
  "OUT_OF_SERVICE",
] as const;

const SHAPES = ["SQUARE", "ROUND", "RECT"] as const;

export default function TablesPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const canEdit = hasPermission("tables.update");
  const canManageSessions = hasPermission("sessions.manage");
  const canManageQr = hasPermission("qr.manage");
  const canPay = hasPermission("payments.create");

  const [tables, setTables] = useState<TableRow[]>([]);
  const [selected, setSelected] = useState<TableRow | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [floors, setFloors] = useState<{ id: string; name: string }[]>([]);
  const [floorFilter, setFloorFilter] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [qrPreview, setQrPreview] = useState<{
    tableId: string;
    shortUrl: string;
    svg: string;
  } | null>(null);
  const [form, setForm] = useState({
    number: "",
    capacity: "4",
    shape: "SQUARE" as (typeof SHAPES)[number],
    status: "AVAILABLE",
    isVip: false,
    isOutdoor: false,
  });
  const [mergeIds, setMergeIds] = useState<string[]>([]);

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
        const [data, fl] = await Promise.all([
          apiFetch("/api/tables", { branchId: activeBranchId }),
          apiFetch("/api/floors", { branchId: activeBranchId }).catch(() => ({
            floors: [],
          })),
        ]);
        setTables(data.tables);
        setFloors(fl.floors ?? []);
        setSelected((prev) => {
          if (!prev) return prev;
          const next = (data.tables as TableRow[]).find((t) => t.id === prev.id);
          return next ?? prev;
        });
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load tables");
      } finally {
        setReady(true);
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
      status: "AVAILABLE",
      isVip: false,
      isOutdoor: false,
    });
    setCreateOpen(true);
  }

  function openEdit(t: TableRow) {
    setSelected(t);
    setQrPreview(null);
    setForm({
      number: String(t.number),
      capacity: String(t.capacity),
      shape: (SHAPES.includes(t.shape as (typeof SHAPES)[number])
        ? t.shape
        : "SQUARE") as (typeof SHAPES)[number],
      status: isTableAvailable(t.status) ? "AVAILABLE" : t.status,
      isVip: !!t.isVip,
      isOutdoor: !!t.isOutdoor,
    });
  }

  async function generateQr(tableId: string) {
    if (!canManageQr) return;
    setBusy(true);
    try {
      const data = await apiFetch("/api/qr", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({
          tableIds: [tableId],
          designId: "classic",
          fg: "#12100E",
          bg: "#FFFFFF",
          printSizeCm: 4,
        }),
      });
      const created = data.created?.[0];
      if (created) {
        setQrPreview({
          tableId,
          shortUrl: created.shortUrl,
          svg: created.svg,
        });
        showToast(`QR ready for Table ${created.tableNumber}`);
      }
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "QR generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteQr(tableId: string) {
    if (!canManageQr) return;
    if (
      !confirm(
        "Deactivate this table’s QR code? Guests will need a newly generated code."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/qr", {
        method: "DELETE",
        branchId: activeBranchId,
        body: JSON.stringify({ tableId }),
      });
      if (qrPreview?.tableId === tableId) setQrPreview(null);
      showToast("QR code deactivated");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "QR delete failed");
    } finally {
      setBusy(false);
    }
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
          status: "AVAILABLE",
          isVip: form.isVip,
          isOutdoor: form.isOutdoor,
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
          isVip: form.isVip,
          isOutdoor: form.isOutdoor,
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
                isVip: updated.isVip,
                isOutdoor: updated.isOutdoor,
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

  async function markCleaned(tableId: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/tables/${tableId}`, {
        method: "PATCH",
        branchId: activeBranchId,
        body: JSON.stringify({ status: "AVAILABLE" }),
      });
      showToast("Table marked available");
      setSelected(null);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function mergeSelectedTables() {
    if (mergeIds.length < 2) {
      showToast("Select 2+ available tables to merge");
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch("/api/tables/merge", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({ tableIds: mergeIds }),
      });
      showToast(`Merged · group ${data.mergeGroupId?.slice(0, 8) ?? ""}`);
      setMergeIds([]);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleMergePick(id: string) {
    setMergeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
      setQrPreview(null);
      showToast("Table deleted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function generateMissingQrs() {
    if (!canManageQr) return;
    const missing = tables.filter((t) => !t.qrCode).map((t) => t.id);
    if (missing.length === 0) {
      showToast("Every table already has a QR");
      return;
    }
    setBusy(true);
    try {
      const data = await apiFetch("/api/qr", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({
          tableIds: missing,
          designId: "classic",
          fg: "#12100E",
          bg: "#FFFFFF",
          printSizeCm: 4,
        }),
      });
      showToast(`Generated ${(data.created ?? []).length} QR codes`);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk QR generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function printQrPack() {
    const withQr = (floorFilter ? visibleTables : tables).filter(
      (t) => t.qrCode?.shortUrl
    );
    if (withQr.length === 0) {
      showToast("No QR codes to print — generate first");
      return;
    }
    setBusy(true);
    try {
      const QRCode = (await import("qrcode")).default;
      const cards = await Promise.all(
        withQr.map(async (t) => {
          const svg = await QRCode.toString(t.qrCode!.shortUrl, {
            type: "svg",
            errorCorrectionLevel: "H",
            margin: 2,
            width: 220,
            color: { dark: "#12100E", light: "#FFFFFF" },
          });
          return { number: t.number, svg, url: t.qrCode!.shortUrl };
        })
      );
      const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
      if (!w) {
        showToast("Allow popups to print QR pack");
        return;
      }
      w.document.write(`<!doctype html><html><head><title>QR pack</title>
<style>
  body{font-family:Georgia,serif;padding:16px;color:#12100e;background:#fff}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}
  .card{border:1px solid #ddd;padding:12px;text-align:center;page-break-inside:avoid}
  .card svg{width:160px;height:160px}
  h2{margin:0 0 6px;font-size:18px}
  p{margin:0;font-size:10px;word-break:break-all;color:#666}
  @media print{body{padding:0}.card{border-color:#bbb}}
</style></head><body>
<h1 style="font-size:20px;margin:0 0 16px">Table QR pack · ${cards.length} codes</h1>
<div class="grid">
${cards
  .map(
    (c) =>
      `<div class="card"><h2>Table ${c.number}</h2>${c.svg}<p>${c.url}</p></div>`
  )
  .join("")}
</div>
<script>setTimeout(function(){window.print()},400)</script>
</body></html>`);
      w.document.close();
      showToast(`Print pack · ${cards.length} tables`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "QR pack failed");
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

  async function sessionAction(sessionId: string, action: "REOPEN" | "CLOSE") {
    setBusy(true);
    try {
      await apiFetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        branchId: activeBranchId,
        body: JSON.stringify({ action }),
      });
      showToast(action === "REOPEN" ? "Table reopened for ordering" : "Session closed");
      setSelected(null);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Session action failed");
    } finally {
      setBusy(false);
    }
  }

  async function collectSessionBill(sessionId: string, due: number, tableNumber: number) {
    if (
      !confirm(
        `Collect ${formatMoney(due)} for Table ${tableNumber}? Marks bill paid and frees the table — same QR stays valid.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/payments", {
        method: "POST",
        branchId: activeBranchId,
        body: JSON.stringify({ sessionId, method: "UPI" }),
      });
      showToast(`Bill paid · Table ${tableNumber} ready for next guests`);
      setSelected(null);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Collect failed");
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
  const visibleTables = floorFilter
    ? tables.filter((t) => t.floorId === floorFilter)
    : tables;
  const listSorted = [...visibleTables].sort((a, b) => a.number - b.number);

  if (!ready) return <SplitPaneSkeleton />;

  return (
    <div className="p-4 sm:p-6">
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
          <select
            className="h-10 rounded-[6px] border border-[var(--border)] bg-white px-3 text-sm"
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            aria-label="Floor filter"
          >
            <option value="">All floors</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          {canEdit ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const name = window.prompt("Floor name", "Ground");
                if (!name?.trim()) return;
                await apiFetch("/api/floors", {
                  method: "POST",
                  branchId: activeBranchId,
                  body: JSON.stringify({ name: name.trim() }),
                });
                void load(true);
              }}
            >
              Add floor
            </Button>
          ) : null}
          {toast ? (
            <span className="rounded-[6px] bg-[var(--success)]/15 px-3 py-1 text-sm text-[var(--success)]">
              {toast}
            </span>
          ) : null}
          {canManageQr ? (
            <>
              <Button
                variant="secondary"
                disabled={busy || tables.every((t) => t.qrCode)}
                onClick={() => void generateMissingQrs()}
              >
                Generate missing QRs
              </Button>
              <Button
                variant="secondary"
                disabled={busy || tables.every((t) => !t.qrCode)}
                onClick={() => void printQrPack()}
              >
                Print QR pack
              </Button>
            </>
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
        {EDIT_STATUSES.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: STATUS_COLOR[k] }}
            />
            {label(TABLE_STATUS_LABEL, k)}
          </span>
        ))}
      </div>

      {editMode && canEdit ? (
        <div className="mt-4 flex flex-wrap gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
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
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || mergeIds.length < 2}
            onClick={() => void mergeSelectedTables()}
          >
            Merge selected ({mergeIds.length})
          </Button>
          {mergeIds.length ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMergeIds([])}
            >
              Clear merge picks
            </Button>
          ) : null}
          {dirty ? (
            <span className="self-center text-xs text-[var(--accent)]">
              Unsaved position / number changes
            </span>
          ) : (
            <span className="self-center text-xs text-[var(--muted)]">
              Drag tables · click ↑/↓ to renumber · pick free tables then Merge
            </span>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        <div
          className="hidden overflow-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] p-4 md:block"
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
              {visibleTables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (dragRef.current?.moved) return;
                    if (editMode && isTableAvailable(t.status)) {
                      toggleMergePick(t.id);
                      return;
                    }
                    openEdit(t);
                  }}
                  onPointerDown={(e) => onPointerDown(e, t)}
                  className={`absolute flex flex-col items-center justify-center border-2 bg-[var(--surface)] text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                    editMode ? "cursor-grab active:cursor-grabbing" : ""
                  } ${mergeIds.includes(t.id) ? "ring-2 ring-[var(--accent)]" : ""}`}
                  style={{
                    left: t.x,
                    top: t.y,
                    width: t.shape === "RECT" ? 100 : 80,
                    height: t.shape === "RECT" ? 64 : 80,
                    borderRadius: t.shape === "ROUND" ? 999 : 6,
                    borderColor:
                      t.currentSession?.status === "BILL_REQUESTED"
                        ? "#3B82F6"
                        : STATUS_COLOR[t.status] ?? "#6B6560",
                    touchAction: editMode ? "none" : undefined,
                  }}
                >
                  <span className="num text-lg">T{t.number}</span>
                  <span className="text-[10px] text-[var(--muted)]">
                    {t.currentSession?.status === "BILL_REQUESTED"
                      ? "Bill due"
                      : `${t.capacity}p`}
                    {t.isVip ? " · VIP" : ""}
                    {t.isOutdoor ? " · Out" : ""}
                    {t.qrCode ? " · QR" : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <ServiceRequestInbox />

          <div className="rounded-[6px] border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
              Tables · {tables.length}
              <span className="ml-2 font-normal normal-case md:hidden">
                (floor plan on larger screens)
              </span>
            </div>
            <ul className="max-h-[min(60vh,480px)] overflow-auto md:max-h-[320px]">
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
                      {t.capacity}p ·{" "}
                      {tableDisplayStatus(t.status, t.currentSession?.status)}
                      {t.qrCode ? " · QR" : " · no QR"}
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
                  {label(TABLE_SHAPE_LABEL, s)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isVip}
              onChange={(e) => setForm({ ...form, isVip: e.target.checked })}
            />
            VIP table
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isOutdoor}
              onChange={(e) => setForm({ ...form, isOutdoor: e.target.checked })}
            />
            Outdoor
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
                        {label(TABLE_SHAPE_LABEL, s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-[var(--muted)]">
                  Status
                  <select
                    className="mt-1 h-10 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                  >
                    {EDIT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {label(TABLE_STATUS_LABEL, s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isVip}
                    onChange={(e) =>
                      setForm({ ...form, isVip: e.target.checked })
                    }
                  />
                  VIP
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isOutdoor}
                    onChange={(e) =>
                      setForm({ ...form, isOutdoor: e.target.checked })
                    }
                  />
                  Outdoor
                </label>
              </>
            ) : (
              <>
                <p>
                  Status:{" "}
                  <strong
                    style={{
                      color: STATUS_COLOR[selected.status] ?? undefined,
                    }}
                  >
                    {label(TABLE_STATUS_LABEL, selected.status)}
                  </strong>
                  {selected.isVip ? " · VIP" : ""}
                  {selected.isOutdoor ? " · Outdoor" : ""}
                </p>
                <p>Capacity: {selected.capacity}</p>
              </>
            )}

            {selected.status === "CLEANING" && canEdit ? (
              <Button
                disabled={busy}
                onClick={() => void markCleaned(selected.id)}
              >
                Mark cleaned → Available
              </Button>
            ) : null}

            {selected.currentSession ? (
              <div className="rounded-[6px] border border-[var(--border)] p-3">
                <p className="text-xs text-[var(--muted)] uppercase tracking-wide">
                  QR session
                </p>
                <p className="num font-semibold">
                  {selected.currentSession.sessionNumber}
                </p>
                <p className="text-[var(--muted)]">
                  {tableDisplayStatus(
                    selected.status,
                    selected.currentSession.status
                  )}{" "}
                  · {selected.currentSession.guestCount} guests ·{" "}
                  {selected.currentSession.rounds} rounds
                </p>
                <p className="num mt-1 text-lg">
                  {formatMoney(selected.currentSession.total)}
                  {selected.currentSession.dueAmount > 0 ? (
                    <span className="ml-2 text-sm text-[var(--accent)]">
                      due {formatMoney(selected.currentSession.dueAmount)}
                    </span>
                  ) : null}
                </p>
                {canManageSessions || canPay ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canPay && selected.currentSession.dueAmount > 0 ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void collectSessionBill(
                            selected.currentSession!.id,
                            selected.currentSession!.dueAmount,
                            selected.number
                          )
                        }
                      >
                        Collect bill (paid)
                      </Button>
                    ) : null}
                    {canManageSessions &&
                    (selected.currentSession.status === "BILL_REQUESTED" ||
                      selected.currentSession.status === "BILLED") ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void sessionAction(selected.currentSession!.id, "REOPEN")
                        }
                      >
                        Reopen for ordering
                      </Button>
                    ) : null}
                    {canManageSessions ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void sessionAction(selected.currentSession!.id, "CLOSE")
                        }
                      >
                        Close & free table
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {selected.currentOrder ? (
              <div className="rounded-[6px] border border-[var(--border)] p-3">
                <p className="num font-semibold">
                  {selected.currentOrder.orderNumber}
                </p>
                <p className="text-[var(--muted)]">
                  {label(ORDER_STATUS_LABEL, selected.currentOrder.status)}
                </p>
                <p className="num mt-1 text-lg">
                  {formatMoney(selected.currentOrder.total)}
                </p>
              </div>
            ) : !selected.currentSession ? (
              <p className="text-[var(--muted)]">
                No open order. Seat guests from POS or let them scan the table QR.
              </p>
            ) : null}

            <div className="rounded-[6px] border border-[var(--border)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Table QR
              </p>
              {selected.qrCode ? (
                <>
                  <p className="mt-1 break-all font-mono text-xs text-[var(--muted)]">
                    {selected.qrCode.shortUrl}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {selected.qrCode.scanCount} scans
                    {selected.qrCode.lastScannedAt
                      ? ` · last ${new Date(
                          selected.qrCode.lastScannedAt
                        ).toLocaleString("en-IN")}`
                      : " · never scanned"}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  No active QR for this table yet.
                </p>
              )}
              {qrPreview?.tableId === selected.id && qrPreview.svg ? (
                <div
                  className="mx-auto mt-3 w-40 [&_svg]:h-full [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qrPreview.svg }}
                />
              ) : null}
              {canManageQr ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void generateQr(selected.id)}
                  >
                    {selected.qrCode ? "Regenerate QR" : "Generate QR"}
                  </Button>
                  {selected.qrCode ? (
                    <>
                      <a
                        href={selected.qrCode.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center rounded-[6px] border border-[var(--border)] px-3 text-xs font-medium hover:bg-[var(--surface-2)]"
                      >
                        Test scan
                      </a>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => void deleteQr(selected.id)}
                      >
                        Delete QR
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

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
                  disabled={busy || !isTableAvailable(selected.status)}
                  onClick={() => void deleteSelected()}
                >
                  Delete table
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
