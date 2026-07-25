import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

/** Supplier unit-price history for comparison & forecasting. */
export interface ISupplierPriceHistory {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  inventoryItemId: mongoose.Types.ObjectId;
  unitCostPaise: number;
  recordedAt: Date;
  purchaseOrderId?: mongoose.Types.ObjectId | null;
}

const SupplierPriceHistorySchema = new Schema(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    inventoryItemId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
      index: true,
    },
    unitCostPaise: { type: Number, required: true },
    recordedAt: { type: Date, default: Date.now },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      default: null,
    },
  },
  { timestamps: true }
);

SupplierPriceHistorySchema.plugin(tenantPlugin);
SupplierPriceHistorySchema.index({
  restaurantId: 1,
  inventoryItemId: 1,
  recordedAt: -1,
});

export const SupplierPriceHistory: Model<ISupplierPriceHistory> =
  (models.SupplierPriceHistory as Model<ISupplierPriceHistory>) ||
  model<ISupplierPriceHistory>("SupplierPriceHistory", SupplierPriceHistorySchema);
