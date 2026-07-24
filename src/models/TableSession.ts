import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface ITableSession {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  sessionNumber: string;
  tableIds: mongoose.Types.ObjectId[];
  status: "OPEN" | "BILL_REQUESTED" | "BILLED" | "CLOSED" | "ABANDONED";
  source: "QR" | "WAITER" | "POS";
  guestCount: number;
  guestName?: string;
  guestPhone?: string;
  customerId?: mongoose.Types.ObjectId | null;
  orderIds: mongoose.Types.ObjectId[];
  rounds: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceCharge: number;
  tipAmount: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  openedAt: Date;
  openedBy?: mongoose.Types.ObjectId | null;
  closedAt?: Date | null;
  closedBy?: mongoose.Types.ObjectId | null;
  closeReason?: string;
  lastActivityAt: Date;
}

const TableSessionSchema = new Schema(
  {
    sessionNumber: { type: String, required: true },
    tableIds: [{ type: Schema.Types.ObjectId, ref: "Table" }],
    status: {
      type: String,
      enum: ["OPEN", "BILL_REQUESTED", "BILLED", "CLOSED", "ABANDONED"],
      default: "OPEN",
    },
    source: { type: String, enum: ["QR", "WAITER", "POS"], required: true },
    guestCount: { type: Number, default: 1 },
    guestName: { type: String, default: "" },
    guestPhone: { type: String, default: "" },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    orderIds: [{ type: Schema.Types.ObjectId, ref: "Order" }],
    rounds: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    serviceCharge: { type: Number, default: 0 },
    tipAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    openedAt: { type: Date, default: Date.now },
    openedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    closedAt: { type: Date, default: null },
    closedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    closeReason: { type: String, default: "" },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TableSessionSchema.plugin(tenantPlugin);
TableSessionSchema.index(
  { restaurantId: 1, branchId: 1, sessionNumber: 1 },
  { unique: true }
);
TableSessionSchema.index({ restaurantId: 1, branchId: 1, status: 1 });
TableSessionSchema.index({ tableIds: 1, status: 1 });

export const TableSession: Model<ITableSession> =
  (models.TableSession as Model<ITableSession>) ||
  model<ITableSession>("TableSession", TableSessionSchema);
