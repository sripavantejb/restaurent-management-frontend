import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";
import { softDeletePlugin } from "@/lib/soft-delete";

export interface ISection {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  floorId: mongoose.Types.ObjectId;
  name: string;
  sortOrder: number;
  color: string;
  isActive: boolean;
  deletedAt?: Date | null;
}

const SectionSchema = new Schema(
  {
    floorId: {
      type: Schema.Types.ObjectId,
      ref: "Floor",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    color: { type: String, default: "#2A9D8F" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SectionSchema.plugin(tenantPlugin);
SectionSchema.plugin(softDeletePlugin);

export const Section: Model<ISection> =
  (models.Section as Model<ISection>) ||
  model<ISection>("Section", SectionSchema);
