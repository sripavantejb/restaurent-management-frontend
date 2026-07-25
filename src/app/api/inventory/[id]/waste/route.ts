import { z } from "zod";
import { InventoryItem } from "@/models/InventoryItem";
import { WASTE_REASONS } from "@/models/StockMovement";
import { withAuth, json, error, getParams } from "@/lib/api";
import { consumeFifo } from "@/lib/inventory-engine";

const WasteSchema = z.object({
  quantity: z.number().positive(),
  reason: z.enum(WASTE_REASONS).optional().default("SPOILAGE"),
  note: z.string().optional().default(""),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const { id } = getParams(req);
    if (!id) return error("Missing id", 400);
    const body = WasteSchema.parse(await req.json());

    const item = await InventoryItem.findOne({
      _id: id,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    if (!item) return error("Item not found", 404);
    if (body.quantity > item.quantityOnHand) {
      return error("Cannot waste more than on hand", 400);
    }

    await consumeFifo({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      inventoryItemId: item._id,
      qty: body.quantity,
      type: "WASTE",
      wasteReason: body.reason,
      note: body.note || body.reason,
      createdBy: tenant.userId,
    });

    const fresh = await InventoryItem.findById(item._id);
    return json({
      id: item._id.toString(),
      quantityOnHand: fresh?.quantityOnHand ?? 0,
      lowStock: (fresh?.quantityOnHand ?? 0) <= item.reorderLevel,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid wastage", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "inventory.edit");
