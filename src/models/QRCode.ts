import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IQRCode {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  shortCode: string;
  type: "TABLE" | "BRANCH_TAKEAWAY";
  tableId?: mongoose.Types.ObjectId | null;
  targetUrl: string;
  token: string;
  secretVersion: number;
  label: string;
  isActive: boolean;
  scanCount: number;
  uniqueScanCount: number;
  lastScannedAt?: Date | null;
  designId?: string;
  createdBy?: mongoose.Types.ObjectId | null;
  wifiSsid?: string;
  wifiPassword?: string;
}

const QRCodeSchema = new Schema(
  {
    shortCode: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ["TABLE", "BRANCH_TAKEAWAY"], required: true },
    tableId: { type: Schema.Types.ObjectId, ref: "Table", default: null },
    targetUrl: { type: String, required: true },
    token: { type: String, required: true },
    secretVersion: { type: Number, required: true },
    label: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    scanCount: { type: Number, default: 0 },
    uniqueScanCount: { type: Number, default: 0 },
    lastScannedAt: { type: Date, default: null },
    designId: { type: String, default: "classic" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    wifiSsid: { type: String, default: "" },
    wifiPassword: { type: String, default: "" },
  },
  { timestamps: true }
);

QRCodeSchema.plugin(tenantPlugin);
QRCodeSchema.index({ restaurantId: 1, branchId: 1, tableId: 1 });

export const QRCode: Model<IQRCode> =
  (models.QRCode as Model<IQRCode>) || model<IQRCode>("QRCode", QRCodeSchema);
