"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatMoney } from "@/lib/money";
import type { MenuItem } from "./types";
import { linePrice, prefersReducedMotion, gsapFromIf } from "./utils";
import styles from "./guest-theme.module.css";

gsap.registerPlugin(useGSAP);

export function GuestItemSheet({
  item,
  currency,
  variant,
  addons,
  notes,
  qty,
  onVariant,
  onToggleAddon,
  onNotes,
  onQty,
  onAdd,
  onClose,
}: {
  item: MenuItem;
  currency: string;
  variant: string;
  addons: string[];
  notes: string;
  qty: number;
  onVariant: (v: string) => void;
  onToggleAddon: (name: string) => void;
  onNotes: (v: string) => void;
  onQty: (n: number | ((q: number) => number)) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsapFromIf(root.current, ".g-sheet-panel", {
        y: 40,
        opacity: 0.6,
        duration: 0.32,
        ease: "power2.out",
      });
      if (root.current) {
        gsap.from(root.current, { opacity: 0, duration: 0.2 });
      }
    },
    { scope: root }
  );

  return (
    <div ref={root} className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.sheet} g-sheet-panel`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 20 }} className={styles.display}>
          {item.name}
        </h3>
        <p className={`${styles.num} ${styles.muted}`} style={{ marginBottom: 16 }}>
          {formatMoney(linePrice(item, variant, addons) * qty, currency)}
        </p>

        {(item.variants?.length ?? 0) > 0 ? (
          <div style={{ marginBottom: 14 }}>
            <p className={styles.label}>Size / variant</p>
            <div className={styles.wrapChips}>
              {item.variants.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => onVariant(v.name)}
                  className={`${styles.chip} ${variant === v.name ? styles.chipActive : ""}`}
                >
                  {v.name}
                  {v.priceDelta
                    ? ` (${v.priceDelta > 0 ? "+" : ""}${formatMoney(v.priceDelta, currency)})`
                    : ""}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {(item.addons?.length ?? 0) > 0 ? (
          <div style={{ marginBottom: 14 }}>
            <p className={styles.label}>Add-ons</p>
            <div className={styles.wrapChips}>
              {item.addons.map((a) => {
                const on = addons.includes(a.name);
                return (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => onToggleAddon(a.name)}
                    className={`${styles.chip} ${on ? styles.chipTeal : ""}`}
                  >
                    {a.name} (+{formatMoney(a.price, currency)})
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <label className={styles.label} htmlFor="notes">
          Notes
        </label>
        <input
          id="notes"
          value={notes}
          maxLength={140}
          onChange={(e) => onNotes(e.target.value)}
          placeholder="Less spicy, no onion…"
          className={styles.input}
        />

        <div className={styles.guestRow} style={{ marginTop: 16 }}>
          <button
            type="button"
            className={styles.btnStep}
            onClick={() => onQty((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span className={styles.num} style={{ fontSize: 22, fontWeight: 600 }}>
            {qty}
          </span>
          <button
            type="button"
            className={styles.btnStep}
            onClick={() => onQty((q) => Math.min(20, q + 1))}
          >
            +
          </button>
        </div>

        <button type="button" className={styles.btnPrimary} onClick={onAdd}>
          Add to cart
        </button>
      </div>
    </div>
  );
}
