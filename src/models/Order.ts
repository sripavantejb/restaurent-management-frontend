import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IOrderItem {
  _id?: mongoose.Types.ObjectId;
  menuItemId: mongoose.Types.ObjectId;
  name: string;
  qty: number;
  unitPrice: number;
  variant: string;
  addons: string[];
  notes: string;
  status: "QUEUED" | "COOKING" | "READY";
  guestLabel?: string;
}

export interface IOrder {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  orderNumber: string;
  type: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableId: mongoose.Types.ObjectId | null;
  waiterId: mongoose.Types.ObjectId | null;
  sessionId?: mongoose.Types.ObjectId | null;
  roundNumber?: number;
  placedBy?: "STAFF" | "GUEST";
  guestDeviceId?: string;
  idempotencyKey?: string;
  approvalStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  status:
    | "DRAFT"
    | "PLACED"
    | "PREPARING"
    | "READY"
    | "SERVED"
    | "COMPLETED"
    | "CANCELLED";
  items: IOrderItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  placedAt: Date | null;
  readyAt: Date | null;
  completedAt: Date | null;
  servedAt: Date | null;
}

const OrderItemSchema = new Schema(
  {
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    variant: { type: String, default: "" },
    addons: { type: [String], default: [] },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["QUEUED", "COOKING", "READY"],
      default: "QUEUED",
    },
    guestLabel: { type: String, default: "" },
  },
  { _id: true }
);

const OrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true },
    type: {
      type: String,
      enum: ["DINE_IN", "TAKEAWAY", "DELIVERY"],
      required: true,
    },
    tableId: { type: Schema.Types.ObjectId, ref: "Table", default: null },
    waiterId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: Schema.Types.ObjectId, ref: "TableSession", default: null },
    roundNumber: { type: Number, default: 1 },
    placedBy: { type: String, enum: ["STAFF", "GUEST"], default: "STAFF" },
    guestDeviceId: { type: String, default: "" },
    idempotencyKey: { type: String, default: "" },
    approvalStatus: {
      type: String,
      enum: ["NONE", "PENDING", "APPROVED", "REJECTED"],
      default: "NONE",
    },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "PLACED",
        "PREPARING",
        "READY",
        "SERVED",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "DRAFT",
    },
    items: { type: [OrderItemSchema], default: [] },
    subtotal: { type: Number, required: true, default: 0 },
    discountAmount: { type: Number, required: true, default: 0 },
    taxAmount: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    placedAt: { type: Date, default: null },
    readyAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    servedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

OrderSchema.plugin(tenantPlugin);
OrderSchema.index({ restaurantId: 1, branchId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ restaurantId: 1, branchId: 1, status: 1, placedAt: -1 });
OrderSchema.index({ sessionId: 1 });
OrderSchema.index(
  { restaurantId: 1, branchId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $gt: "" } } }
);

export const Order: Model<IOrder> =
  (models.Order as Model<IOrder>) || model<IOrder>("Order", OrderSchema);
