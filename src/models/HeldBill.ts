import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

/** Held POS bills for resume later */
export interface IHeldBill {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  label: string;
  type: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableId?: mongoose.Types.ObjectId | null;
  tableNumber?: number | null;
  lines: {
    menuItemId: string;
    name: string;
    qty: number;
    unitPrice: number;
    variant: string;
    addons: string[];
    notes: string;
  }[];
  discountPaise: number;
  heldBy?: mongoose.Types.ObjectId | null;
}

const HeldBillSchema = new Schema(
  {
    label: { type: String, default: "Held bill" },
    type: {
      type: String,
      enum: ["DINE_IN", "TAKEAWAY", "DELIVERY"],
      default: "DINE_IN",
    },
    tableId: { type: Schema.Types.ObjectId, ref: "Table", default: null },
    tableNumber: { type: Number, default: null },
    lines: { type: [Schema.Types.Mixed], default: [] },
    discountPaise: { type: Number, default: 0 },
    heldBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

HeldBillSchema.plugin(tenantPlugin);

export const HeldBill: Model<IHeldBill> =
  (models.HeldBill as Model<IHeldBill>) ||
  model<IHeldBill>("HeldBill", HeldBillSchema);
