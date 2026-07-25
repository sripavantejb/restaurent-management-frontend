import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface INotification {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
  role?: string | null;
  type: string;
  title: string;
  body: string;
  href?: string | null;
  readAt?: Date | null;
  meta?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    role: { type: String, default: null },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    href: { type: String, default: null },
    readAt: { type: Date, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

NotificationSchema.plugin(tenantPlugin);
NotificationSchema.index({ restaurantId: 1, branchId: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  (models.Notification as Model<INotification>) ||
  model<INotification>("Notification", NotificationSchema);
