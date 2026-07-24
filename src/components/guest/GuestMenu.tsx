"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatMoney } from "@/lib/money";
import type { Category, MenuItem } from "./types";
import { prefersReducedMotion } from "./utils";
import styles from "./guest-theme.module.css";

gsap.registerPlugin(useGSAP);

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
  const root = useRef<HTMLDivElement>(null);
  const activeName =
    categories.find((c) => c.id === activeCat)?.name ?? "Menu";

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(".g-menu-item", {
        y: 10,
        opacity: 0,
        duration: 0.28,
        stagger: 0.035,
        ease: "power2.out",
      });
    },
    { scope: root, dependencies: [activeCat, items.length] }
  );

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
              return (
                <button
                  key={it.id}
                  type="button"
                  disabled={unavailable}
                  onClick={() => onOpenItem(it)}
                  className={`${styles.menuItem} g-menu-item`}
                >
                  <div className={styles.menuItemBody}>
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
                      ) : (
                        <span className={styles.muted} style={{ fontSize: 12 }}>
                          Tap to customize
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={styles.menuAdd} aria-hidden>
                    +
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
