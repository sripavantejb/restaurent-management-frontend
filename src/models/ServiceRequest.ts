import mongoose, { Schema, models, model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IServiceRequest {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  tableId: mongoose.Types.ObjectId;
  type: "WAITER" | "WATER" | "CUTLERY" | "BILL";
  status: "OPEN" | "ACKNOWLEDGED" | "DONE";
  createdAt: Date;
  acknowledgedAt?: Date | null;
  acknowledgedBy?: mongoose.Types.ObjectId | null;
}

const ServiceRequestSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "TableSession", required: true },
    tableId: { type: Schema.Types.ObjectId, ref: "Table", required: true },
    type: {
      type: String,
      enum: ["WAITER", "WATER", "CUTLERY", "BILL"],
      required: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "ACKNOWLEDGED", "DONE"],
      default: "OPEN",
    },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

ServiceRequestSchema.plugin(tenantPlugin);
ServiceRequestSchema.index({
  restaurantId: 1,
  branchId: 1,
  status: 1,
  createdAt: -1,
});

export const ServiceRequest =
  models.ServiceRequest ||
  model<IServiceRequest>("ServiceRequest", ServiceRequestSchema);
