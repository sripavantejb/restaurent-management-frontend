"use client";

import { formatMoney } from "@/lib/money";
import type { Category, MenuItem } from "./types";
import styles from "./guest-theme.module.css";

export function GuestMenu({
  categories,
  activeCat,
  items,
  currency,
  onCategory,
  onOpenItem,
}: {
  categories: Category[];
  activeCat: string;
  items: MenuItem[];
  currency: string;
  onCategory: (id: string) => void;
  onOpenItem: (item: MenuItem) => void;
}) {
  return (
    <>
      <nav className={styles.catRail}>
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

      <div className={styles.menuList}>
        {items.length === 0 ? (
          <p className={styles.muted} style={{ textAlign: "center", padding: 24 }}>
            No dishes match — clear search or switch diet filter.
          </p>
        ) : (
          items.map((it) => {
            const unavailable = !it.isAvailable;
            return (
              <button
                key={it.id}
                type="button"
                disabled={unavailable}
                onClick={() => onOpenItem(it)}
                className={styles.menuItem}
              >
                <div className={styles.menuItemTop}>
                  <div>
                    <span
                      className={`${styles.vegDot} ${it.isVeg ? styles.vegDotVeg : styles.vegDotNon}`}
                      aria-hidden
                    />
                    <span style={{ fontWeight: 600 }}>{it.name}</span>
                    {it.bestseller ? <span className={styles.popular}>Popular</span> : null}
                  </div>
                  <span className={styles.num} style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {formatMoney(it.price, currency)}
                  </span>
                </div>
                {it.description ? (
                  <p className={styles.muted} style={{ margin: "6px 0 0", fontSize: 13 }}>
                    {it.description}
                  </p>
                ) : null}
                {unavailable ? (
                  <p className={styles.muted} style={{ margin: "8px 0 0", fontSize: 13 }}>
                    Currently unavailable
                  </p>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
