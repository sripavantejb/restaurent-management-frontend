"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatMoney } from "@/lib/money";
import type { Category, MenuItem } from "./types";
import { prefersReducedMotion, gsapFromIf } from "./utils";
import styles from "./guest-theme.module.css";

gsap.registerPlugin(useGSAP);

export function GuestMenu({
  categories,
  activeCat,
  items,
  currency,
  qtyByItemId,
  onCategory,
  onOpenItem,
  onIncSimple,
  onDecSimple,
}: {
  categories: Category[];
  activeCat: string;
  items: MenuItem[];
  currency: string;
  qtyByItemId: Record<string, number>;
  onCategory: (id: string) => void;
  onOpenItem: (item: MenuItem) => void;
  onIncSimple: (item: MenuItem) => void;
  onDecSimple: (item: MenuItem) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const activeName =
    categories.find((c) => c.id === activeCat)?.name ?? "Menu";

  useGSAP(
    () => {
      if (prefersReducedMotion() || items.length === 0) return;
      gsapFromIf(root.current, ".g-menu-item", {
        y: 10,
        opacity: 0,
        duration: 0.28,
        stagger: 0.035,
        ease: "power2.out",
      });
    },
    { scope: root, dependencies: [activeCat, items.length] }
  );

  function needsConfig(item: MenuItem) {
    return (item.variants?.length ?? 0) > 0 || (item.addons?.length ?? 0) > 0;
  }

  return (
    <div ref={root}>
      <nav className={styles.catRail} aria-label="Menu categories">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onCategory(c.id)}
            className={`${styles.chip} ${activeCat === c.id ? styles.chipAccent : ""}`}
          >
            {c.name}
          </button>
        ))}
      </nav>

      <div className={styles.menuBand}>
        <h2 className={styles.menuSectionTitle}>
          {activeName}
          <span className={styles.menuCount}>{items.length} dishes</span>
        </h2>

        <div className={styles.menuList}>
          {items.length === 0 ? (
            <p className={styles.muted} style={{ textAlign: "center", padding: 24 }}>
              No dishes match — clear search or switch diet filter.
            </p>
          ) : (
            items.map((it) => {
              const unavailable = !it.isAvailable;
              const spice = Math.max(0, Math.min(3, it.spiceLevel || 0));
              const inCartQty = qtyByItemId[it.id] ?? 0;
              const configurable = needsConfig(it);

              return (
                <div
                  key={it.id}
                  className={`${styles.menuItem} g-menu-item ${unavailable ? styles.menuItemDisabled : ""}`}
                >
                  <button
                    type="button"
                    disabled={unavailable}
                    onClick={() => onOpenItem(it)}
                    className={styles.menuItemBodyBtn}
                  >
                    <div className={styles.menuItemTop}>
                      <div>
                        <span
                          className={`${styles.vegDot} ${it.isVeg ? styles.vegDotVeg : styles.vegDotNon}`}
                          aria-hidden
                        />
                        <span className={styles.menuItemName}>{it.name}</span>
                        {it.bestseller ? (
                          <span className={styles.popular}>Popular</span>
                        ) : null}
                      </div>
                      <span
                        className={styles.num}
                        style={{ fontWeight: 700, whiteSpace: "nowrap", fontSize: 15 }}
                      >
                        {formatMoney(it.price, currency)}
                      </span>
                    </div>
                    {it.description ? (
                      <p className={styles.muted} style={{ margin: "6px 0 0", fontSize: 13 }}>
                        {it.description}
                      </p>
                    ) : null}
                    <div className={styles.menuItemMeta}>
                      {spice > 0 ? (
                        <span className={styles.spiceRow} aria-label={`Spice level ${spice}`}>
                          {[1, 2, 3].map((n) => (
                            <span
                              key={n}
                              className={`${styles.spiceDot} ${n <= spice ? styles.spiceDotOn : ""}`}
                            />
                          ))}
                        </span>
                      ) : null}
                      {unavailable ? (
                        <span className={styles.muted} style={{ fontSize: 12 }}>
                          Currently unavailable
                        </span>
                      ) : configurable ? (
                        <span className={styles.muted} style={{ fontSize: 12 }}>
                          Tap to customize
                        </span>
                      ) : inCartQty > 0 ? (
                        <span className={styles.muted} style={{ fontSize: 12 }}>
                          {inCartQty} in cart
                        </span>
                      ) : (
                        <span className={styles.muted} style={{ fontSize: 12 }}>
                          Tap + to add
                        </span>
                      )}
                    </div>
                  </button>

                  {unavailable ? (
                    <span className={`${styles.menuAdd} ${styles.menuAddDisabled}`} aria-hidden>
                      +
                    </span>
                  ) : !configurable && inCartQty > 0 ? (
                    <div className={styles.menuQtyControl} aria-label={`${it.name} quantity`}>
                      <button
                        type="button"
                        className={styles.menuQtyBtn}
                        aria-label={`Remove one ${it.name}`}
                        onClick={() => onDecSimple(it)}
                      >
                        −
                      </button>
                      <span className={styles.num} style={{ fontWeight: 700, minWidth: 18, textAlign: "center" }}>
                        {inCartQty}
                      </span>
                      <button
                        type="button"
                        className={styles.menuQtyBtn}
                        aria-label={`Add one ${it.name}`}
                        onClick={() => onIncSimple(it)}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.menuAdd}
                      aria-label={configurable ? `Customize ${it.name}` : `Add ${it.name}`}
                      onClick={() =>
                        configurable ? onOpenItem(it) : onIncSimple(it)
                      }
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
