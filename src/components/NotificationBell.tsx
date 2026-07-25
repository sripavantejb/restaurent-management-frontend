"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { apiFetch, useAuth } from "@/components/AuthProvider";

interface Notif {
  id: string;
  title: string;
  body: string;
  href?: string | null;
  readAt?: string | null;
  createdAt?: string;
}

export function NotificationBell() {
  const { activeBranchId, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!activeBranchId || !user) return;
    try {
      const res = await apiFetch("/api/notifications", {
        branchId: activeBranchId,
      });
      setItems(res.notifications ?? []);
      setUnread(res.unread ?? 0);
    } catch {
      /* ignore — bell is non-critical */
    }
  }, [activeBranchId, user]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  async function markAll() {
    if (!activeBranchId) return;
    try {
      await apiFetch("/api/notifications", {
        method: "PATCH",
        branchId: activeBranchId,
        body: JSON.stringify({ all: true }),
      });
      void load();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-[6px] p-2 text-[var(--ink)] hover:bg-[var(--surface-2)]"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] shadow-lg">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 ? (
                <button
                  type="button"
                  className="text-xs text-[var(--accent)]"
                  onClick={() => void markAll()}
                >
                  Mark all read
                </button>
              ) : null}
            </div>
            <ul className="max-h-72 overflow-auto">
              {items.length === 0 ? (
                <li className="px-3 py-4 text-sm text-[var(--muted)]">
                  No notifications yet
                </li>
              ) : (
                items.slice(0, 12).map((n) => (
                  <li
                    key={n.id}
                    className={`border-b border-[var(--border)] px-3 py-2 text-sm last:border-0 ${
                      !n.readAt ? "bg-[var(--surface-2)]" : ""
                    }`}
                  >
                    {n.href ? (
                      <Link
                        href={n.href}
                        className="block"
                        onClick={() => setOpen(false)}
                      >
                        <p className="font-medium">{n.title}</p>
                        <p className="text-xs text-[var(--muted)]">{n.body}</p>
                      </Link>
                    ) : (
                      <>
                        <p className="font-medium">{n.title}</p>
                        <p className="text-xs text-[var(--muted)]">{n.body}</p>
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
