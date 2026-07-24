import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IMenuItem {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isVeg: boolean;
  isEgg: boolean;
  prepTimeMins: number;
  isAvailable: boolean;
  spiceLevel: number;
  allergens: string[];
  tags: string[];
  calories?: number;
  repeatRate: number;
  variants: { name: string; priceDelta: number }[];
  addons: { name: string; price: number }[];
}

const MenuItemSchema = new Schema(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "MenuCategory",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    imageUrl: { type: String, default: "" },
    isVeg: { type: Boolean, default: true },
    isEgg: { type: Boolean, default: false },
    prepTimeMins: { type: Number, default: 15 },
    isAvailable: { type: Boolean, default: true },
    spiceLevel: { type: Number, default: 0 },
    allergens: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    calories: { type: Number, default: 0 },
    repeatRate: { type: Number, default: 0 },
    variants: {
      type: [{ name: String, priceDelta: Number }],
      default: [],
    },
    addons: {
      type: [{ name: String, price: Number }],
      default: [],
    },
  },
  { timestamps: true }
);

MenuItemSchema.plugin(tenantPlugin);

export const MenuItem: Model<IMenuItem> =
  (models.MenuItem as Model<IMenuItem>) ||
  model<IMenuItem>("MenuItem", MenuItemSchema);
