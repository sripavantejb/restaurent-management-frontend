import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

/** Simple monthly payroll line for export / stubs. */
export interface IPayrollEntry {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  period: string; // YYYY-MM
  basePaise: number;
  daysPresent: number;
  daysLeave: number;
  netPaise: number;
  notes: string;
}

const PayrollEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    period: { type: String, required: true },
    basePaise: { type: Number, default: 0 },
    daysPresent: { type: Number, default: 0 },
    daysLeave: { type: Number, default: 0 },
    netPaise: { type: Number, default: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

PayrollEntrySchema.plugin(tenantPlugin);
PayrollEntrySchema.index(
  { restaurantId: 1, branchId: 1, userId: 1, period: 1 },
  { unique: true }
);

export const PayrollEntry: Model<IPayrollEntry> =
  (models.PayrollEntry as Model<IPayrollEntry>) ||
  model<IPayrollEntry>("PayrollEntry", PayrollEntrySchema);
