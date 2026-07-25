import { z } from "zod";
import { InventoryItem } from "@/models/InventoryItem";
import { withAuth, json, error, getParams } from "@/lib/api";
import { receiveStock, consumeFifo } from "@/lib/inventory-engine";

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  costPerUnit: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  quantityOnHand: z.number().optional(),
  adjustBy: z.number().optional(),
  expiryDate: z.string().optional().nullable(),
  note: z.string().optional().default(""),
});

export const PATCH = withAuth(async ({ req, tenant }) => {
  try {
    const { id } = getParams(req);
    if (!id) return error("Missing id", 400);
    const body = PatchSchema.parse(await req.json());

    const item = await InventoryItem.findOne({
      _id: id,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    if (!item) return error("Item not found", 404);

    if (body.name !== undefined) item.name = body.name;
    if (body.sku !== undefined) item.sku = body.sku;
    if (body.reorderLevel !== undefined) item.reorderLevel = body.reorderLevel;
    if (body.costPerUnit !== undefined) item.costPerUnit = body.costPerUnit;
    if (body.isActive !== undefined) item.isActive = body.isActive;

    if (body.quantityOnHand !== undefined) {
      const delta = body.quantityOnHand - item.quantityOnHand;
      if (delta > 0) {
        await receiveStock({
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          inventoryItemId: item._id,
          qty: delta,
          unitCostPaise: item.costPerUnit,
          note: body.note || "Stock set (increase)",
          createdBy: tenant.userId,
        });
      } else if (delta < 0) {
        await consumeFifo({
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          inventoryItemId: item._id,
          qty: -delta,
          type: "ADJUST",
          note: body.note || "Stock set (decrease)",
          createdBy: tenant.userId,
        });
      } else {
        await item.save();
      }
    } else if (body.adjustBy !== undefined && body.adjustBy !== 0) {
      if (body.adjustBy > 0) {
        await receiveStock({
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          inventoryItemId: item._id,
          qty: body.adjustBy,
          unitCostPaise: body.costPerUnit ?? item.costPerUnit,
          expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
          note: body.note || "Received",
          createdBy: tenant.userId,
        });
      } else {
        await consumeFifo({
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          inventoryItemId: item._id,
          qty: -body.adjustBy,
          type: "OUT",
          note: body.note || "Issued",
          createdBy: tenant.userId,
        });
      }
    } else {
      await item.save();
    }

    const fresh = await InventoryItem.findById(item._id);
    return json({
      id: item._id.toString(),
      name: fresh?.name ?? item.name,
      sku: fresh?.sku ?? item.sku,
      unit: fresh?.unit ?? item.unit,
      quantityOnHand: fresh?.quantityOnHand ?? item.quantityOnHand,
      reorderLevel: fresh?.reorderLevel ?? item.reorderLevel,
      costPerUnit: fresh?.costPerUnit ?? item.costPerUnit,
      lowStock:
        (fresh?.quantityOnHand ?? 0) <=
        (fresh?.reorderLevel ?? item.reorderLevel),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid update", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "inventory.edit");
