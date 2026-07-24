import mongoose, { Schema, models, model } from "mongoose";
import type { Role } from "@/lib/rbac";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
}

const UserSchema = new Schema<IUser>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["OWNER", "MANAGER", "CASHIER", "WAITER", "CHEF"],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = models.User || model<IUser>("User", UserSchema);
