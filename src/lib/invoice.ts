import { calcGstBreakdown, type TaxBreakdown } from "@/lib/tax";
import { formatMoney } from "@/lib/money";

export interface InvoiceLine {
  name: string;
  qty: number;
  unitPrice: number;
  amount: number;
  hsnCode?: string;
}

export interface InvoiceInput {
  restaurantName: string;
  restaurantAddress?: string;
  gstNumber?: string;
  fssaiNumber?: string;
  logoUrl?: string;
  invoiceNumber: string;
  invoiceDate: Date;
  orderNumber?: string;
  tableNumber?: number | string | null;
  waiterName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  lines: InvoiceLine[];
  subtotal: number;
  discount?: number;
  serviceCharge?: number;
  tip?: number;
  interState?: boolean;
  gstRate?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  footerNote?: string;
  terms?: string;
}

export interface InvoiceDocument extends InvoiceInput {
  tax: TaxBreakdown;
  grandTotal: number;
}

export function buildInvoice(input: InvoiceInput): InvoiceDocument {
  const tax = calcGstBreakdown({
    subtotalPaise: input.subtotal,
    discountPaise: input.discount ?? 0,
    mode: "EXCLUSIVE",
    gstRate: input.gstRate ?? 0.05,
    interState: input.interState ?? false,
  });
  const service = input.serviceCharge ?? 0;
  const tip = input.tip ?? 0;
  const grandTotal = tax.grandTotal + service + tip;
  return { ...input, tax, grandTotal };
}

/** Plain-text receipt suitable for thermal / browser print. */
export function invoiceToPrintText(inv: InvoiceDocument): string {
  const lines: string[] = [];
  lines.push(inv.restaurantName.toUpperCase());
  if (inv.restaurantAddress) lines.push(inv.restaurantAddress);
  if (inv.gstNumber) lines.push(`GSTIN: ${inv.gstNumber}`);
  if (inv.fssaiNumber) lines.push(`FSSAI: ${inv.fssaiNumber}`);
  lines.push("--------------------------------");
  lines.push(`Invoice: ${inv.invoiceNumber}`);
  lines.push(`Date: ${inv.invoiceDate.toLocaleString("en-IN")}`);
  if (inv.orderNumber) lines.push(`Order: ${inv.orderNumber}`);
  if (inv.tableNumber != null) lines.push(`Table: ${inv.tableNumber}`);
  if (inv.waiterName) lines.push(`Waiter: ${inv.waiterName}`);
  if (inv.customerName) lines.push(`Guest: ${inv.customerName}`);
  lines.push("--------------------------------");
  for (const l of inv.lines) {
    const hsn = l.hsnCode ? ` [HSN ${l.hsnCode}]` : "";
    lines.push(
      `${l.qty}x ${l.name}${hsn}`.padEnd(28) + formatMoney(l.amount).padStart(12)
    );
  }
  lines.push("--------------------------------");
  lines.push(`Subtotal`.padEnd(24) + formatMoney(inv.subtotal).padStart(12));
  if (inv.discount)
    lines.push(`Discount`.padEnd(24) + formatMoney(-(inv.discount ?? 0)).padStart(12));
  if (inv.tax.cgst)
    lines.push(`CGST`.padEnd(24) + formatMoney(inv.tax.cgst).padStart(12));
  if (inv.tax.sgst)
    lines.push(`SGST`.padEnd(24) + formatMoney(inv.tax.sgst).padStart(12));
  if (inv.tax.igst)
    lines.push(`IGST`.padEnd(24) + formatMoney(inv.tax.igst).padStart(12));
  if (inv.serviceCharge)
    lines.push(
      `Service`.padEnd(24) + formatMoney(inv.serviceCharge).padStart(12)
    );
  if (inv.tip)
    lines.push(`Tip`.padEnd(24) + formatMoney(inv.tip).padStart(12));
  lines.push(`TOTAL`.padEnd(24) + formatMoney(inv.grandTotal).padStart(12));
  if (inv.paymentMethod)
    lines.push(`Paid via ${inv.paymentMethod} (${inv.paymentStatus ?? "PAID"})`);
  lines.push("--------------------------------");
  lines.push(inv.footerNote || "Thank you — visit again");
  if (inv.terms) lines.push(inv.terms);
  return lines.join("\n");
}
