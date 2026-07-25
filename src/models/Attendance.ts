import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IAttendance {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: string;
  checkInAt?: Date | null;
  checkOutAt?: Date | null;
  status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
  notes: string;
}

const AttendanceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: { type: String, required: true, index: true },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["PRESENT", "ABSENT", "LATE", "LEAVE"],
      default: "PRESENT",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

AttendanceSchema.plugin(tenantPlugin);
AttendanceSchema.index(
  { restaurantId: 1, branchId: 1, userId: 1, date: 1 },
  { unique: true }
);

export const Attendance: Model<IAttendance> =
  (models.Attendance as Model<IAttendance>) ||
  model<IAttendance>("Attendance", AttendanceSchema);
