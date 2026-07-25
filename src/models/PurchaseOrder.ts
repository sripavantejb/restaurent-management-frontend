import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export const PO_STATUSES = [
  "DRAFT",
  "SENT",
  "PARTIAL",
  "RECEIVED",
  "CANCELLED",
] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export interface IPurchaseOrderLine {
  inventoryItemId: mongoose.Types.ObjectId;
  qtyOrdered: number;
  qtyReceived: number;
  unitCostPaise: number;
  unit: string;
}

export interface IPurchaseOrder {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  warehouseId?: mongoose.Types.ObjectId | null;
  supplierId: mongoose.Types.ObjectId;
  purchaseRequestId?: mongoose.Types.ObjectId | null;
  poNumber: string;
  status: PoStatus;
  lines: IPurchaseOrderLine[];
  invoiceNumber: string;
  invoicePaise: number;
  expectedAt?: Date | null;
  receivedAt?: Date | null;
  createdBy?: mongoose.Types.ObjectId | null;
}

const PoLineSchema = new Schema(
  {
    inventoryItemId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },
    qtyOrdered: { type: Number, required: true },
    qtyReceived: { type: Number, default: 0 },
    unitCostPaise: { type: Number, default: 0 },
    unit: { type: String, default: "KG" },
  },
  { _id: false }
);

const PurchaseOrderSchema = new Schema(
  {
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    purchaseRequestId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseRequest",
      default: null,
    },
    poNumber: { type: String, required: true },
    status: { type: String, enum: PO_STATUSES, default: "SENT" },
    lines: { type: [PoLineSchema], default: [] },
    invoiceNumber: { type: String, default: "" },
    invoicePaise: { type: Number, default: 0 },
    expectedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

PurchaseOrderSchema.plugin(tenantPlugin);
PurchaseOrderSchema.index(
  { restaurantId: 1, branchId: 1, poNumber: 1 },
  { unique: true }
);

export const PurchaseOrder: Model<IPurchaseOrder> =
  (models.PurchaseOrder as Model<IPurchaseOrder>) ||
  model<IPurchaseOrder>("PurchaseOrder", PurchaseOrderSchema);
