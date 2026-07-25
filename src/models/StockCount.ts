import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export const COUNT_STATUSES = ["OPEN", "RECONCILED", "CANCELLED"] as const;
export type CountStatus = (typeof COUNT_STATUSES)[number];

export interface IStockCountLine {
  inventoryItemId: mongoose.Types.ObjectId;
  systemQty: number;
  countedQty: number;
  variance: number;
}

export interface IStockCount {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId | null;
  countNumber: string;
  status: CountStatus;
  cycle: boolean;
  notes: string;
  lines: IStockCountLine[];
  createdBy?: mongoose.Types.ObjectId | null;
  reconciledAt?: Date | null;
}

const LineSchema = new Schema(
  {
    inventoryItemId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },
    systemQty: { type: Number, required: true },
    countedQty: { type: Number, required: true },
    variance: { type: Number, required: true },
  },
  { _id: false }
);

const StockCountSchema = new Schema(
  {
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    countNumber: { type: String, required: true },
    status: { type: String, enum: COUNT_STATUSES, default: "OPEN" },
    cycle: { type: Boolean, default: false },
    notes: { type: String, default: "" },
    lines: { type: [LineSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reconciledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

StockCountSchema.plugin(tenantPlugin);
StockCountSchema.index(
  { restaurantId: 1, branchId: 1, countNumber: 1 },
  { unique: true }
);

export const StockCount: Model<IStockCount> =
  (models.StockCount as Model<IStockCount>) ||
  model<IStockCount>("StockCount", StockCountSchema);
