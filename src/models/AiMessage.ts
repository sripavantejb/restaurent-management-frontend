import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IAiMessage {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  blocks?: { type: string; title?: string; data: unknown }[];
  toolName?: string | null;
  toolCallId?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const AiMessageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "AiConversation",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system", "tool"],
      required: true,
    },
    content: { type: String, default: "" },
    blocks: { type: [Schema.Types.Mixed], default: [] },
    toolName: { type: String, default: null },
    toolCallId: { type: String, default: null },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AiMessageSchema.plugin(tenantPlugin);
AiMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const AiMessage: Model<IAiMessage> =
  (models.AiMessage as Model<IAiMessage>) ||
  model<IAiMessage>("AiMessage", AiMessageSchema);
