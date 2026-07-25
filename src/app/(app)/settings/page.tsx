"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ConsolePageSkeleton } from "@/components/ui/Skeleton";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Settings = {
  name: string;
  logoUrl: string;
  gstNumber: string;
  fssaiNumber: string;
  currency: string;
  timezone: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  qrOrderingEnabled: boolean;
  qrApprovalMode: boolean;
  maxGuestOrderPaise: number;
  wifiSsid: string;
  wifiPassword: string;
  businessHours: { day: number; open: string; close: string; closed: boolean }[];
  taxSettings: {
    mode: "INCLUSIVE" | "EXCLUSIVE";
    gstRate: number;
    cessRate: number;
    serviceChargePct: number;
    roundOff: boolean;
  };
  receiptSettings: {
    footer: string;
    thankYou: string;
    terms: string;
    showLogo: boolean;
    showGst: boolean;
    showFssai: boolean;
  };
  branding: { primaryColor: string; accentColor: string; fontFamily: string };
  locale: { language: string; dateFormat: string };
};

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const [s, setS] = useState<Settings | null>(null);
  const [tab, setTab] = useState<
    "profile" | "hours" | "tax" | "receipt" | "brand" | "qr"
  >("profile");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await apiFetch("/api/settings/restaurant");
    setS(data);
  }, []);

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "Load failed")
    );
  }, [load]);

  if (!hasPermission("qr.manage")) {
    return (
      <div className="p-6 text-sm text-[var(--muted)]">
        Admin permission required for restaurant setup.
      </div>
    );
  }

  async function save(patch: Record<string, unknown>) {
    if (!s) return;
    const data = await apiFetch("/api/settings/restaurant", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setS(data);
    setToast("Saved");
    setTimeout(() => setToast(""), 2000);
  }

  if (!s) {
    if (error) {
      return (
        <div className="p-6">
          <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        </div>
      );
    }
    return <ConsolePageSkeleton />;
  }

  const tabs = [
    ["profile", "Profile"],
    ["hours", "Hours"],
    ["tax", "Taxes"],
    ["receipt", "Receipt"],
    ["brand", "Theme"],
    ["qr", "QR"],
  ] as const;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Restaurant setup
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Profile, GST, hours, receipt, branding, currency & language
          </p>
        </div>
        {toast ? (
          <span className="text-sm text-[var(--success)]">{toast}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-[6px] px-3 py-1.5 text-sm ${
              tab === id
                ? "bg-[var(--ink)] text-white"
                : "border border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" ? (
        <Card className="space-y-3 p-4">
          <Input
            value={s.name}
            onChange={(e) => setS({ ...s, name: e.target.value })}
            placeholder="Restaurant name"
          />
          <Input
            value={s.logoUrl}
            onChange={(e) => setS({ ...s, logoUrl: e.target.value })}
            placeholder="Logo URL"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={s.gstNumber}
              onChange={(e) => setS({ ...s, gstNumber: e.target.value })}
              placeholder="GSTIN"
            />
            <Input
              value={s.fssaiNumber}
              onChange={(e) => setS({ ...s, fssaiNumber: e.target.value })}
              placeholder="FSSAI"
            />
            <Input
              value={s.currency}
              onChange={(e) => setS({ ...s, currency: e.target.value })}
              placeholder="Currency (INR)"
            />
            <Input
              value={s.locale.language}
              onChange={(e) =>
                setS({
                  ...s,
                  locale: { ...s.locale, language: e.target.value },
                })
              }
              placeholder="Language (en-IN)"
            />
          </div>
          <Input
            value={s.address}
            onChange={(e) => setS({ ...s, address: e.target.value })}
            placeholder="Address"
          />
          <Button
            onClick={() =>
              void save({
                name: s.name,
                logoUrl: s.logoUrl,
                gstNumber: s.gstNumber,
                fssaiNumber: s.fssaiNumber,
                currency: s.currency,
                address: s.address,
                locale: s.locale,
              })
            }
          >
            Save profile
          </Button>
        </Card>
      ) : null}

      {tab === "hours" ? (
        <Card className="space-y-2 p-4">
          {(s.businessHours?.length
            ? s.businessHours
            : DAYS.map((_, day) => ({
                day,
                open: "10:00",
                close: "22:00",
                closed: false,
              }))
          ).map((h, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-10 font-medium">{DAYS[h.day] ?? h.day}</span>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={h.closed}
                  onChange={(e) => {
                    const hours = [...s.businessHours];
                    hours[i] = { ...h, closed: e.target.checked };
                    setS({ ...s, businessHours: hours });
                  }}
                />
                Closed
              </label>
              <Input
                className="w-28"
                value={h.open}
                disabled={h.closed}
                onChange={(e) => {
                  const hours = [...s.businessHours];
                  hours[i] = { ...h, open: e.target.value };
                  setS({ ...s, businessHours: hours });
                }}
              />
              <Input
                className="w-28"
                value={h.close}
                disabled={h.closed}
                onChange={(e) => {
                  const hours = [...s.businessHours];
                  hours[i] = { ...h, close: e.target.value };
                  setS({ ...s, businessHours: hours });
                }}
              />
            </div>
          ))}
          <Button onClick={() => void save({ businessHours: s.businessHours })}>
            Save hours
          </Button>
        </Card>
      ) : null}

      {tab === "tax" ? (
        <Card className="space-y-3 p-4">
          <select
            className="h-10 w-full rounded-[6px] border border-[var(--border)] px-2"
            value={s.taxSettings.mode}
            onChange={(e) =>
              setS({
                ...s,
                taxSettings: {
                  ...s.taxSettings,
                  mode: e.target.value as "INCLUSIVE" | "EXCLUSIVE",
                },
              })
            }
          >
            <option value="EXCLUSIVE">Exclusive GST</option>
            <option value="INCLUSIVE">Inclusive GST</option>
          </select>
          <Input
            type="number"
            step="0.01"
            value={s.taxSettings.gstRate}
            onChange={(e) =>
              setS({
                ...s,
                taxSettings: {
                  ...s.taxSettings,
                  gstRate: Number(e.target.value),
                },
              })
            }
            placeholder="GST rate (0.05 = 5%)"
          />
          <Input
            type="number"
            step="0.01"
            value={s.taxSettings.serviceChargePct}
            onChange={(e) =>
              setS({
                ...s,
                taxSettings: {
                  ...s.taxSettings,
                  serviceChargePct: Number(e.target.value),
                },
              })
            }
            placeholder="Service charge %"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.taxSettings.roundOff}
              onChange={(e) =>
                setS({
                  ...s,
                  taxSettings: {
                    ...s.taxSettings,
                    roundOff: e.target.checked,
                  },
                })
              }
            />
            Round off totals
          </label>
          <Button onClick={() => void save({ taxSettings: s.taxSettings })}>
            Save tax
          </Button>
        </Card>
      ) : null}

      {tab === "receipt" ? (
        <Card className="space-y-3 p-4">
          <Input
            value={s.receiptSettings.footer}
            onChange={(e) =>
              setS({
                ...s,
                receiptSettings: {
                  ...s.receiptSettings,
                  footer: e.target.value,
                },
              })
            }
            placeholder="Footer"
          />
          <Input
            value={s.receiptSettings.thankYou}
            onChange={(e) =>
              setS({
                ...s,
                receiptSettings: {
                  ...s.receiptSettings,
                  thankYou: e.target.value,
                },
              })
            }
            placeholder="Thank you message"
          />
          <Input
            value={s.receiptSettings.terms}
            onChange={(e) =>
              setS({
                ...s,
                receiptSettings: {
                  ...s.receiptSettings,
                  terms: e.target.value,
                },
              })
            }
            placeholder="Terms"
          />
          <Button
            onClick={() => void save({ receiptSettings: s.receiptSettings })}
          >
            Save receipt
          </Button>
        </Card>
      ) : null}

      {tab === "brand" ? (
        <Card className="space-y-3 p-4">
          <Input
            value={s.branding.primaryColor}
            onChange={(e) =>
              setS({
                ...s,
                branding: { ...s.branding, primaryColor: e.target.value },
              })
            }
            placeholder="Primary color"
          />
          <Input
            value={s.branding.accentColor}
            onChange={(e) =>
              setS({
                ...s,
                branding: { ...s.branding, accentColor: e.target.value },
              })
            }
            placeholder="Accent color"
          />
          <Button
            onClick={() => {
              document.documentElement.style.setProperty(
                "--accent",
                s.branding.accentColor
              );
              void save({ branding: s.branding });
            }}
          >
            Apply theme
          </Button>
        </Card>
      ) : null}

      {tab === "qr" ? (
        <Card className="space-y-3 p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.qrOrderingEnabled}
              onChange={(e) =>
                setS({ ...s, qrOrderingEnabled: e.target.checked })
              }
            />
            QR ordering enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.qrApprovalMode}
              onChange={(e) =>
                setS({ ...s, qrApprovalMode: e.target.checked })
              }
            />
            Waiter approval for guest orders
          </label>
          <Input
            value={s.wifiSsid}
            onChange={(e) => setS({ ...s, wifiSsid: e.target.value })}
            placeholder="Wi‑Fi SSID"
          />
          <Input
            value={s.wifiPassword}
            onChange={(e) => setS({ ...s, wifiPassword: e.target.value })}
            placeholder="Wi‑Fi password"
          />
          <Button
            onClick={() =>
              void save({
                qrOrderingEnabled: s.qrOrderingEnabled,
                qrApprovalMode: s.qrApprovalMode,
                wifiSsid: s.wifiSsid,
                wifiPassword: s.wifiPassword,
              })
            }
          >
            Save QR settings
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
