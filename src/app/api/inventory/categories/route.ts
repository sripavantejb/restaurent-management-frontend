import { z } from "zod";
import { InventoryCategory } from "@/models/InventoryCategory";
import { withAuth, json, error } from "@/lib/api";

export const GET = withAuth(async ({ tenant }) => {
  const cats = await InventoryCategory.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    isActive: true,
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const parents = cats.filter((c) => !c.parentId);
  const children = cats.filter((c) => c.parentId);

  return json({
    categories: parents.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      subcategories: children
        .filter((c) => c.parentId?.toString() === p._id.toString())
        .map((c) => ({ id: c._id.toString(), name: c.name })),
    })),
    flat: cats.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      parentId: c.parentId?.toString() ?? null,
    })),
  });
}, "inventory.view");

const Body = z.object({
  name: z.string().min(1),
  parentId: z.string().optional().nullable(),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = Body.parse(await req.json());
    const cat = await InventoryCategory.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      name: body.name,
      parentId: body.parentId || null,
    });
    return json(
      {
        id: cat._id.toString(),
        name: cat.name,
        parentId: cat.parentId?.toString() ?? null,
      },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid category", 400);
    throw err;
  }
}, "inventory.edit");
