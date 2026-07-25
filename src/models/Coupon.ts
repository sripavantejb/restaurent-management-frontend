import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface ICoupon {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  minOrderPaise: number;
  maxRedemptions: number;
  redeemedCount: number;
  validFrom: Date;
  validTo: Date;
  isActive: boolean;
}

const CouponSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true },
    type: { type: String, enum: ["PERCENT", "FLAT"], default: "PERCENT" },
    value: { type: Number, required: true },
    minOrderPaise: { type: Number, default: 0 },
    maxRedemptions: { type: Number, default: 1000 },
    redeemedCount: { type: Number, default: 0 },
    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CouponSchema.plugin(tenantPlugin);
CouponSchema.index({ restaurantId: 1, code: 1 }, { unique: true });

export const Coupon: Model<ICoupon> =
  (models.Coupon as Model<ICoupon>) || model<ICoupon>("Coupon", CouponSchema);
