"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { platformFetch } from "@/components/PlatformAuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  MODULE_IDS,
  MODULE_LABELS,
  type ModuleId,
} from "@/lib/platform/modules";
import { PLAN_LABEL, label } from "@/lib/labels";
import { ConsolePageSkeleton } from "@/components/ui/Skeleton";

type Row = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  modules: Record<ModuleId, boolean>;
  modulesEnabledCount: number;
  modulesTotal: number;
};

export default function ModulesMatrixPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await platformFetch("/api/platform/restaurants");
      setRows(data.restaurants);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(restaurantId: string, moduleId: ModuleId, next: boolean) {
    setBusy(`${restaurantId}:${moduleId}`);
    try {
      await platformFetch(`/api/platform/restaurants/${restaurantId}`, {
        method: "PATCH",
        body: JSON.stringify({ modules: { [moduleId]: next } }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function bulk(restaurantId: string, action: "all" | "reset") {
    setBusy(restaurantId);
    try {
      await platformFetch(`/api/platform/restaurants/${restaurantId}`, {
        method: "PATCH",
        body: JSON.stringify(
          action === "all" ? { enableAllModules: true } : { resetModules: true }
        ),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  if (!rows.length && !error) return <ConsolePageSkeleton />;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Enable or disable product modules per restaurant. Tenant nav hides
            disabled modules.
          </p>
        </div>
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            Overview
          </Button>
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="sticky left-0 bg-[var(--surface-2)] px-3 py-3 font-medium">
                Restaurant
              </th>
              {MODULE_IDS.map((id) => (
                <th key={id} className="px-2 py-3 text-center font-medium">
                  <span className="inline-block max-w-[4.5rem] truncate" title={MODULE_LABELS[id]}>
                    {MODULE_LABELS[id]}
                  </span>
                </th>
              ))}
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                <td className="sticky left-0 bg-[var(--surface)] px-3 py-2">
                  <Link
                    href={`/admin/restaurants/${r.id}`}
                    className="font-medium hover:text-[var(--accent)]"
                  >
                    {r.name}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">
                    {label(PLAN_LABEL, r.plan)} · {r.modulesEnabledCount}/
                    {r.modulesTotal}
                  </p>
                </td>
                {MODULE_IDS.map((id) => {
                  const on = r.modules?.[id] !== false;
                  const key = `${r.id}:${id}`;
                  return (
                    <td key={id} className="px-2 py-2 text-center">
                      <button
                        type="button"
                        disabled={busy === key || busy === r.id}
                        onClick={() => void toggle(r.id, id, !on)}
                        className={`h-7 w-7 rounded text-xs font-semibold ${
                          on
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-[var(--surface-2)] text-[var(--muted)]"
                        }`}
                        title={`${MODULE_LABELS[id]}: ${on ? "on" : "off"}`}
                      >
                        {on ? "●" : "○"}
                      </button>
                    </td>
                  );
                })}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === r.id}
                      onClick={() => void bulk(r.id, "all")}
                    >
                      All
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === r.id}
                      onClick={() => void bulk(r.id, "reset")}
                    >
                      Plan default
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-[var(--muted)]">No restaurants.</p>
        ) : null}
      </Card>
    </div>
  );
}
