import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export const LEAVE_TYPES = [
  "CASUAL",
  "SICK",
  "EARNED",
  "UNPAID",
  "COMP_OFF",
] as const;

export const LEAVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export interface ILeaveRequest {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: LeaveType;
  status: LeaveStatus;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  days: number;
  reason: string;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNote: string;
}

const LeaveRequestSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: LEAVE_TYPES,
      required: true,
      default: "CASUAL",
    },
    status: {
      type: String,
      enum: LEAVE_STATUSES,
      default: "PENDING",
      index: true,
    },
    fromDate: { type: String, required: true, index: true },
    toDate: { type: String, required: true },
    days: { type: Number, required: true, min: 0.5 },
    reason: { type: String, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" },
  },
  { timestamps: true }
);

LeaveRequestSchema.plugin(tenantPlugin);
LeaveRequestSchema.index({ restaurantId: 1, branchId: 1, fromDate: 1 });
LeaveRequestSchema.index({ restaurantId: 1, branchId: 1, userId: 1, status: 1 });

export const LeaveRequest: Model<ILeaveRequest> =
  (models.LeaveRequest as Model<ILeaveRequest>) ||
  model<ILeaveRequest>("LeaveRequest", LeaveRequestSchema);

/** Annual entitlements (days) used for balance UI. */
export const LEAVE_ENTITLEMENTS: Record<LeaveType, number> = {
  CASUAL: 12,
  SICK: 8,
  EARNED: 15,
  UNPAID: 30,
  COMP_OFF: 6,
};

export function countLeaveDays(fromDate: string, toDate: string): number {
  const a = new Date(fromDate + "T00:00:00");
  const b = new Date(toDate + "T00:00:00");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86400000) + 1;
}
