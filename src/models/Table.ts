import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";
import { softDeletePlugin } from "@/lib/soft-delete";

export const TABLE_STATUSES = [
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "PREPARING_BILL",
  "CLEANING",
  "BLOCKED",
  "OUT_OF_SERVICE",
  /** @deprecated prefer AVAILABLE / PREPARING_BILL */
  "FREE",
  "BILLED",
] as const;

export type TableStatus = (typeof TABLE_STATUSES)[number];

export interface ITable {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  floorId?: mongoose.Types.ObjectId | null;
  sectionId?: mongoose.Types.ObjectId | null;
  number: number;
  name?: string;
  capacity: number;
  shape: "SQUARE" | "ROUND" | "RECT";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  isVip: boolean;
  isOutdoor: boolean;
  isDisabled: boolean;
  mergeGroupId?: string | null;
  status: TableStatus;
  currentSessionId?: mongoose.Types.ObjectId | null;
  deletedAt?: Date | null;
}

const TableSchema = new Schema(
  {
    floorId: { type: Schema.Types.ObjectId, ref: "Floor", default: null, index: true },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: "Section",
      default: null,
      index: true,
    },
    number: { type: Number, required: true },
    name: { type: String, default: "" },
    capacity: { type: Number, required: true },
    shape: {
      type: String,
      enum: ["SQUARE", "ROUND", "RECT"],
      default: "SQUARE",
    },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, default: 72 },
    height: { type: Number, default: 72 },
    rotation: { type: Number, default: 0 },
    color: { type: String, default: "" },
    isVip: { type: Boolean, default: false },
    isOutdoor: { type: Boolean, default: false },
    isDisabled: { type: Boolean, default: false },
    mergeGroupId: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: TABLE_STATUSES,
      default: "AVAILABLE",
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
TableSchema.plugin(softDeletePlugin);
TableSchema.index({ restaurantId: 1, branchId: 1, number: 1 }, { unique: true });

export const Table: Model<ITable> =
  (models.Table as Model<ITable>) || model<ITable>("Table", TableSchema);

/** Normalize legacy FREE/BILLED into enterprise statuses. */
export function normalizeTableStatus(status: string): TableStatus {
  if (status === "FREE") return "AVAILABLE";
  if (status === "BILLED") return "PREPARING_BILL";
  return status as TableStatus;
}
