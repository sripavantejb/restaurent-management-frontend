import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface ICampaign {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  name: string;
  channel: "WHATSAPP" | "EMAIL" | "SMS" | "PUSH" | "IN_APP";
  status: "DRAFT" | "SCHEDULED" | "SENT" | "CANCELLED";
  message: string;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  audience: string;
}

const CampaignSchema = new Schema(
  {
    name: { type: String, required: true },
    channel: {
      type: String,
      enum: ["WHATSAPP", "EMAIL", "SMS", "PUSH", "IN_APP"],
      default: "WHATSAPP",
    },
    status: {
      type: String,
      enum: ["DRAFT", "SCHEDULED", "SENT", "CANCELLED"],
      default: "DRAFT",
    },
    message: { type: String, required: true },
    scheduledAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    audience: { type: String, default: "ALL" },
  },
  { timestamps: true }
);

CampaignSchema.plugin(tenantPlugin);

export const Campaign: Model<ICampaign> =
  (models.Campaign as Model<ICampaign>) ||
  model<ICampaign>("Campaign", CampaignSchema);
