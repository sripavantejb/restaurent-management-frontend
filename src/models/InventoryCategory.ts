import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IInventoryCategory {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  name: string;
  parentId?: mongoose.Types.ObjectId | null;
  sortOrder: number;
  isActive: boolean;
}

const InventoryCategorySchema = new Schema(
  {
    name: { type: String, required: true },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryCategory",
      default: null,
      index: true,
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

InventoryCategorySchema.plugin(tenantPlugin);
InventoryCategorySchema.index({ restaurantId: 1, branchId: 1, name: 1 });

export const InventoryCategory: Model<IInventoryCategory> =
  (models.InventoryCategory as Model<IInventoryCategory>) ||
  model<IInventoryCategory>("InventoryCategory", InventoryCategorySchema);
