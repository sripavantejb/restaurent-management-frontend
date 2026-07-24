import { Types } from "mongoose";
import { Order } from "@/models/Order";
import { TableSession } from "@/models/TableSession";
import { Payment } from "@/models/Payment";
import { calcTax, calcTotal } from "@/lib/money";

const SERVICE_CHARGE_RATE = 0; // optional; shown separately when > 0

/** Recompute session money from member orders + payments. Never increment stored totals. */
export async function recomputeSessionTotals(sessionId: Types.ObjectId | string) {
  const session = await TableSession.findById(sessionId);
  if (!session) return null;

  const orders = await Order.find({
    restaurantId: session.restaurantId,
    branchId: session.branchId,
    sessionId: session._id,
    status: { $ne: "CANCELLED" },
  }).lean();

  const subtotal = orders.reduce((s, o) => s + o.subtotal, 0);
  const discountAmount = orders.reduce((s, o) => s + o.discountAmount, 0);
  const taxAmount = orders.reduce((s, o) => s + o.taxAmount, 0);
  const serviceCharge = Math.round(
    Math.max(0, subtotal - discountAmount) * SERVICE_CHARGE_RATE
  );
  const tipAmount = session.tipAmount || 0;
  const total = calcTotal(subtotal, discountAmount, taxAmount) + serviceCharge + tipAmount;

  const payments = await Payment.find({
    restaurantId: session.restaurantId,
    branchId: session.branchId,
    sessionId: session._id,
  }).lean();
  const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
  const dueAmount = Math.max(0, total - paidAmount);

  session.orderIds = orders.map((o) => o._id);
  session.rounds = orders.length;
  session.subtotal = subtotal;
  session.discountAmount = discountAmount;
  session.taxAmount = taxAmount;
  session.serviceCharge = serviceCharge;
  session.total = total;
  session.paidAmount = paidAmount;
  session.dueAmount = dueAmount;
  await session.save();
  return session;
}

export function lineUnitPrice(item: {
  price: number;
  variants?: { name: string; priceDelta: number }[];
  addons?: { name: string; price: number }[];
}, variant: string, addons: string[]): number {
  const delta =
    item.variants?.find((v) => v.name === variant)?.priceDelta ?? 0;
  const addonSum = (item.addons ?? [])
    .filter((a) => addons.includes(a.name))
    .reduce((s, a) => s + a.price, 0);
  return item.price + delta + addonSum;
}

export function validateOrderMoney(
  lines: { unitPrice: number; qty: number }[],
  discountAmount: number
) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discount = Math.min(Math.max(0, discountAmount), subtotal);
  const taxAmount = calcTax(subtotal, discount);
  const total = calcTotal(subtotal, discount, taxAmount);
  return { subtotal, discountAmount: discount, taxAmount, total };
}

export async function nextSessionNumber(
  restaurantId: Types.ObjectId,
  branchId: Types.ObjectId,
  branchCode: string
): Promise<string> {
  const count = await TableSession.countDocuments({ restaurantId, branchId });
  return `${branchCode}-S-${String(count + 1).padStart(4, "0")}`;
}
