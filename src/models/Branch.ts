import mongoose, { Schema, models, model, type Model } from "mongoose";

export interface IBranch {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  address: string;
  isActive: boolean;
}

const BranchSchema = new Schema<IBranch>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    code: { type: String, required: true },
    address: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

BranchSchema.index({ restaurantId: 1, code: 1 }, { unique: true });

export const Branch: Model<IBranch> =
  (models.Branch as Model<IBranch>) || model<IBranch>("Branch", BranchSchema);
