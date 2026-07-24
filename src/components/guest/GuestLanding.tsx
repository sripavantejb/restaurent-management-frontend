"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Bootstrap } from "./types";
import { prefersReducedMotion } from "./utils";
import styles from "./guest-theme.module.css";

gsap.registerPlugin(useGSAP);

export function GuestLanding({
  boot,
  guestCount,
  guestName,
  busy,
  error,
  hint,
  onGuestCount,
  onGuestName,
  onStart,
  onJoin,
  onWrongTable,
  onRefresh,
}: {
  boot: Bootstrap;
  guestCount: number;
  guestName: string;
  busy: boolean;
  error: string;
  hint: string;
  onGuestCount: (n: number | ((c: number) => number)) => void;
  onGuestName: (v: string) => void;
  onStart: () => void;
  onJoin: () => void;
  onWrongTable: () => void;
  onRefresh?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(".g-land-hero > *", {
        y: 18,
        opacity: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: "power2.out",
      });
    },
    { scope: root }
  );

  return (
    <div ref={root} className={styles.landing}>
      <div className={`${styles.landingHero} g-land-hero`}>
        <p className={styles.landingBrand}>{boot.restaurant.name}</p>
        <p className={styles.landingTable}>Table {boot.table.number}</p>
        <p className={styles.landingTag}>
          Scan · sit · order · {boot.branch.name}
        </p>
      </div>

      {boot.restaurant.qrOrderingEnabled === false ? (
        <div className={styles.paused}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Ordering is paused</p>
          <p className={styles.muted} style={{ fontSize: 14, lineHeight: 1.45, margin: 0 }}>
            This restaurant has turned off QR menu ordering for now. Please ask
            your server to take your order — scanning still confirms you are at
            Table {boot.table.number}.
          </p>
        </div>
      ) : (
        <>
          <label className={styles.label}>Guests</label>
          <div className={styles.guestRow}>
            <button
              type="button"
              className={styles.btnStep}
              aria-label="Fewer guests"
              onClick={() => onGuestCount((c) => Math.max(1, c - 1))}
            >
              −
            </button>
            <span className={styles.num} style={{ fontSize: 32, fontWeight: 600, minWidth: 40, textAlign: "center" }}>
              {guestCount}
            </span>
            <button
              type="button"
              className={styles.btnStep}
              aria-label="More guests"
              onClick={() => onGuestCount((c) => Math.min(6, c + 1))}
            >
              +
            </button>
          </div>

          <label className={styles.label} htmlFor="guest-name">
            Your name (optional)
          </label>
          <input
            id="guest-name"
            value={guestName}
            onChange={(e) => onGuestName(e.target.value)}
            placeholder="So kitchen can call you"
            className={styles.input}
          />

          {error ? (
            <p className={styles.errorText}>
              {error}
              {hint ? ` — ${hint}` : ""}
            </p>
          ) : null}

          {boot.openSession?.status === "BILL_REQUESTED" ? (
            <div className={styles.paused} style={{ marginTop: 28 }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>
                Bill is being prepared
              </p>
              <p className={styles.muted} style={{ fontSize: 14, lineHeight: 1.45, margin: 0 }}>
                Ordering is paused for this table. Ask staff to reopen it if you
                need to order more.
              </p>
              {onRefresh ? (
                <button
                  type="button"
                  className={styles.btnGhostBlock}
                  style={{ marginTop: 14 }}
                  onClick={onRefresh}
                >
                  Check again
                </button>
              ) : null}
            </div>
          ) : boot.openSession ? (
            <div className={styles.stack}>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={busy}
                onClick={onJoin}
              >
                Join table · Round {boot.openSession.rounds || 0}
              </button>
              <button type="button" className={styles.btnGhostBlock} onClick={onWrongTable}>
                This isn&apos;t my table
              </button>
            </div>
          ) : boot.table.status === "OCCUPIED" || boot.table.status === "BILLED" ? (
            <div className={styles.paused} style={{ marginTop: 28 }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>
                Table already in use
              </p>
              <p className={styles.muted} style={{ fontSize: 14, lineHeight: 1.45, margin: 0 }}>
                Staff may have a waiter-taken order on this table. Ask your
                server to free it, then scan again.
              </p>
              {onRefresh ? (
                <button
                  type="button"
                  className={styles.btnGhostBlock}
                  style={{ marginTop: 14 }}
                  onClick={onRefresh}
                >
                  Check again
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              className={styles.btnPrimary}
              style={{ marginTop: 28 }}
              disabled={busy}
              onClick={onStart}
            >
              {busy ? "Starting…" : "Start ordering"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
