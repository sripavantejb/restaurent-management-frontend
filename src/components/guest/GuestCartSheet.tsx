"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatMoney } from "@/lib/money";
import type { CartLine } from "./types";
import { prefersReducedMotion, gsapFromIf } from "./utils";
import styles from "./guest-theme.module.css";

gsap.registerPlugin(useGSAP);

export function GuestCartSheet({
  cart,
  currency,
  cartTotal,
  busy,
  onClose,
  onQty,
  onRemove,
  onClear,
  onPlace,
}: {
  cart: CartLine[];
  currency: string;
  cartTotal: number;
  busy: boolean;
  onClose: () => void;
  onQty: (index: number, nextQty: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onPlace: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsapFromIf(root.current, ".g-cart-panel", {
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
        className={`${styles.sheet} g-cart-panel`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Your cart"
      >
        <div className={styles.cartHead}>
          <div>
            <h3 className={styles.display} style={{ margin: 0, fontSize: 22 }}>
              Your cart
            </h3>
            <p className={styles.muted} style={{ margin: "4px 0 0", fontSize: 13 }}>
              {cart.length
                ? `${itemCount} item${itemCount === 1 ? "" : "s"} · edit before sending`
                : "Add dishes from the menu"}
            </p>
          </div>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Close
          </button>
        </div>

        {cart.length === 0 ? (
          <div className={styles.cartEmpty}>
            <p className={styles.display} style={{ fontSize: 18, margin: "0 0 6px" }}>
              Cart is empty
            </p>
            <p className={styles.muted} style={{ margin: 0, fontSize: 14 }}>
              Tap + on any dish to add it. You can change quantity or remove items here
              before sending to the kitchen.
            </p>
            <button
              type="button"
              className={styles.btnPrimary}
              style={{ marginTop: 18 }}
              onClick={onClose}
            >
              Browse menu
            </button>
          </div>
        ) : (
          <>
            <div className={styles.cartToolbar}>
              <span className={styles.muted} style={{ fontSize: 12 }}>
                Adjust quantity or remove
              </span>
              <button
                type="button"
                className={styles.linkDanger}
                disabled={busy}
                onClick={onClear}
              >
                Clear all
              </button>
            </div>

            <ul className={styles.cartList}>
              {cart.map((l, i) => (
                <li key={`${l.menuItemId}-${i}`} className={styles.cartLine}>
                  <div className={styles.cartLineMain}>
                    <div className={styles.cartLineTop}>
                      <p className={styles.cartItemName}>
                        <span
                          className={`${styles.vegDot} ${
                            l.isVeg ? styles.vegDotVeg : styles.vegDotNon
                          }`}
                          aria-hidden
                        />
                        {l.name}
                        {l.variant ? ` · ${l.variant}` : ""}
                      </p>
                      <p className={`${styles.num} ${styles.cartLinePrice}`}>
                        {formatMoney(l.unitPrice * l.qty, currency)}
                      </p>
                    </div>
                    {l.addons.length ? (
                      <p className={styles.muted} style={{ fontSize: 12, margin: "2px 0 0" }}>
                        {l.addons.join(", ")}
                      </p>
                    ) : null}
                    {l.notes ? (
                      <p className={styles.cartNotes}>Note: {l.notes}</p>
                    ) : null}
                    <div className={styles.cartControls}>
                      <div className={styles.qtyRow} aria-label={`Quantity for ${l.name}`}>
                        <button
                          type="button"
                          className={styles.btnStep}
                          style={{ width: 36, height: 36, fontSize: 18 }}
                          aria-label="Decrease quantity"
                          disabled={busy}
                          onClick={() => onQty(i, l.qty - 1)}
                        >
                          −
                        </button>
                        <span className={styles.num} style={{ minWidth: 24, textAlign: "center", fontWeight: 700 }}>
                          {l.qty}
                        </span>
                        <button
                          type="button"
                          className={styles.btnStep}
                          style={{ width: 36, height: 36, fontSize: 18 }}
                          aria-label="Increase quantity"
                          disabled={busy}
                          onClick={() => onQty(i, Math.min(20, l.qty + 1))}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className={styles.linkDanger}
                        disabled={busy}
                        onClick={() => onRemove(i)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className={styles.cartFooter}>
              <div className={styles.billRow}>
                <span>Subtotal</span>
                <span className={styles.num}>{formatMoney(cartTotal, currency)}</span>
              </div>
              <p className={styles.microcopy} style={{ textAlign: "left", margin: "0 0 12px" }}>
                Tax is calculated when your round reaches the kitchen.
              </p>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={busy || !cart.length}
                onClick={onPlace}
              >
                {busy ? "Sending to kitchen…" : `Send to kitchen · ${formatMoney(cartTotal, currency)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
