import mongoose, { Schema, models, model, type Model } from "mongoose";

export interface IAuditLog {
  _id: mongoose.Types.ObjectId;
  restaurantId?: mongoose.Types.ObjectId | null;
  branchId?: mongoose.Types.ObjectId | null;
  actorId?: mongoose.Types.ObjectId | null;
  actorType: "USER" | "PLATFORM" | "GUEST" | "SYSTEM";
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt: Date;
}

const AuditLogSchema = new Schema(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", default: null, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    actorId: { type: Schema.Types.ObjectId, default: null },
    actorType: {
      type: String,
      enum: ["USER", "PLATFORM", "GUEST", "SYSTEM"],
      default: "SYSTEM",
    },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, default: null },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ restaurantId: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  (models.AuditLog as Model<IAuditLog>) ||
  model<IAuditLog>("AuditLog", AuditLogSchema);
