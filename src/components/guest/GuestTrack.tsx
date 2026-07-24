"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatMoney } from "@/lib/money";
import type { CheckoutData, MenuItem } from "./types";
import { prefersReducedMotion, statusTone } from "./utils";
import styles from "./guest-theme.module.css";

gsap.registerPlugin(useGSAP);

function sessionStatusClass(status: string): string {
  const s = status.toUpperCase();
  if (s === "BILL_REQUESTED") return `${styles.statusPill} ${styles.statusBill}`;
  if (s === "CLOSED" || s === "PAID") return `${styles.statusPill} ${styles.statusClosed}`;
  return `${styles.statusPill} ${styles.statusOpen}`;
}

function roundToneClass(status: string): string {
  const tone = statusTone(status);
  if (tone === "placed") return styles.tonePlaced;
  if (tone === "cooking") return styles.toneCooking;
  if (tone === "ready") return styles.toneReady;
  if (tone === "served") return styles.toneServed;
  return styles.toneMuted;
}

export function GuestTrack({
  checkout,
  currency,
  tipPercent,
  quickReorder,
  busy,
  onTip,
  onService,
  onPay,
  onPayAtCounter,
  onOrderAgain,
  onQuickReorder,
}: {
  checkout: CheckoutData | null;
  currency: string;
  tipPercent: number;
  quickReorder: MenuItem[];
  busy: boolean;
  onTip: (p: number) => void;
  onService: (type: "WAITER" | "WATER" | "CUTLERY") => void;
  onPay: () => void;
  onPayAtCounter: () => void;
  onOrderAgain: () => void;
  onQuickReorder: (item: MenuItem) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const session = checkout?.session;
  const rounds = checkout?.rounds ?? [];
  const status = session?.status ?? "OPEN";
  const due = session?.dueAmount ?? 0;

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(".g-round", {
        y: 12,
        opacity: 0,
        duration: 0.35,
        stagger: 0.06,
        ease: "power2.out",
      });
    },
    { scope: root, dependencies: [rounds.length] }
  );

  return (
    <div ref={root} className={styles.track}>
      <div className={styles.trackHead}>
        <div>
          <h2 className={styles.trackTitle}>Your orders</h2>
          <p className={styles.muted} style={{ margin: 0, fontSize: 14 }}>
            Updates every few seconds
          </p>
        </div>
        <span className={sessionStatusClass(status)}>{status.replaceAll("_", " ")}</span>
      </div>

      {rounds.length === 0 ? (
        <p className={styles.muted}>No rounds yet — order from the menu.</p>
      ) : (
        <div className={styles.roundsGrid}>
          {rounds.map((r) => (
            <div key={r.id} className={`${styles.round} g-round`}>
              <div className={styles.roundHead}>
                <p className={styles.num} style={{ fontWeight: 700, margin: 0 }}>
                  Round {r.roundNumber}
                </p>
                <p className={`${styles.roundStatus} ${roundToneClass(r.status)}`} style={{ margin: 0 }}>
                  {r.status === "DRAFT" || r.approvalStatus === "PENDING"
                    ? "Awaiting approval"
                    : r.approvalStatus === "REJECTED"
                      ? "Rejected"
                      : r.status}
                </p>
              </div>
              <ul className={styles.itemList}>
                {r.items.map((it, i) => (
                  <li key={i}>
                    <span className={styles.num}>{it.qty}×</span> {it.name}
                    {it.variant ? ` (${it.variant})` : ""}
                  </li>
                ))}
              </ul>
              <p className={styles.num} style={{ marginTop: 8, fontWeight: 600 }}>
                {formatMoney(r.total, currency)}
              </p>
            </div>
          ))}
        </div>
      )}

      {quickReorder.length > 0 ? (
        <div style={{ marginTop: 24 }}>
          <p className={styles.sectionLabel}>Order again</p>
          <div className={styles.wrapChips}>
            {quickReorder.map((it) => (
              <button
                key={it.id}
                type="button"
                className={styles.chip}
                onClick={() => onQuickReorder(it)}
              >
                + {it.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.serviceRow}>
        {(
          [
            ["WAITER", "Call waiter"],
            ["WATER", "Water"],
            ["CUTLERY", "Cutlery"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            className={styles.btnGhost}
            onClick={() => onService(t)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.bill}>
        <p className={styles.sectionLabel}>Bill</p>
        <div className={styles.billRow}>
          <span>Subtotal</span>
          <span className={styles.num}>{formatMoney(session?.subtotal ?? 0, currency)}</span>
        </div>
        <div className={styles.billRow}>
          <span>Tax</span>
          <span className={styles.num}>{formatMoney(session?.taxAmount ?? 0, currency)}</span>
        </div>
        <div className={styles.billRow}>
          <span>Tip{tipPercent ? ` (${tipPercent}%)` : ""}</span>
          <span className={styles.num}>{formatMoney(session?.tipAmount ?? 0, currency)}</span>
        </div>
        <div className={styles.billDue}>
          <span>Due</span>
          <span className={styles.num}>{formatMoney(due, currency)}</span>
        </div>

        <p className={styles.sectionLabel} style={{ marginTop: 18 }}>
          Tip
        </p>
        <div className={styles.tipRow}>
          {[0, 5, 10, 15].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onTip(p)}
              className={`${styles.chip} ${tipPercent === p ? styles.chipTeal : ""}`}
            >
              {p === 0 ? "None" : `${p}%`}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.btnPrimary}
          disabled={busy || due <= 0}
          onClick={onPay}
        >
          Pay {formatMoney(due, currency)}
        </button>
        <p className={styles.microcopy}>Demo pay · records payment for staff</p>
        <button
          type="button"
          className={styles.btnGhostBlock}
          style={{ marginTop: 10 }}
          disabled={busy}
          onClick={onPayAtCounter}
        >
          Pay at counter
        </button>
        <button
          type="button"
          className={styles.btnGhostBlock}
          style={{ marginTop: 10 }}
          onClick={onOrderAgain}
        >
          Order again
        </button>
      </div>
    </div>
  );
}
