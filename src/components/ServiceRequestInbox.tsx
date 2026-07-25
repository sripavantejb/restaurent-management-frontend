"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  SERVICE_STATUS_LABEL,
  SERVICE_TYPE_LABEL,
  label,
  type ServiceType,
} from "@/lib/labels";

export interface ServiceReq {
  id: string;
  type: ServiceType;
  status: "OPEN" | "ACKNOWLEDGED" | "DONE";
  tableId: string;
  tableNumber: number | null;
  sessionId: string;
  createdAt: string;
}

function ageLabel(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  return `${mins} min ago`;
}

export function ServiceRequestInbox({
  onNewRequest,
  onSelectTable,
  className = "",
  maxHeightClass = "max-h-[320px]",
}: {
  onNewRequest?: (req: ServiceReq) => void;
  onSelectTable?: (tableId: string, tableNumber: number | null) => void;
  className?: string;
  maxHeightClass?: string;
}) {
  const { activeBranchId, hasPermission } = useAuth();
  const canManage = hasPermission("sessions.manage");
  const [requests, setRequests] = useState<ServiceReq[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const data = await apiFetch("/api/service-requests?status=active", {
        branchId: activeBranchId,
      });
      const next = (data.requests ?? []) as ServiceReq[];
      if (primedRef.current && onNewRequest) {
        for (const r of next) {
          if (r.status === "OPEN" && !seenRef.current.has(r.id)) {
            onNewRequest(r);
          }
        }
      }
      for (const r of next) seenRef.current.add(r.id);
      primedRef.current = true;
      setRequests(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load requests");
    }
  }, [activeBranchId, onNewRequest]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [load]);

  async function updateStatus(id: string, status: "ACKNOWLEDGED" | "DONE") {
    if (!canManage) return;
    setBusyId(id);
    try {
      await apiFetch("/api/service-requests", {
        method: "PATCH",
        branchId: activeBranchId,
        body: JSON.stringify({ id, status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div
      className={`rounded-[6px] border border-[var(--border)] bg-white ${className}`}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
          Guest calls
        </p>
        {requests.length > 0 ? (
          <Badge tone="accent">{requests.length} open</Badge>
        ) : (
          <span className="text-xs text-[var(--muted)]">Quiet</span>
        )}
      </div>

      {error ? (
        <p className="px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}

      {requests.length === 0 ? (
        <p className="px-3 py-6 text-sm text-[var(--muted)]">
          No guest calls. Water, waiter, cutlery, and bill requests appear here.
        </p>
      ) : (
        <ul
          className={`${maxHeightClass} divide-y divide-[var(--border)] overflow-auto`}
        >
          {requests.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-2 px-3 py-2.5 ${
                r.status === "OPEN" ? "bg-[var(--accent)]/5" : ""
              }`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onSelectTable?.(r.tableId, r.tableNumber)}
              >
                <p className="text-sm font-medium">
                  <span className="num">T{r.tableNumber ?? "?"}</span>
                  <span className="mx-1.5 text-[var(--muted)]">·</span>
                  {label(SERVICE_TYPE_LABEL, r.type)}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {ageLabel(r.createdAt)}
                  {r.status === "ACKNOWLEDGED"
                    ? ` · ${label(SERVICE_STATUS_LABEL, r.status)}`
                    : ""}
                </p>
              </button>
              {canManage ? (
                <div className="flex shrink-0 gap-1">
                  {r.status === "OPEN" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId === r.id}
                      onClick={() => void updateStatus(r.id, "ACKNOWLEDGED")}
                    >
                      On my way
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => void updateStatus(r.id, "DONE")}
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <Badge tone={r.status === "OPEN" ? "accent" : "warn"}>
                  {label(SERVICE_STATUS_LABEL, r.status)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
