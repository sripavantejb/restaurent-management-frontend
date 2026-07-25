import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IWarehouse {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
}

const WarehouseSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

WarehouseSchema.plugin(tenantPlugin);
WarehouseSchema.index({ restaurantId: 1, branchId: 1, code: 1 }, { unique: true });

export const Warehouse: Model<IWarehouse> =
  (models.Warehouse as Model<IWarehouse>) ||
  model<IWarehouse>("Warehouse", WarehouseSchema);
