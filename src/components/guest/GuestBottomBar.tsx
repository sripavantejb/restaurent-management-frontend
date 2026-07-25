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
  kitchenHint,
  onTrack,
  onMenu,
  onCart,
}: {
  phase: Phase;
  rounds: number;
  sessionTotal: number;
  currency: string;
  cartQty: number;
  kitchenHint?: string;
  onTrack: () => void;
  onMenu: () => void;
  onCart: () => void;
}) {
  return (
    <div className={styles.bottomBar}>
      <div className={styles.bottomMeta}>
        <p className={styles.muted} style={{ fontSize: 12, margin: 0 }}>
          {rounds > 0
            ? `${rounds} round${rounds === 1 ? "" : "s"} · session`
            : "Session open"}
          {kitchenHint ? ` · ${kitchenHint}` : ""}
        </p>
        <p className={`${styles.num}`} style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          {formatMoney(sessionTotal, currency)}
        </p>
      </div>
      {phase === "menu" ? (
        <>
          <button type="button" className={styles.btnGhost} onClick={onTrack}>
            Track
            {rounds > 0 ? (
              <span className={styles.badgeCount}>{rounds}</span>
            ) : null}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            style={{ width: "auto", minWidth: 118 }}
            onClick={onCart}
          >
            {cartQty > 0 ? `Cart · ${cartQty}` : "Cart"}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={onCart}
          >
            Cart
            {cartQty > 0 ? (
              <span className={styles.badgeCount}>{cartQty}</span>
            ) : null}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            style={{ width: "auto", minWidth: 110 }}
            onClick={onMenu}
          >
            Menu
          </button>
        </>
      )}
    </div>
  );
}
