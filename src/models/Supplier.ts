import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface ISupplier {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  company: string;
  gstNumber: string;
  phone: string;
  email: string;
  address: string;
  rating: number;
  outstandingPaise: number;
  lastPurchaseAt?: Date | null;
  isActive: boolean;
}

const SupplierSchema = new Schema(
  {
    company: { type: String, required: true },
    gstNumber: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    outstandingPaise: { type: Number, default: 0 },
    lastPurchaseAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SupplierSchema.plugin(tenantPlugin);
SupplierSchema.index({ restaurantId: 1, branchId: 1, company: 1 });

export const Supplier: Model<ISupplier> =
  (models.Supplier as Model<ISupplier>) ||
  model<ISupplier>("Supplier", SupplierSchema);
