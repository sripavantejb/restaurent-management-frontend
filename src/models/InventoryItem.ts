import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export const INVENTORY_UNITS = [
  "KG",
  "G",
  "L",
  "ML",
  "PCS",
  "BOX",
  "CARTON",
  "BOTTLE",
  "PACK",
  "DOZEN",
] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

export const COSTING_METHODS = ["FIFO", "LIFO", "AVG"] as const;
export type CostingMethod = (typeof COSTING_METHODS)[number];

export interface IInventoryItem {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId | null;
  categoryId?: mongoose.Types.ObjectId | null;
  subcategoryId?: mongoose.Types.ObjectId | null;
  supplierId?: mongoose.Types.ObjectId | null;
  name: string;
  sku: string;
  barcode: string;
  qrPayload: string;
  category: string;
  subcategory: string;
  brand: string;
  imageUrl: string;
  unit: InventoryUnit;
  quantityOnHand: number;
  reorderLevel: number;
  maxStock: number;
  /** Moving average cost in paise per unit */
  costPerUnit: number;
  costingMethod: CostingMethod;
  lastMovementAt?: Date | null;
  isActive: boolean;
}

const InventoryItemSchema = new Schema(
  {
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryCategory",
      default: null,
    },
    subcategoryId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryCategory",
      default: null,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    name: { type: String, required: true },
    sku: { type: String, default: "" },
    barcode: { type: String, default: "", index: true },
    qrPayload: { type: String, default: "" },
    category: { type: String, default: "General" },
    subcategory: { type: String, default: "" },
    brand: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    unit: {
      type: String,
      enum: INVENTORY_UNITS,
      default: "KG",
    },
    quantityOnHand: { type: Number, required: true, default: 0 },
    reorderLevel: { type: Number, required: true, default: 0 },
    maxStock: { type: Number, default: 0 },
    costPerUnit: { type: Number, required: true, default: 0 },
    costingMethod: {
      type: String,
      enum: COSTING_METHODS,
      default: "FIFO",
    },
    lastMovementAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

InventoryItemSchema.plugin(tenantPlugin);
InventoryItemSchema.index({ restaurantId: 1, branchId: 1, name: 1 });
InventoryItemSchema.index({ restaurantId: 1, branchId: 1, barcode: 1 });

export const InventoryItem: Model<IInventoryItem> =
  (models.InventoryItem as Model<IInventoryItem>) ||
  model<IInventoryItem>("InventoryItem", InventoryItemSchema);
