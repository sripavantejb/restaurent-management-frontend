import mongoose, { Schema, models, model, type Model } from "mongoose";
import {
  PLANS,
  BILLING_STATUSES,
  type PlanId,
  type BillingStatus,
} from "@/lib/billing/plans";
import type { ModuleMap, LimitOverrides } from "@/lib/platform/modules";

export const RESTAURANT_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;
export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];

export interface IRestaurant {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  status: RestaurantStatus;
  plan: PlanId;
  billingStatus: BillingStatus;
  trialEndsAt: Date | null;
  razorpayCustomerId: string;
  razorpaySubscriptionId: string;
  currentPeriodEnd: Date | null;
  /** Per-module on/off overrides (merged with plan defaults at runtime). */
  modules: ModuleMap;
  /** Null/undefined fields inherit plan limits. */
  limitOverrides: LimitOverrides;
  contactEmail: string;
  contactPhone: string;
  logoUrl: string;
  gstNumber: string;
  fssaiNumber: string;
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
  /** Business hours Mon=0 … Sun=6 */
  businessHours: {
    day: number;
    open: string;
    close: string;
    closed: boolean;
  }[];
  taxSettings: {
    mode: "INCLUSIVE" | "EXCLUSIVE";
    gstRate: number;
    cessRate: number;
    serviceChargePct: number;
    roundOff: boolean;
    interStateDefault: boolean;
  };
  receiptSettings: {
    footer: string;
    thankYou: string;
    terms: string;
    showLogo: boolean;
    showGst: boolean;
    showFssai: boolean;
  };
  branding: {
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
  };
  locale: {
    language: string;
    dateFormat: string;
  };
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
    plan: {
      type: String,
      enum: PLANS,
      default: "STARTER",
      index: true,
    },
    billingStatus: {
      type: String,
      enum: BILLING_STATUSES,
      default: "TRIAL",
      index: true,
    },
    trialEndsAt: { type: Date, default: null },
    razorpayCustomerId: { type: String, default: "" },
    razorpaySubscriptionId: { type: String, default: "" },
    currentPeriodEnd: { type: Date, default: null },
    modules: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    limitOverrides: {
      maxBranches: { type: Number, default: null },
      maxStaff: { type: Number, default: null },
      maxTables: { type: Number, default: null },
    },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    fssaiNumber: { type: String, default: "" },
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
    businessHours: {
      type: [
        {
          day: { type: Number, required: true },
          open: { type: String, default: "10:00" },
          close: { type: String, default: "22:00" },
          closed: { type: Boolean, default: false },
        },
      ],
      default: () =>
        [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          day,
          open: "10:00",
          close: "22:00",
          closed: false,
        })),
    },
    taxSettings: {
      mode: { type: String, enum: ["INCLUSIVE", "EXCLUSIVE"], default: "EXCLUSIVE" },
      gstRate: { type: Number, default: 0.05 },
      cessRate: { type: Number, default: 0 },
      serviceChargePct: { type: Number, default: 0 },
      roundOff: { type: Boolean, default: true },
      interStateDefault: { type: Boolean, default: false },
    },
    receiptSettings: {
      footer: { type: String, default: "Thank you for dining with us" },
      thankYou: { type: String, default: "Visit again!" },
      terms: { type: String, default: "All prices in INR. Taxes as applicable." },
      showLogo: { type: Boolean, default: true },
      showGst: { type: Boolean, default: true },
      showFssai: { type: Boolean, default: true },
    },
    branding: {
      primaryColor: { type: String, default: "#12100e" },
      accentColor: { type: String, default: "#e4572e" },
      fontFamily: { type: String, default: "DM Sans" },
    },
    locale: {
      language: { type: String, default: "en-IN" },
      dateFormat: { type: String, default: "dd/MM/yyyy" },
    },
  },
  { timestamps: true }
);

export const Restaurant: Model<IRestaurant> =
  (models.Restaurant as Model<IRestaurant>) ||
  model<IRestaurant>("Restaurant", RestaurantSchema);
