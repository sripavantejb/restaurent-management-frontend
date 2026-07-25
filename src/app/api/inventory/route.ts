import { z } from "zod";
import { InventoryItem } from "@/models/InventoryItem";
import { withAuth, json, error } from "@/lib/api";
import { receiveStock } from "@/lib/inventory-engine";

const CreateSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional().default(""),
  barcode: z.string().optional().default(""),
  category: z.string().optional().default("General"),
  subcategory: z.string().optional().default(""),
  brand: z.string().optional().default(""),
  imageUrl: z.string().optional().default(""),
  unit: z
    .enum([
      "KG",
      "G",
      "L",
      "ML",
      "PCS",
      "BOX",
      "CARTON",
      "BOTTLE",
      "PACK",
      "DOZEN",
    ])
    .optional()
    .default("KG"),
  quantityOnHand: z.number().nonnegative().optional().default(0),
  reorderLevel: z.number().nonnegative().optional().default(0),
  maxStock: z.number().nonnegative().optional().default(0),
  costPerUnit: z.number().int().nonnegative().optional().default(0),
  costingMethod: z.enum(["FIFO", "LIFO", "AVG"]).optional().default("FIFO"),
  expiryDate: z.string().optional().nullable(),
});

export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const lowOnly = url.searchParams.get("lowStock") === "1";

  const items = await InventoryItem.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    isActive: true,
  })
    .sort({ name: 1 })
    .lean();

  const mapped = items.map((i) => ({
    id: i._id.toString(),
    name: i.name,
    sku: i.sku,
    barcode: i.barcode || "",
    qrPayload: i.qrPayload || `ros:inv:${i._id.toString()}`,
    category: i.category || "General",
    subcategory: i.subcategory || "",
    brand: i.brand || "",
    imageUrl: i.imageUrl || "",
    unit: i.unit,
    quantityOnHand: i.quantityOnHand,
    reorderLevel: i.reorderLevel,
    maxStock: i.maxStock || 0,
    costPerUnit: i.costPerUnit,
    costingMethod: i.costingMethod || "FIFO",
    valuePaise: Math.round(i.quantityOnHand * i.costPerUnit),
    lowStock: i.quantityOnHand <= i.reorderLevel,
    overstock: i.maxStock > 0 && i.quantityOnHand > i.maxStock,
    lastMovementAt: i.lastMovementAt,
  }));

  const valuePaise = mapped.reduce((s, i) => s + i.valuePaise, 0);

  return json({
    items: lowOnly ? mapped.filter((i) => i.lowStock) : mapped,
    lowStockCount: mapped.filter((i) => i.lowStock).length,
    inventoryValuePaise: valuePaise,
  });
}, "inventory.view");

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateSchema.parse(await req.json());
    const opening = body.quantityOnHand;
    const item = await InventoryItem.create({
      name: body.name,
      sku: body.sku,
      barcode: body.barcode || body.sku || "",
      qrPayload: "",
      category: body.category,
      subcategory: body.subcategory,
      brand: body.brand,
      imageUrl: body.imageUrl,
      unit: body.unit,
      quantityOnHand: 0,
      reorderLevel: body.reorderLevel,
      maxStock: body.maxStock,
      costPerUnit: body.costPerUnit,
      costingMethod: body.costingMethod,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      isActive: true,
    });

    if (opening > 0) {
      await receiveStock({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        inventoryItemId: item._id,
        qty: opening,
        unitCostPaise: body.costPerUnit,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        note: "Opening stock",
        createdBy: tenant.userId,
      });
    }

    const fresh = await InventoryItem.findById(item._id);
    return json(
      {
        id: item._id.toString(),
        name: item.name,
        unit: item.unit,
        quantityOnHand: fresh?.quantityOnHand ?? opening,
        reorderLevel: item.reorderLevel,
        costPerUnit: fresh?.costPerUnit ?? body.costPerUnit,
        lowStock:
          (fresh?.quantityOnHand ?? opening) <= item.reorderLevel,
      },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid inventory item", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "inventory.edit");
