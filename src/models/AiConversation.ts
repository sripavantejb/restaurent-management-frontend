import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IAiConversation {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  pinned: boolean;
  archivedAt?: Date | null;
  lastMessageAt: Date;
  context?: {
    dateFrom?: string | null;
    dateTo?: string | null;
    filters?: Record<string, unknown>;
  };
}

const AiConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New chat" },
    pinned: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    lastMessageAt: { type: Date, default: Date.now },
    context: {
      dateFrom: { type: String, default: null },
      dateTo: { type: String, default: null },
      filters: { type: Schema.Types.Mixed, default: {} },
    },
  },
  { timestamps: true }
);

AiConversationSchema.plugin(tenantPlugin);
AiConversationSchema.index({
  restaurantId: 1,
  branchId: 1,
  userId: 1,
  lastMessageAt: -1,
});

export const AiConversation: Model<IAiConversation> =
  (models.AiConversation as Model<IAiConversation>) ||
  model<IAiConversation>("AiConversation", AiConversationSchema);
