import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IGuestCartLine {
  _id?: mongoose.Types.ObjectId;
  menuItemId: mongoose.Types.ObjectId;
  name: string;
  qty: number;
  unitPrice: number;
  variant: string;
  addons: string[];
  notes: string;
  isVeg: boolean;
  guestLabel: string;
  deviceId: string;
  unavailable?: boolean;
}

export interface IGuestCart {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  lines: IGuestCartLine[];
  updatedAt: Date;
}

const LineSchema = new Schema(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
    name: String,
    qty: { type: Number, min: 1 },
    unitPrice: Number,
    variant: { type: String, default: "" },
    addons: [String],
    notes: { type: String, default: "" },
    isVeg: Boolean,
    guestLabel: String,
    deviceId: String,
    unavailable: { type: Boolean, default: false },
  },
  { _id: true }
);

const GuestCartSchema = new Schema(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "TableSession",
      required: true,
      unique: true,
    },
    lines: { type: [LineSchema], default: [] },
  },
  { timestamps: true }
);

GuestCartSchema.plugin(tenantPlugin);

export const GuestCart: Model<IGuestCart> =
  (models.GuestCart as Model<IGuestCart>) ||
  model<IGuestCart>("GuestCart", GuestCartSchema);
