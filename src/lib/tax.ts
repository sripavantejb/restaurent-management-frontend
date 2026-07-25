/**
 * GST / tax engine — amounts in integer paise.
 */

export type TaxMode = "EXCLUSIVE" | "INCLUSIVE";

export interface TaxLine {
  hsnCode: string;
  taxableAmount: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalTax: number;
}

export interface TaxBreakdown {
  mode: TaxMode;
  subtotal: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  taxTotal: number;
  grandTotal: number;
  lines: TaxLine[];
}

export function roundPaise(n: number): number {
  return Math.round(n);
}

/**
 * Split GST: intra-state → CGST+SGST; inter-state → IGST.
 * Default restaurant GST 5% (2.5+2.5) unless rates provided.
 */
export function calcGstBreakdown(input: {
  subtotalPaise: number;
  discountPaise?: number;
  mode?: TaxMode;
  gstRate?: number;
  cessRate?: number;
  interState?: boolean;
  hsnCode?: string;
}): TaxBreakdown {
  const mode = input.mode ?? "EXCLUSIVE";
  const discount = Math.max(0, input.discountPaise ?? 0);
  const gstRate = input.gstRate ?? 0.05;
  const cessRate = input.cessRate ?? 0;
  const interState = input.interState ?? false;
  const hsnCode = input.hsnCode ?? "996331";

  let taxable: number;
  let taxTotal: number;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cess = 0;
  let grandTotal: number;
  const base = Math.max(0, input.subtotalPaise - discount);

  if (mode === "INCLUSIVE") {
    const divisor = 1 + gstRate + cessRate;
    taxable = roundPaise(base / divisor);
    taxTotal = base - taxable;
    grandTotal = base;
  } else {
    taxable = base;
    taxTotal = roundPaise(taxable * gstRate);
    cess = roundPaise(taxable * cessRate);
    taxTotal += cess;
    grandTotal = taxable + taxTotal;
  }

  if (interState) {
    igst = taxTotal - cess;
  } else {
    cgst = roundPaise((taxTotal - cess) / 2);
    sgst = taxTotal - cess - cgst;
  }

  const lines: TaxLine[] = [
    {
      hsnCode,
      taxableAmount: taxable,
      cgstRate: interState ? 0 : gstRate / 2,
      sgstRate: interState ? 0 : gstRate / 2,
      igstRate: interState ? gstRate : 0,
      cessRate,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      cessAmount: cess,
      totalTax: taxTotal,
    },
  ];

  return {
    mode,
    subtotal: input.subtotalPaise,
    discount,
    taxable,
    cgst,
    sgst,
    igst,
    cess,
    taxTotal,
    grandTotal,
    lines,
  };
}

/** Back-compat: 5% exclusive GST on (subtotal - discount). */
export function calcTax(subtotalPaise: number, discountPaise: number): number {
  return calcGstBreakdown({
    subtotalPaise,
    discountPaise,
    mode: "EXCLUSIVE",
    gstRate: 0.05,
  }).taxTotal;
}
