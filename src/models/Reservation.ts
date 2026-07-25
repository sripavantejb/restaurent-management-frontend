import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export const RESERVATION_STATUSES = [
  "BOOKED",
  "CONFIRMED",
  "SEATED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "WAITLIST",
] as const;

export interface IReservation {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  guestName: string;
  phone: string;
  email: string;
  partySize: number;
  tableId?: mongoose.Types.ObjectId | null;
  scheduledAt: Date;
  status: (typeof RESERVATION_STATUSES)[number];
  notes: string;
  source: string;
}

const ReservationSchema = new Schema(
  {
    guestName: { type: String, required: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    partySize: { type: Number, required: true, min: 1 },
    tableId: { type: Schema.Types.ObjectId, ref: "Table", default: null },
    scheduledAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      default: "BOOKED",
    },
    notes: { type: String, default: "" },
    source: { type: String, default: "WALK_IN" },
  },
  { timestamps: true }
);

ReservationSchema.plugin(tenantPlugin);
ReservationSchema.index({ restaurantId: 1, branchId: 1, scheduledAt: 1 });

export const Reservation: Model<IReservation> =
  (models.Reservation as Model<IReservation>) ||
  model<IReservation>("Reservation", ReservationSchema);
