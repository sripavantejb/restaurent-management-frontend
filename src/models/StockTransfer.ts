import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export const TRANSFER_STATUSES = [
  "PENDING",
  "IN_TRANSIT",
  "ACCEPTED",
  "REJECTED",
] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export interface IStockTransfer {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  fromBranchId: mongoose.Types.ObjectId;
  toBranchId: mongoose.Types.ObjectId;
  fromWarehouseId?: mongoose.Types.ObjectId | null;
  toWarehouseId?: mongoose.Types.ObjectId | null;
  transferNumber: string;
  status: TransferStatus;
  inventoryItemId: mongoose.Types.ObjectId;
  qty: number;
  unit: string;
  note: string;
  createdBy?: mongoose.Types.ObjectId | null;
  acceptedBy?: mongoose.Types.ObjectId | null;
  acceptedAt?: Date | null;
}

const StockTransferSchema = new Schema(
  {
    fromBranchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    toBranchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    fromWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    toWarehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    transferNumber: { type: String, required: true },
    status: { type: String, enum: TRANSFER_STATUSES, default: "PENDING" },
    inventoryItemId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },
    qty: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "KG" },
    note: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

StockTransferSchema.plugin(tenantPlugin);
StockTransferSchema.index({ restaurantId: 1, transferNumber: 1 }, { unique: true });

export const StockTransfer: Model<IStockTransfer> =
  (models.StockTransfer as Model<IStockTransfer>) ||
  model<IStockTransfer>("StockTransfer", StockTransferSchema);
