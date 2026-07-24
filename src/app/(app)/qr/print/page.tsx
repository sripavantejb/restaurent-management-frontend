"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { apiFetch, useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";

interface QrCodeRow {
  id: string;
  label: string;
  shortUrl: string;
  isActive: boolean;
  shortCode: string;
}

type Layout = "12up" | "6up";

export default function QrPrintPage() {
  const { activeBranchId, hasPermission } = useAuth();
  const [codes, setCodes] = useState<QrCodeRow[]>([]);
  const [svgs, setSvgs] = useState<Record<string, string>>({});
  const [layout, setLayout] = useState<Layout>("12up");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      const data = await apiFetch("/api/qr", { branchId: activeBranchId });
      const list = ((data.codes ?? []) as QrCodeRow[]).filter((c) => c.isActive);
      setCodes(list);
      const map: Record<string, string> = {};
      await Promise.all(
        list.map(async (c) => {
          map[c.id] = await QRCode.toString(c.shortUrl, {
            type: "svg",
            errorCorrectionLevel: "H",
            margin: 4,
            width: 256,
            color: { dark: "#12100E", light: "#FFFFFF" },
          });
        })
      );
      setSvgs(map);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load QR codes");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hasPermission("qr.manage")) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Print QR</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Missing <code>qr.manage</code> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="print:hidden flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
        <div>
          <Link href="/qr" className="text-xs text-[var(--muted)] hover:text-[var(--ink)]">
            ← QR codes
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Print</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Quiet zone: keep at least 4 modules of empty margin around each code (built into the
            SVG). Do not crop tightly or place text against the modules.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={layout === "12up" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setLayout("12up")}
          >
            A4 · 12-up
          </Button>
          <Button
            type="button"
            variant={layout === "6up" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setLayout("6up")}
          >
            Tent · 6-up
          </Button>
          <Button type="button" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </header>

      {error ? (
        <p className="print:hidden bg-red-50 px-6 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="flex-1 overflow-auto p-4 print:p-0">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Preparing print sheet…</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No active codes.{" "}
            <Link href="/qr/generate" className="text-[var(--accent)] underline">
              Generate codes
            </Link>{" "}
            first.
          </p>
        ) : (
          <div className={`qr-print-sheet layout-${layout}`}>
            {codes.map((c) => (
              <div key={c.id} className="qr-print-cell">
                <div
                  className="qr-svg"
                  dangerouslySetInnerHTML={{ __html: svgs[c.id] || "" }}
                />
                <p className="qr-label">{c.label}</p>
                <p className="qr-url">{c.shortUrl.replace(/^https?:\/\//, "")}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .qr-print-sheet {
          display: grid;
          gap: 8px;
          width: 100%;
          max-width: 210mm;
          margin: 0 auto;
        }
        .layout-12up {
          grid-template-columns: repeat(3, 1fr);
        }
        .layout-6up {
          grid-template-columns: repeat(2, 1fr);
        }
        .qr-print-cell {
          border: 1px dashed #e4ddd3;
          border-radius: 6px;
          padding: 10px;
          text-align: center;
          background: #fff;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .qr-svg {
          display: flex;
          justify-content: center;
        }
        .qr-svg svg {
          width: 100%;
          max-width: 48mm;
          height: auto;
        }
        .layout-6up .qr-svg svg {
          max-width: 70mm;
        }
        .qr-label {
          margin-top: 6px;
          font-size: 14px;
          font-weight: 600;
          color: #12100e;
        }
        .qr-url {
          margin-top: 2px;
          font-size: 9px;
          font-family: ui-monospace, monospace;
          color: #6b6560;
          word-break: break-all;
        }
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            background: #fff !important;
          }
          .qr-print-sheet {
            max-width: none;
            width: 190mm;
            gap: 4mm;
          }
          .layout-12up {
            grid-template-columns: repeat(3, 60mm);
          }
          .layout-6up {
            grid-template-columns: repeat(2, 90mm);
          }
          .layout-12up .qr-print-cell {
            width: 60mm;
            height: 64mm;
            padding: 3mm;
          }
          .layout-6up .qr-print-cell {
            width: 90mm;
            height: 85mm;
            padding: 5mm;
          }
          .layout-12up .qr-svg svg {
            width: 42mm;
            max-width: 42mm;
          }
          .layout-6up .qr-svg svg {
            width: 58mm;
            max-width: 58mm;
          }
          .qr-print-cell {
            border: 0.3mm solid #ccc;
            border-radius: 0;
          }
        }
      `}</style>
    </div>
  );
}
