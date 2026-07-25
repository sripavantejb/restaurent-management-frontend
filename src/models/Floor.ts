import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";
import { softDeletePlugin } from "@/lib/soft-delete";

export interface IFloor {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  name: string;
  sortOrder: number;
  isActive: boolean;
  deletedAt?: Date | null;
}

const FloorSchema = new Schema(
  {
    name: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

FloorSchema.plugin(tenantPlugin);
FloorSchema.plugin(softDeletePlugin);

export const Floor: Model<IFloor> =
  (models.Floor as Model<IFloor>) || model<IFloor>("Floor", FloorSchema);
