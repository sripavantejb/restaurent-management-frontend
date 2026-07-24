import mongoose, { Schema, models, model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface ICustomer {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  phone: string;
  name: string;
  favouriteItemIds: mongoose.Types.ObjectId[];
  lastOrderIds: mongoose.Types.ObjectId[];
  visitCount: number;
}

const CustomerSchema = new Schema(
  {
    phone: { type: String, required: true },
    name: { type: String, default: "" },
    favouriteItemIds: [{ type: Schema.Types.ObjectId, ref: "MenuItem" }],
    lastOrderIds: [{ type: Schema.Types.ObjectId, ref: "Order" }],
    visitCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CustomerSchema.plugin(tenantPlugin);
CustomerSchema.index({ restaurantId: 1, phone: 1 }, { unique: true });

export const Customer =
  models.Customer || model<ICustomer>("Customer", CustomerSchema);
