import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export const PR_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "ORDERED",
] as const;
export type PrStatus = (typeof PR_STATUSES)[number];

export interface IPurchaseRequestLine {
  inventoryItemId: mongoose.Types.ObjectId;
  qty: number;
  unit: string;
  note: string;
}

export interface IPurchaseRequest {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  requestNumber: string;
  status: PrStatus;
  lines: IPurchaseRequestLine[];
  requestedBy?: mongoose.Types.ObjectId | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  notes: string;
}

const LineSchema = new Schema(
  {
    inventoryItemId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },
    qty: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "KG" },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const PurchaseRequestSchema = new Schema(
  {
    requestNumber: { type: String, required: true },
    status: { type: String, enum: PR_STATUSES, default: "PENDING" },
    lines: { type: [LineSchema], default: [] },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

PurchaseRequestSchema.plugin(tenantPlugin);
PurchaseRequestSchema.index(
  { restaurantId: 1, branchId: 1, requestNumber: 1 },
  { unique: true }
);

export const PurchaseRequest: Model<IPurchaseRequest> =
  (models.PurchaseRequest as Model<IPurchaseRequest>) ||
  model<IPurchaseRequest>("PurchaseRequest", PurchaseRequestSchema);
