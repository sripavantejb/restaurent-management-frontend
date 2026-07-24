"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

interface Settings {
  name: string;
  slug: string;
  qrOrderingEnabled: boolean;
  qrApprovalMode: boolean;
  maxGuestOrderPaise: number;
  wifiSsid: string;
  wifiPassword: string;
}

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/settings/restaurant");
      setSettings(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hasPermission("qr.manage")) {
    return (
      <div className="p-6 text-sm text-[var(--muted)]">
        Only restaurant admins can change QR ordering settings.
      </div>
    );
  }

  async function save(patch: Partial<Settings>) {
    if (!settings) return;
    setBusy(true);
    try {
      const data = await apiFetch("/api/settings/restaurant", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setSettings(data);
      setToast("Settings saved");
      setTimeout(() => setToast(""), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <div className="p-6 text-[var(--muted)]">
        {error || "Loading settings…"}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Control guest QR menu ordering for {settings.name}.
          </p>
        </div>
        {toast ? (
          <span className="rounded-[6px] bg-[var(--success)]/15 px-3 py-1 text-sm text-[var(--success)]">
            {toast}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-base font-semibold">QR menu ordering</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              When off, guests who scan a table QR can still open the landing
              screen, but they cannot start a session, browse to order, or place
              rounds. Use this to pause QR ordering without reprinting codes.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.qrOrderingEnabled}
            disabled={busy}
            onClick={() =>
              void save({ qrOrderingEnabled: !settings.qrOrderingEnabled })
            }
            className={`relative h-8 w-14 shrink-0 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
              settings.qrOrderingEnabled
                ? "bg-[var(--success)]"
                : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                settings.qrOrderingEnabled ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
        <p className="mt-4 text-sm font-medium">
          Status:{" "}
          <span
            className={
              settings.qrOrderingEnabled
                ? "text-[var(--success)]"
                : "text-[var(--accent)]"
            }
          >
            {settings.qrOrderingEnabled ? "ON — guests can order" : "OFF — ordering blocked"}
          </span>
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-base font-semibold">Staff approval for QR orders</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              When on, guest rounds wait for POS approval before the kitchen sees
              them.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.qrApprovalMode}
            disabled={busy}
            onClick={() =>
              void save({ qrApprovalMode: !settings.qrApprovalMode })
            }
            className={`relative h-8 w-14 shrink-0 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
              settings.qrApprovalMode ? "bg-[var(--success)]" : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                settings.qrApprovalMode ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="text-base font-semibold">Guest Wi‑Fi on printed QR cards</h2>
        <label className="block text-xs text-[var(--muted)]">
          SSID
          <Input
            className="mt-1"
            value={settings.wifiSsid}
            onChange={(e) =>
              setSettings({ ...settings, wifiSsid: e.target.value })
            }
          />
        </label>
        <label className="block text-xs text-[var(--muted)]">
          Password
          <Input
            className="mt-1"
            value={settings.wifiPassword}
            onChange={(e) =>
              setSettings({ ...settings, wifiPassword: e.target.value })
            }
          />
        </label>
        <Button
          disabled={busy}
          onClick={() =>
            void save({
              wifiSsid: settings.wifiSsid,
              wifiPassword: settings.wifiPassword,
            })
          }
        >
          Save Wi‑Fi
        </Button>
      </Card>
    </div>
  );
}
