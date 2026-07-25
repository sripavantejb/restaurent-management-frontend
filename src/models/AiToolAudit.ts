import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IAiToolAudit {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId | null;
  question?: string | null;
  toolName: string;
  args: Record<string, unknown>;
  success: boolean;
  error?: string | null;
  durationMs: number;
  resultSummary?: string | null;
}

const AiToolAuditSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "AiConversation",
      default: null,
    },
    question: { type: String, default: null },
    toolName: { type: String, required: true, index: true },
    args: { type: Schema.Types.Mixed, default: {} },
    success: { type: Boolean, required: true },
    error: { type: String, default: null },
    durationMs: { type: Number, required: true },
    resultSummary: { type: String, default: null },
  },
  { timestamps: true }
);

AiToolAuditSchema.plugin(tenantPlugin);
AiToolAuditSchema.index({ restaurantId: 1, branchId: 1, createdAt: -1 });

export const AiToolAudit: Model<IAiToolAudit> =
  (models.AiToolAudit as Model<IAiToolAudit>) ||
  model<IAiToolAudit>("AiToolAudit", AiToolAuditSchema);
