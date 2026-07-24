"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatMoney } from "@/lib/money";
import type { CartLine } from "./types";
import { prefersReducedMotion } from "./utils";
import styles from "./guest-theme.module.css";

gsap.registerPlugin(useGSAP);

export function GuestCartSheet({
  cart,
  currency,
  cartTotal,
  busy,
  onClose,
  onQty,
  onPlace,
}: {
  cart: CartLine[];
  currency: string;
  cartTotal: number;
  busy: boolean;
  onClose: () => void;
  onQty: (index: number, nextQty: number) => void;
  onPlace: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(".g-cart-panel", {
        y: 40,
        opacity: 0.6,
        duration: 0.32,
        ease: "power2.out",
      });
      gsap.from(root.current, { opacity: 0, duration: 0.2 });
    },
    { scope: root }
  );

  return (
    <div ref={root} className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.sheet} g-cart-panel`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.display} style={{ margin: "0 0 12px", fontSize: 20 }}>
          Your cart
        </h3>
        {cart.length === 0 ? (
          <p className={styles.muted}>Cart is empty — pick something delicious.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {cart.map((l, i) => (
              <li key={`${l.menuItemId}-${i}`} className={styles.cartLine}>
                <div>
                  <p style={{ fontWeight: 600, margin: 0 }}>
                    {l.name}
                    {l.variant ? ` · ${l.variant}` : ""}
                  </p>
                  {l.addons.length ? (
                    <p className={styles.muted} style={{ fontSize: 12, margin: "2px 0 0" }}>
                      {l.addons.join(", ")}
                    </p>
                  ) : null}
                  <div className={styles.qtyRow}>
                    <button
                      type="button"
                      className={styles.btnStep}
                      style={{ width: 32, height: 32, fontSize: 16 }}
                      onClick={() => onQty(i, l.qty - 1)}
                    >
                      −
                    </button>
                    <span className={styles.num}>{l.qty}</span>
                    <button
                      type="button"
                      className={styles.btnStep}
                      style={{ width: 32, height: 32, fontSize: 16 }}
                      onClick={() => onQty(i, l.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className={styles.num} style={{ fontWeight: 600, margin: 0 }}>
                  {formatMoney(l.unitPrice * l.qty, currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.num} style={{ fontSize: 22, fontWeight: 700, margin: "16px 0" }}>
          {formatMoney(cartTotal, currency)}
        </p>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={busy || !cart.length}
          onClick={onPlace}
        >
          {busy ? "Sending…" : "Send to kitchen"}
        </button>
      </div>
    </div>
  );
}
