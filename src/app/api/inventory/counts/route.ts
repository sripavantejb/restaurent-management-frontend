import { z } from "zod";
import { StockCount } from "@/models/StockCount";
import { InventoryItem } from "@/models/InventoryItem";
import { withAuth, json, error } from "@/lib/api";
import { receiveStock, consumeFifo } from "@/lib/inventory-engine";
import { writeAudit } from "@/lib/audit";

function seq() {
  return `CNT-${Date.now().toString(36).toUpperCase()}`;
}

export const GET = withAuth(async ({ tenant }) => {
  const counts = await StockCount.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  return json({
    counts: counts.map((c) => ({
      id: c._id.toString(),
      countNumber: c.countNumber,
      status: c.status,
      cycle: c.cycle,
      notes: c.notes,
      lineCount: c.lines.length,
      varianceTotal: c.lines.reduce((s, l) => s + Math.abs(l.variance), 0),
      createdAt: (c as { createdAt?: Date }).createdAt,
      reconciledAt: c.reconciledAt,
    })),
  });
}, "inventory.view");

const CreateSchema = z.object({
  action: z.literal("create"),
  cycle: z.boolean().optional().default(false),
  notes: z.string().optional().default(""),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        countedQty: z.number().nonnegative(),
      })
    )
    .min(1),
});

const ReconcileSchema = z.object({
  action: z.literal("reconcile"),
  countId: z.string().min(1),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const raw = await req.json();

    if (raw.action === "create") {
      const body = CreateSchema.parse(raw);
      const lines = [];
      for (const line of body.lines) {
        const item = await InventoryItem.findOne({
          _id: line.inventoryItemId,
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
        });
        if (!item) continue;
        const variance = line.countedQty - item.quantityOnHand;
        lines.push({
          inventoryItemId: item._id,
          systemQty: item.quantityOnHand,
          countedQty: line.countedQty,
          variance,
        });
      }
      if (!lines.length) return error("No valid lines", 400);

      const count = await StockCount.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        countNumber: seq(),
        status: "OPEN",
        cycle: body.cycle,
        notes: body.notes,
        lines,
        createdBy: tenant.userId,
      });

      return json(
        { id: count._id.toString(), countNumber: count.countNumber },
        201
      );
    }

    if (raw.action === "reconcile") {
      const body = ReconcileSchema.parse(raw);
      const count = await StockCount.findOne({
        _id: body.countId,
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        status: "OPEN",
      });
      if (!count) return error("Count not found", 404);

      for (const line of count.lines) {
        if (line.variance === 0) continue;
        if (line.variance > 0) {
          await receiveStock({
            restaurantId: tenant.restaurantId,
            branchId: tenant.branchId,
            inventoryItemId: line.inventoryItemId,
            qty: line.variance,
            unitCostPaise: 0,
            note: `Count reconcile ${count.countNumber}`,
            reference: count.countNumber,
            createdBy: tenant.userId,
          });
        } else {
          await consumeFifo({
            restaurantId: tenant.restaurantId,
            branchId: tenant.branchId,
            inventoryItemId: line.inventoryItemId,
            qty: -line.variance,
            type: "COUNT",
            note: `Count reconcile ${count.countNumber}`,
            reference: count.countNumber,
            createdBy: tenant.userId,
          });
        }
      }

      count.status = "RECONCILED";
      count.reconciledAt = new Date();
      await count.save();

      await writeAudit({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        actorId: tenant.userId,
        actorType: "USER",
        action: "stock.count.reconcile",
        entityType: "StockCount",
        entityId: count._id.toString(),
      });

      return json({ id: count._id.toString(), status: count.status });
    }

    return error("Unknown action", 400);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid count", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "inventory.edit");
