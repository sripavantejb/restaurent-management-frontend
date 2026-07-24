"use client";

import type { Diet, Phase } from "./types";
import styles from "./guest-theme.module.css";

export function GuestHeader({
  restaurantName,
  tableNumber,
  phase,
  diet,
  search,
  onDiet,
  onSearch,
}: {
  restaurantName: string;
  tableNumber: number;
  phase: Phase;
  diet: Diet;
  search: string;
  onDiet: (d: Diet) => void;
  onSearch: (v: string) => void;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        <div>
          <p className={styles.brandTiny}>{restaurantName}</p>
          <p className={styles.tableTitle}>Table {tableNumber}</p>
        </div>
        <div className={styles.dietRow}>
          {(["all", "veg", "egg", "nonveg"] as Diet[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDiet(d)}
              className={`${styles.chip} ${diet === d ? styles.chipActive : ""}`}
            >
              {d === "nonveg" ? "Non-veg" : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {phase === "menu" ? (
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search menu"
          className={styles.input}
          style={{ marginTop: 10 }}
          aria-label="Search menu"
        />
      ) : null}
    </header>
  );
}
