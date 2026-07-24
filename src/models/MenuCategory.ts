import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IMenuCategory {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

const MenuCategorySchema = new Schema(
  {
    name: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

MenuCategorySchema.plugin(tenantPlugin);

export const MenuCategory: Model<IMenuCategory> =
  (models.MenuCategory as Model<IMenuCategory>) ||
  model<IMenuCategory>("MenuCategory", MenuCategorySchema);
