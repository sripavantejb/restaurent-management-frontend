import mongoose, { Schema, models, model, type Model } from "mongoose";

export interface IPlatformAdmin {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
}

const PlatformAdminSchema = new Schema<IPlatformAdmin>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PlatformAdmin: Model<IPlatformAdmin> =
  (models.PlatformAdmin as Model<IPlatformAdmin>) ||
  model<IPlatformAdmin>("PlatformAdmin", PlatformAdminSchema);
