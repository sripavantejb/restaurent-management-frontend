/** Money helpers — all amounts are integer paise (1 INR = 100 paise). */

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

export function formatMoney(paise: number, currency = "INR"): string {
  const value = fromPaise(paise);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** GST at 5% on (subtotal - discount), rounded to nearest paise. */
export function calcTax(subtotalPaise: number, discountPaise: number): number {
  const taxable = Math.max(0, subtotalPaise - discountPaise);
  return Math.round(taxable * 0.05);
}

export function calcTotal(
  subtotalPaise: number,
  discountPaise: number,
  taxPaise: number
): number {
  return Math.max(0, subtotalPaise - discountPaise + taxPaise);
}
