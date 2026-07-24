"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CartLine {
  key: string;
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  variant?: string;
  addons: string[];
  notes: string;
  isVeg: boolean;
}

export type OrderType = "DINE_IN" | "TAKEAWAY";

interface CartState {
  userKey: string;
  type: OrderType;
  tableId: string | null;
  tableNumber: number | null;
  lines: CartLine[];
  discountType: "flat" | "percent";
  discountValue: number;
  setUserKey: (key: string) => void;
  setType: (t: OrderType) => void;
  setTable: (id: string | null, number: number | null) => void;
  addLine: (line: Omit<CartLine, "key" | "qty"> & { qty?: number }) => void;
  updateQty: (key: string, qty: number) => void;
  setNotes: (key: string, notes: string) => void;
  setDiscount: (type: "flat" | "percent", value: number) => void;
  clear: () => void;
  subtotal: () => number;
  discountAmount: () => number;
}

function lineKey(
  menuItemId: string,
  variant: string,
  addons: string[],
  notes: string
) {
  return [menuItemId, variant, [...addons].sort().join(","), notes].join("|");
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      userKey: "anon",
      type: "DINE_IN",
      tableId: null,
      tableNumber: null,
      lines: [],
      discountType: "flat",
      discountValue: 0,
      setUserKey: (key) => {
        if (get().userKey === key) return;
        set({ userKey: key });
      },
      setType: (type) =>
        set({
          type,
          ...(type === "TAKEAWAY" ? { tableId: null, tableNumber: null } : {}),
        }),
      setTable: (tableId, tableNumber) => set({ tableId, tableNumber }),
      addLine: (line) => {
        const key = lineKey(
          line.menuItemId,
          line.variant ?? "",
          line.addons,
          line.notes
        );
        const existing = get().lines.find((l) => l.key === key);
        if (existing) {
          set({
            lines: get().lines.map((l) =>
              l.key === key ? { ...l, qty: l.qty + (line.qty ?? 1) } : l
            ),
          });
        } else {
          set({
            lines: [
              ...get().lines,
              { ...line, key, qty: line.qty ?? 1, variant: line.variant ?? "" },
            ],
          });
        }
      },
      updateQty: (key, qty) => {
        if (qty <= 0) {
          set({ lines: get().lines.filter((l) => l.key !== key) });
        } else {
          set({
            lines: get().lines.map((l) => (l.key === key ? { ...l, qty } : l)),
          });
        }
      },
      setNotes: (key, notes) =>
        set({
          lines: get().lines.map((l) => (l.key === key ? { ...l, notes } : l)),
        }),
      setDiscount: (discountType, discountValue) =>
        set({ discountType, discountValue }),
      clear: () =>
        set({
          lines: [],
          tableId: null,
          tableNumber: null,
          discountType: "flat",
          discountValue: 0,
        }),
      subtotal: () =>
        get().lines.reduce((s, l) => s + l.unitPrice * l.qty, 0),
      discountAmount: () => {
        const sub = get().subtotal();
        const { discountType, discountValue } = get();
        if (discountType === "percent") {
          return Math.min(sub, Math.round((sub * discountValue) / 100));
        }
        return Math.min(sub, discountValue);
      },
    }),
    {
      name: "ros-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        userKey: s.userKey,
        type: s.type,
        tableId: s.tableId,
        tableNumber: s.tableNumber,
        lines: s.lines,
        discountType: s.discountType,
        discountValue: s.discountValue,
      }),
    }
  )
);
