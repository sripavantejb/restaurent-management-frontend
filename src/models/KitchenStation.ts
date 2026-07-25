import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IKitchenStation {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  isActive: boolean;
}

const KitchenStationSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

KitchenStationSchema.plugin(tenantPlugin);
KitchenStationSchema.index(
  { restaurantId: 1, branchId: 1, code: 1 },
  { unique: true }
);

export const KitchenStation: Model<IKitchenStation> =
  (models.KitchenStation as Model<IKitchenStation>) ||
  model<IKitchenStation>("KitchenStation", KitchenStationSchema);
