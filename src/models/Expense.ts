import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IExpense {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  category: string;
  description: string;
  amountPaise: number;
  paidAt: Date;
  paymentMethod: string;
  vendor: string;
  createdBy?: mongoose.Types.ObjectId | null;
}

const ExpenseSchema = new Schema(
  {
    category: { type: String, required: true },
    description: { type: String, default: "" },
    amountPaise: { type: Number, required: true },
    paidAt: { type: Date, default: Date.now },
    paymentMethod: { type: String, default: "CASH" },
    vendor: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

ExpenseSchema.plugin(tenantPlugin);
ExpenseSchema.index({ restaurantId: 1, branchId: 1, paidAt: -1 });

export const Expense: Model<IExpense> =
  (models.Expense as Model<IExpense>) || model<IExpense>("Expense", ExpenseSchema);
