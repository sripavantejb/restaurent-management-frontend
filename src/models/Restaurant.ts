import mongoose, { Schema, models, model, type Model } from "mongoose";

export const RESTAURANT_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;
export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];

export interface IRestaurant {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  status: RestaurantStatus;
  contactEmail: string;
  contactPhone: string;
  logoUrl: string;
  gstNumber: string;
  currency: string;
  timezone: string;
  address: string;
  qrSecretVersion: number;
  qrPreviousVersion: number | null;
  qrRotatedAt: Date | null;
  qrApprovalMode: boolean;
  qrOrderingEnabled: boolean;
  maxGuestOrderPaise: number;
  wifiSsid: string;
  wifiPassword: string;
  menuVersion: string;
}

const RestaurantSchema = new Schema<IRestaurant>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    status: {
      type: String,
      enum: RESTAURANT_STATUSES,
      default: "ACTIVE",
      index: true,
    },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    currency: { type: String, default: "INR" },
    timezone: { type: String, default: "Asia/Kolkata" },
    address: { type: String, default: "" },
    qrSecretVersion: { type: Number, default: 1 },
    qrPreviousVersion: { type: Number, default: null },
    qrRotatedAt: { type: Date, default: null },
    qrApprovalMode: { type: Boolean, default: false },
    qrOrderingEnabled: { type: Boolean, default: true },
    maxGuestOrderPaise: { type: Number, default: 500000 },
    wifiSsid: { type: String, default: "" },
    wifiPassword: { type: String, default: "" },
    menuVersion: { type: String, default: "1" },
  },
  { timestamps: true }
);

export const Restaurant: Model<IRestaurant> =
  (models.Restaurant as Model<IRestaurant>) ||
  model<IRestaurant>("Restaurant", RestaurantSchema);
