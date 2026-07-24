import { z } from "zod";
import { MenuItem } from "@/models/MenuItem";
import { withAuth, json, error, getParams } from "@/lib/api";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().int().positive().optional(),
  isVeg: z.boolean().optional(),
  prepTimeMins: z.number().int().positive().optional(),
  isAvailable: z.boolean().optional(),
  categoryId: z.string().optional(),
  variants: z
    .array(z.object({ name: z.string(), priceDelta: z.number().int() }))
    .optional(),
  addons: z
    .array(z.object({ name: z.string(), price: z.number().int() }))
    .optional(),
});

export const PATCH = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing item id", 400);

  try {
    const body = UpdateSchema.parse(await req.json());
    const item = await MenuItem.findOneAndUpdate(
      {
        _id: id,
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
      },
      { $set: body },
      { new: true }
    );
    if (!item) return error("Menu item not found", 404);
    return json({
      id: item._id.toString(),
      isAvailable: item.isAvailable,
      name: item.name,
      price: item.price,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid update", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "menu.edit");
