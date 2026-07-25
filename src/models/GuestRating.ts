import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IGuestRating {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId | null;
  tableId?: mongoose.Types.ObjectId | null;
  deviceId: string;
  stars: number;
  comment: string;
  tipPaise: number;
}

const GuestRatingSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "TableSession", default: null },
    tableId: { type: Schema.Types.ObjectId, ref: "Table", default: null },
    deviceId: { type: String, default: "" },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 500 },
    tipPaise: { type: Number, default: 0 },
  },
  { timestamps: true }
);

GuestRatingSchema.plugin(tenantPlugin);

export const GuestRating: Model<IGuestRating> =
  (models.GuestRating as Model<IGuestRating>) ||
  model<IGuestRating>("GuestRating", GuestRatingSchema);
