import { NextRequest } from "next/server";
import { z } from "zod";
import { MenuCategory, type IMenuCategory } from "@/models/MenuCategory";
import { MenuItem, type IMenuItem } from "@/models/MenuItem";
import { withAuth, json, error } from "@/lib/api";

const CreateItemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  price: z.number().int().positive(),
  imageUrl: z.string().optional().default(""),
  isVeg: z.boolean().optional().default(true),
  prepTimeMins: z.number().int().positive().optional().default(15),
  isAvailable: z.boolean().optional().default(true),
  variants: z
    .array(z.object({ name: z.string(), priceDelta: z.number().int() }))
    .optional()
    .default([]),
  addons: z
    .array(z.object({ name: z.string(), price: z.number().int() }))
    .optional()
    .default([]),
});

export const GET = withAuth(async ({ tenant }) => {
  const [categories, items] = (await Promise.all([
    MenuCategory.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    })
      .sort({ sortOrder: 1 })
      .lean(),
    MenuItem.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    })
      .sort({ name: 1 })
      .lean(),
  ])) as unknown as [IMenuCategory[], IMenuItem[]];

  return json({
    categories: categories.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      sortOrder: c.sortOrder,
    })),
    items: items.map((i) => ({
      id: i._id.toString(),
      categoryId: i.categoryId.toString(),
      name: i.name,
      description: i.description,
      price: i.price,
      imageUrl: i.imageUrl,
      isVeg: i.isVeg,
      prepTimeMins: i.prepTimeMins,
      isAvailable: i.isAvailable,
      variants: i.variants,
      addons: i.addons,
    })),
  });
}, "menu.view");

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateItemSchema.parse(await req.json());
    const item = await MenuItem.create({
      ...body,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    return json({ id: item._id.toString() }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid menu item", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "menu.edit");
