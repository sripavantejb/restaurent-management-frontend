import mongoose, { Schema, models, model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export const PAY_METHODS = ["CASH", "CARD", "UPI", "WALLET"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

export const PAY_KINDS = ["CHARGE", "REFUND"] as const;
export type PayKind = (typeof PAY_KINDS)[number];

export interface IPayment {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId | null;
  sessionId?: mongoose.Types.ObjectId | null;
  customerId?: mongoose.Types.ObjectId | null;
  kind: PayKind;
  method: PayMethod;
  amount: number;
  tenderedAmount: number;
  changeAmount: number;
  tipAmount: number;
  isPartial: boolean;
  notes: string;
  paidAt: Date;
}

const PaymentSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "TableSession",
      default: null,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    kind: {
      type: String,
      enum: PAY_KINDS,
      default: "CHARGE",
      index: true,
    },
    method: {
      type: String,
      enum: PAY_METHODS,
      required: true,
    },
    amount: { type: Number, required: true },
    tenderedAmount: { type: Number, default: 0 },
    changeAmount: { type: Number, default: 0 },
    tipAmount: { type: Number, default: 0 },
    isPartial: { type: Boolean, default: false },
    notes: { type: String, default: "" },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PaymentSchema.plugin(tenantPlugin);
PaymentSchema.index({ restaurantId: 1, branchId: 1, paidAt: -1 });

export const Payment =
  models.Payment || model<IPayment>("Payment", PaymentSchema);
