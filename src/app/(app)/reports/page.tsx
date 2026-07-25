"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const LINKS = [
  { href: "/dashboard", label: "Live dashboard", desc: "Revenue, kitchen, stock, HR" },
  { href: "/inventory", label: "Inventory reports", desc: "Ledger, dead stock, CSV, food cost" },
  { href: "/finance", label: "P&L / expenses", desc: "Month revenue vs costs" },
  { href: "/crm", label: "Customer report", desc: "Loyalty & spend" },
  { href: "/ai", label: "AI reports", desc: "Ask Copilot for GST, sales, forecasts" },
  { href: "/qr", label: "QR analytics", desc: "Scan performance" },
];

export default function ReportsHubPage() {
  const { hasPermission } = useAuth();
  if (!hasPermission("reports.view")) {
    return <div className="p-6 text-sm text-[var(--muted)]">No access</div>;
  }
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports hub</h1>
      <p className="text-sm text-[var(--muted)]">
        Sales · inventory · GST · customers · employees · suppliers · waste · branch
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-[6px] border border-[var(--border)] p-4 hover:bg-[var(--surface-2)]"
          >
            <p className="font-semibold">{l.label}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
