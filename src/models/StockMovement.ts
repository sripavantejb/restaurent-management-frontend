import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export const STOCK_MOVEMENT_TYPES = [
  "IN",
  "OUT",
  "WASTE",
  "ADJUST",
  "SALE",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "PURCHASE",
  "INTERNAL",
  "RETURN",
  "COUNT",
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const WASTE_REASONS = [
  "SPOILAGE",
  "KITCHEN_WASTE",
  "CUSTOMER_RETURN",
  "DAMAGED",
  "EXPIRED",
  "STAFF_MEAL",
  "TESTING",
] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];

export interface IStockMovement {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId | null;
  inventoryItemId: mongoose.Types.ObjectId;
  batchId?: mongoose.Types.ObjectId | null;
  type: StockMovementType;
  quantity: number;
  unitCostPaise: number;
  note: string;
  wasteReason?: WasteReason | null;
  reference?: string;
  orderId?: mongoose.Types.ObjectId | null;
  purchaseOrderId?: mongoose.Types.ObjectId | null;
  transferId?: mongoose.Types.ObjectId | null;
  supplierId?: mongoose.Types.ObjectId | null;
  menuItemName?: string;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt?: Date;
}

const StockMovementSchema = new Schema(
  {
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    inventoryItemId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryBatch",
      default: null,
    },
    type: {
      type: String,
      enum: STOCK_MOVEMENT_TYPES,
      required: true,
    },
    quantity: { type: Number, required: true },
    unitCostPaise: { type: Number, default: 0 },
    note: { type: String, default: "" },
    wasteReason: {
      type: String,
      default: null,
    },
    reference: { type: String, default: "" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      default: null,
    },
    transferId: {
      type: Schema.Types.ObjectId,
      ref: "StockTransfer",
      default: null,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    menuItemName: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

StockMovementSchema.plugin(tenantPlugin);
StockMovementSchema.index({ restaurantId: 1, branchId: 1, createdAt: -1 });
StockMovementSchema.index({ inventoryItemId: 1, createdAt: -1 });

export const StockMovement: Model<IStockMovement> =
  (models.StockMovement as Model<IStockMovement>) ||
  model<IStockMovement>("StockMovement", StockMovementSchema);
