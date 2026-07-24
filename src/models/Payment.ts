import mongoose, { Schema, models, model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IPayment {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId | null;
  sessionId?: mongoose.Types.ObjectId | null;
  method: "CASH" | "CARD" | "UPI";
  amount: number;
  tenderedAmount: number;
  changeAmount: number;
  tipAmount: number;
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
    method: {
      type: String,
      enum: ["CASH", "CARD", "UPI"],
      required: true,
    },
    amount: { type: Number, required: true },
    tenderedAmount: { type: Number, default: 0 },
    changeAmount: { type: Number, default: 0 },
    tipAmount: { type: Number, default: 0 },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PaymentSchema.plugin(tenantPlugin);

export const Payment =
  models.Payment || model<IPayment>("Payment", PaymentSchema);
