import { z } from "zod";
import { Recipe } from "@/models/Recipe";
import { MenuItem } from "@/models/MenuItem";
import { InventoryItem } from "@/models/InventoryItem";
import { withAuth, json, error } from "@/lib/api";

const UpsertSchema = z.object({
  menuItemId: z.string().min(1),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        qtyPerServe: z.number().positive(),
      })
    )
    .min(1),
});

export const GET = withAuth(async ({ tenant }) => {
  const [recipes, items, inventory] = await Promise.all([
    Recipe.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    }).lean(),
    MenuItem.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    })
      .select({ name: 1 })
      .lean(),
    InventoryItem.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      isActive: true,
    })
      .select({ name: 1, unit: 1 })
      .lean(),
  ]);

  const menuName = new Map(items.map((i) => [i._id.toString(), i.name]));
  const invName = new Map(
    inventory.map((i) => [i._id.toString(), { name: i.name, unit: i.unit }])
  );

  return json({
    recipes: recipes.map((r) => ({
      id: r._id.toString(),
      menuItemId: r.menuItemId.toString(),
      menuItemName: menuName.get(r.menuItemId.toString()) ?? "?",
      lines: r.lines.map((l) => {
        const inv = invName.get(l.inventoryItemId.toString());
        return {
          inventoryItemId: l.inventoryItemId.toString(),
          inventoryItemName: inv?.name ?? "?",
          unit: inv?.unit ?? "",
          qtyPerServe: l.qtyPerServe,
        };
      }),
      /** Rough recipe cost in paise (uses current costPerUnit) */
    })),
    menuItems: items.map((i) => ({
      id: i._id.toString(),
      name: i.name,
    })),
    inventoryItems: inventory.map((i) => ({
      id: i._id.toString(),
      name: i.name,
      unit: i.unit,
    })),
  });
}, "inventory.view");

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = UpsertSchema.parse(await req.json());
    const menu = await MenuItem.findOne({
      _id: body.menuItemId,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    if (!menu) return error("Menu item not found", 404);

    const recipe = await Recipe.findOneAndUpdate(
      {
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        menuItemId: body.menuItemId,
      },
      {
        $set: {
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          menuItemId: body.menuItemId,
          lines: body.lines.map((l) => ({
            inventoryItemId: l.inventoryItemId,
            qtyPerServe: l.qtyPerServe,
          })),
        },
      },
      { upsert: true, new: true }
    );

    return json({ id: recipe!._id.toString() }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid recipe", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "inventory.edit");
