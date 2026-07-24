import mongoose, { Schema, models, model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IQRScan {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  qrCodeId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId | null;
  deviceHash: string;
  scannedAt: Date;
  convertedToOrder: boolean;
  orderId?: mongoose.Types.ObjectId | null;
  isReturningDevice: boolean;
  firstItemAt?: Date | null;
}

const QRScanSchema = new Schema(
  {
    qrCodeId: { type: Schema.Types.ObjectId, ref: "QRCode", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "TableSession", default: null },
    deviceHash: { type: String, required: true },
    scannedAt: { type: Date, default: Date.now },
    convertedToOrder: { type: Boolean, default: false },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    isReturningDevice: { type: Boolean, default: false },
    firstItemAt: { type: Date, default: null },
  },
  { timestamps: true }
);

QRScanSchema.plugin(tenantPlugin);
QRScanSchema.index({ restaurantId: 1, branchId: 1, scannedAt: -1 });
QRScanSchema.index({ qrCodeId: 1, deviceHash: 1 });

export const QRScan = models.QRScan || model<IQRScan>("QRScan", QRScanSchema);
