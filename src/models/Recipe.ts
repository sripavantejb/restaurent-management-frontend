import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export interface IRecipeLine {
  inventoryItemId: mongoose.Types.ObjectId;
  qtyPerServe: number;
}

export interface IRecipe {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  menuItemId: mongoose.Types.ObjectId;
  lines: IRecipeLine[];
}

const RecipeSchema = new Schema(
  {
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
      index: true,
    },
    lines: {
      type: [
        {
          inventoryItemId: {
            type: Schema.Types.ObjectId,
            ref: "InventoryItem",
            required: true,
          },
          qtyPerServe: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

RecipeSchema.plugin(tenantPlugin);
RecipeSchema.index(
  { restaurantId: 1, branchId: 1, menuItemId: 1 },
  { unique: true }
);

export const Recipe: Model<IRecipe> =
  (models.Recipe as Model<IRecipe>) || model<IRecipe>("Recipe", RecipeSchema);
