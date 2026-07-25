import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

/** Purchase lot — FIFO consumes oldest expiry / receivedAt first. */
export interface IInventoryBatch {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId | null;
  inventoryItemId: mongoose.Types.ObjectId;
  batchCode: string;
  supplierId?: mongoose.Types.ObjectId | null;
  purchaseOrderId?: mongoose.Types.ObjectId | null;
  receivedQty: number;
  remainingQty: number;
  unitCostPaise: number;
  receivedAt: Date;
  expiryDate?: Date | null;
  isActive: boolean;
}

const InventoryBatchSchema = new Schema(
  {
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
      index: true,
    },
    inventoryItemId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
      index: true,
    },
    batchCode: { type: String, required: true },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      default: null,
    },
    receivedQty: { type: Number, required: true },
    remainingQty: { type: Number, required: true },
    unitCostPaise: { type: Number, required: true, default: 0 },
    receivedAt: { type: Date, required: true, default: Date.now },
    expiryDate: { type: Date, default: null, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

InventoryBatchSchema.plugin(tenantPlugin);
InventoryBatchSchema.index({
  restaurantId: 1,
  branchId: 1,
  inventoryItemId: 1,
  remainingQty: 1,
});
InventoryBatchSchema.index(
  { restaurantId: 1, branchId: 1, batchCode: 1 },
  { unique: true }
);

export const InventoryBatch: Model<IInventoryBatch> =
  (models.InventoryBatch as Model<IInventoryBatch>) ||
  model<IInventoryBatch>("InventoryBatch", InventoryBatchSchema);
