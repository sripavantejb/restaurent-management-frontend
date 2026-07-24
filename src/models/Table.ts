import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface ITable {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  number: number;
  capacity: number;
  shape: "SQUARE" | "ROUND" | "RECT";
  x: number;
  y: number;
  status: "FREE" | "OCCUPIED" | "BILLED" | "RESERVED";
  currentSessionId?: mongoose.Types.ObjectId | null;
}

const TableSchema = new Schema(
  {
    number: { type: Number, required: true },
    capacity: { type: Number, required: true },
    shape: {
      type: String,
      enum: ["SQUARE", "ROUND", "RECT"],
      default: "SQUARE",
    },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    status: {
      type: String,
      enum: ["FREE", "OCCUPIED", "BILLED", "RESERVED"],
      default: "FREE",
    },
    currentSessionId: {
      type: Schema.Types.ObjectId,
      ref: "TableSession",
      default: null,
    },
  },
  { timestamps: true }
);

TableSchema.plugin(tenantPlugin);
TableSchema.index({ restaurantId: 1, branchId: 1, number: 1 }, { unique: true });

export const Table: Model<ITable> =
  (models.Table as Model<ITable>) || model<ITable>("Table", TableSchema);
