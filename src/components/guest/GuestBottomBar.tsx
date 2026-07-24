"use client";

import { formatMoney } from "@/lib/money";
import type { Phase } from "./types";
import styles from "./guest-theme.module.css";

export function GuestBottomBar({
  phase,
  rounds,
  sessionTotal,
  currency,
  cartQty,
  onTrack,
  onMenu,
  onCart,
}: {
  phase: Phase;
  rounds: number;
  sessionTotal: number;
  currency: string;
  cartQty: number;
  onTrack: () => void;
  onMenu: () => void;
  onCart: () => void;
}) {
  return (
    <div className={styles.bottomBar}>
      <div className={styles.bottomMeta}>
        <p className={styles.muted} style={{ fontSize: 12, margin: 0 }}>
          {rounds} round{rounds === 1 ? "" : "s"} · session
        </p>
        <p className={`${styles.num}`} style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          {formatMoney(sessionTotal, currency)}
        </p>
      </div>
      {phase === "menu" ? (
        <>
          <button type="button" className={styles.btnGhost} onClick={onTrack}>
            Track
          </button>
          <button type="button" className={styles.btnPrimary} style={{ width: "auto", minWidth: 110 }} onClick={onCart}>
            Cart · {cartQty}
          </button>
        </>
      ) : (
        <button type="button" className={styles.btnPrimary} style={{ width: "auto", minWidth: 110 }} onClick={onMenu}>
          Menu
        </button>
      )}
    </div>
  );
}
