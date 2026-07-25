"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatMoney } from "@/lib/money";
import {
  APPROVAL_STATUS_LABEL,
  GUEST_SERVICE_ACTIONS,
  ORDER_STATUS_LABEL,
  SERVICE_TYPE_LABEL,
  SESSION_STATUS_LABEL,
  label,
  type ServiceType,
} from "@/lib/labels";
import type { CheckoutData, CheckoutRound, MenuItem } from "./types";
import { prefersReducedMotion, gsapFromIf, statusTone } from "./utils";
import styles from "./guest-theme.module.css";

gsap.registerPlugin(useGSAP);

const KITCHEN_STEPS = [
  { key: "sent", title: "Sent" },
  { key: "cooking", title: "Cooking" },
  { key: "ready", title: "Ready" },
  { key: "served", title: "Served" },
] as const;

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

function kitchenStepIndex(round: CheckoutRound): number {
  const approval = (round.approvalStatus ?? "NONE").toUpperCase();
  if (approval === "PENDING") return 0;
  if (approval === "REJECTED") return 0;
  const s = round.status.toUpperCase();
  if (s === "DRAFT" || s === "PLACED") return 0;
  if (s === "PREPARING") return 1;
  if (s === "READY") return 2;
  if (s === "SERVED" || s === "COMPLETED") return 3;
  return 0;
}

function guestStatusLabel(round: CheckoutRound): string {
  const approval = (round.approvalStatus ?? "NONE").toUpperCase();
  if (approval === "PENDING") return label(APPROVAL_STATUS_LABEL, "PENDING");
  if (approval === "REJECTED") return label(APPROVAL_STATUS_LABEL, "REJECTED");
  return label(ORDER_STATUS_LABEL, round.status);
}

function itemKitchenLabel(status?: string): string {
  const s = (status ?? "QUEUED").toUpperCase();
  if (s === "COOKING") return "Cooking";
  if (s === "READY") return "Ready";
  return "Queued";
}

function elapsedLabel(iso?: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins === 1) return "1 min ago";
  return `${mins} min ago`;
}

function etaLabel(round: CheckoutRound): string {
  const step = kitchenStepIndex(round);
  if (step >= 3) return "Delivered to table";
  if (step === 2) return "Ready for pickup / serve";
  const eta = round.prepEtaMins ?? 15;
  if (!round.placedAt) return `~${eta} min`;
  const elapsed = Math.floor((Date.now() - new Date(round.placedAt).getTime()) / 60000);
  const left = Math.max(1, eta - elapsed);
  if (step === 1) return `~${left} min left`;
  return `Est. ${eta} min`;
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
  onService: (type: ServiceType) => void;
  onPay: () => void;
  onPayAtCounter: () => void;
  onOrderAgain: () => void;
  onQuickReorder: (item: MenuItem) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const session = checkout?.session;
  const rounds = checkout?.rounds ?? [];
  const status = session?.status ?? "OPEN";
  const due = session?.dueAmount ?? 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  useGSAP(
    () => {
      if (prefersReducedMotion() || rounds.length === 0) return;
      gsapFromIf(root.current, ".g-round", {
        y: 12,
        opacity: 0,
        duration: 0.35,
        stagger: 0.06,
        ease: "power2.out",
      });
    },
    { scope: root, dependencies: [rounds.length] }
  );

  const kitchenSummary = useMemo(() => {
    let cooking = 0;
    let ready = 0;
    let waiting = 0;
    let served = 0;
    for (const r of rounds) {
      const step = kitchenStepIndex(r);
      if (step === 0) waiting += 1;
      else if (step === 1) cooking += 1;
      else if (step === 2) ready += 1;
      else served += 1;
    }
    return { cooking, ready, waiting, served, refreshedAt: now };
  }, [rounds, now]);

  return (
    <div ref={root} className={styles.track}>
      <div className={styles.trackHead}>
        <div>
          <h2 className={styles.trackTitle}>Kitchen track</h2>
          <p className={styles.muted} style={{ margin: 0, fontSize: 14 }}>
            Live from the kitchen display · refreshes every few seconds
          </p>
        </div>
        <span className={sessionStatusClass(status)}>
          {label(SESSION_STATUS_LABEL, status)}
        </span>
      </div>

      {!checkout ? (
        <div className={styles.kdsSummary}>
          <p className={styles.muted} style={{ margin: 0 }}>
            Connecting to kitchen…
          </p>
        </div>
      ) : (
        <div className={styles.kdsSummary}>
          <p className={styles.kdsSummaryTitle}>Live kitchen status</p>
          <div className={styles.kdsStats}>
            <span>
              <strong className={styles.num}>{kitchenSummary.waiting}</strong> sent
            </span>
            <span>
              <strong className={styles.num}>{kitchenSummary.cooking}</strong> cooking
            </span>
            <span>
              <strong className={styles.num}>{kitchenSummary.ready}</strong> ready
            </span>
            <span>
              <strong className={styles.num}>{kitchenSummary.served}</strong> served
            </span>
          </div>
        </div>
      )}

      {rounds.length === 0 ? (
        <div className={styles.cartEmpty} style={{ marginTop: 12 }}>
          <p className={styles.display} style={{ fontSize: 18, margin: "0 0 6px" }}>
            No kitchen tickets yet
          </p>
          <p className={styles.muted} style={{ margin: 0, fontSize: 14 }}>
            Add items to your cart and tap Send to kitchen. Each round appears here with
            live cooking progress.
          </p>
          <button
            type="button"
            className={styles.btnPrimary}
            style={{ marginTop: 16 }}
            onClick={onOrderAgain}
          >
            Open menu
          </button>
        </div>
      ) : (
        <div className={styles.roundsGrid}>
          {[...rounds].reverse().map((r) => {
            const step = kitchenStepIndex(r);
            return (
              <div key={r.id} className={`${styles.round} g-round`}>
                <div className={styles.roundHead}>
                  <div>
                    <p className={styles.num} style={{ fontWeight: 700, margin: 0 }}>
                      Round {r.roundNumber}
                    </p>
                    <p className={styles.muted} style={{ margin: "2px 0 0", fontSize: 12 }}>
                      {r.orderNumber}
                      {r.placedAt ? ` · ${elapsedLabel(r.placedAt)}` : ""}
                    </p>
                  </div>
                  <p
                    className={`${styles.roundStatus} ${roundToneClass(
                      r.approvalStatus === "PENDING" ? "PLACED" : r.status
                    )}`}
                    style={{ margin: 0 }}
                  >
                    {guestStatusLabel(r)}
                  </p>
                </div>

                <div className={styles.pipeline} aria-label="Kitchen progress">
                  {KITCHEN_STEPS.map((s, i) => (
                    <div
                      key={s.key}
                      className={`${styles.pipelineStep} ${
                        i < step
                          ? styles.pipelineDone
                          : i === step
                            ? styles.pipelineActive
                            : ""
                      }`}
                    >
                      <span className={styles.pipelineDot} />
                      <span className={styles.pipelineLabel}>{s.title}</span>
                    </div>
                  ))}
                </div>

                <p className={styles.etaLine}>
                  {etaLabel(r)}
                  {step === 1 ? " · chef is preparing" : ""}
                  {step === 2 ? " · ask staff if not at table" : ""}
                </p>

                <ul className={styles.itemList}>
                  {r.items.map((it, i) => (
                    <li key={i} className={styles.trackItem}>
                      <div className={styles.trackItemMain}>
                        <span>
                          <span className={styles.num}>{it.qty}×</span> {it.name}
                          {it.variant ? ` (${it.variant})` : ""}
                        </span>
                        <span
                          className={`${styles.itemStatus} ${
                            it.status === "READY"
                              ? styles.itemStatusReady
                              : it.status === "COOKING"
                                ? styles.itemStatusCooking
                                : styles.itemStatusQueued
                          }`}
                        >
                          {itemKitchenLabel(it.status)}
                        </span>
                      </div>
                      {it.notes ? (
                        <p className={styles.cartNotes} style={{ marginTop: 2 }}>
                          {it.notes}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className={styles.num} style={{ marginTop: 10, fontWeight: 600 }}>
                  {formatMoney(r.total, currency)}
                </p>
              </div>
            );
          })}
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

      <div className={styles.serviceBlock}>
        <p className={styles.sectionLabel}>Need something?</p>
        <p className={styles.muted} style={{ margin: "0 0 10px", fontSize: 13 }}>
          Staff will confirm each request at your table
        </p>
        <div className={styles.serviceGrid}>
          {GUEST_SERVICE_ACTIONS.map((t) => (
            <button
              key={t}
              type="button"
              className={styles.serviceChip}
              disabled={busy}
              onClick={() => onService(t)}
            >
              {label(SERVICE_TYPE_LABEL, t)}
            </button>
          ))}
        </div>
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
        <p className={styles.microcopy}>
          Simulated payment for demos — staff can also collect at the counter
        </p>
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
