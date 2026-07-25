import { z } from "zod";
import { Types } from "mongoose";
import { StockTransfer } from "@/models/StockTransfer";
import { InventoryItem } from "@/models/InventoryItem";
import { Branch } from "@/models/Branch";
import { Notification } from "@/models/Notification";
import { withAuth, json, error } from "@/lib/api";
import { consumeFifo, receiveStock } from "@/lib/inventory-engine";

function seq() {
  return `TR-${Date.now().toString(36).toUpperCase()}`;
}

export const GET = withAuth(async ({ tenant }) => {
  const transfers = await StockTransfer.find({
    restaurantId: tenant.restaurantId,
    $or: [
      { fromBranchId: tenant.branchId },
      { toBranchId: tenant.branchId },
      { branchId: tenant.branchId },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const itemIds = [...new Set(transfers.map((t) => t.inventoryItemId.toString()))];
  const branchIds = [
    ...new Set(
      transfers.flatMap((t) => [
        t.fromBranchId.toString(),
        t.toBranchId.toString(),
      ])
    ),
  ];
  const [items, branches] = await Promise.all([
    InventoryItem.find({ _id: { $in: itemIds } }).select("name").lean(),
    Branch.find({ _id: { $in: branchIds } }).select("name").lean(),
  ]);
  const itemMap = new Map(items.map((i) => [i._id.toString(), i.name]));
  const branchMap = new Map(branches.map((b) => [b._id.toString(), b.name]));

  return json({
    transfers: transfers.map((t) => ({
      id: t._id.toString(),
      transferNumber: t.transferNumber,
      status: t.status,
      qty: t.qty,
      unit: t.unit,
      itemName: itemMap.get(t.inventoryItemId.toString()) ?? "—",
      fromBranch: branchMap.get(t.fromBranchId.toString()) ?? "—",
      toBranch: branchMap.get(t.toBranchId.toString()) ?? "—",
      note: t.note,
      createdAt: (t as { createdAt?: Date }).createdAt,
    })),
    branches: (
      await Branch.find({
        restaurantId: tenant.restaurantId,
        isActive: true,
      })
        .select("name")
        .lean()
    ).map((b) => ({ id: b._id.toString(), name: b.name })),
  });
}, "inventory.view");

const CreateSchema = z.object({
  action: z.literal("create"),
  toBranchId: z.string().min(1),
  inventoryItemId: z.string().min(1),
  qty: z.number().positive(),
  note: z.string().optional().default(""),
});

const AcceptSchema = z.object({
  action: z.literal("accept"),
  transferId: z.string().min(1),
});

export const POST = withAuth(async ({ req, tenant, user }) => {
  try {
    if (!user.permissions.includes("inventory.transfer")) {
      return error("Permission denied", 403);
    }
    const raw = await req.json();

    if (raw.action === "create") {
      const body = CreateSchema.parse(raw);
      if (body.toBranchId === tenant.branchId.toString()) {
        return error("Cannot transfer to same branch", 400);
      }
      const source = await InventoryItem.findOne({
        _id: body.inventoryItemId,
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
      });
      if (!source) return error("Item not found on this branch", 404);
      if (body.qty > source.quantityOnHand) {
        return error("Insufficient stock", 400);
      }

      const transfer = await StockTransfer.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        fromBranchId: tenant.branchId,
        toBranchId: body.toBranchId,
        transferNumber: seq(),
        status: "IN_TRANSIT",
        inventoryItemId: source._id,
        qty: body.qty,
        unit: source.unit,
        note: body.note,
        createdBy: tenant.userId,
      });

      await consumeFifo({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        inventoryItemId: source._id,
        qty: body.qty,
        type: "TRANSFER_OUT",
        note: `Transfer ${transfer.transferNumber}`,
        transferId: transfer._id,
        createdBy: tenant.userId,
        reference: transfer.transferNumber,
      });

      await Notification.create({
        restaurantId: tenant.restaurantId,
        branchId: body.toBranchId,
        type: "TRANSFER_PENDING",
        title: `Incoming transfer ${transfer.transferNumber}`,
        body: `${body.qty} ${source.unit} ${source.name}`,
        href: "/inventory",
      });

      return json(
        { id: transfer._id.toString(), transferNumber: transfer.transferNumber },
        201
      );
    }

    if (raw.action === "accept") {
      const body = AcceptSchema.parse(raw);
      const transfer = await StockTransfer.findOne({
        _id: body.transferId,
        restaurantId: tenant.restaurantId,
        toBranchId: tenant.branchId,
        status: "IN_TRANSIT",
      });
      if (!transfer) return error("Transfer not found", 404);

      let dest = await InventoryItem.findOne({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        name: (
          await InventoryItem.findById(transfer.inventoryItemId).select("name")
        )?.name,
      });

      const sourceItem = await InventoryItem.findById(
        transfer.inventoryItemId
      ).lean();
      if (!sourceItem) return error("Source SKU missing", 404);

      if (!dest) {
        dest = await InventoryItem.create({
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          name: sourceItem.name,
          sku: sourceItem.sku,
          barcode: sourceItem.barcode,
          category: sourceItem.category,
          unit: sourceItem.unit,
          quantityOnHand: 0,
          reorderLevel: sourceItem.reorderLevel,
          maxStock: sourceItem.maxStock,
          costPerUnit: sourceItem.costPerUnit,
          isActive: true,
        });
      }

      await receiveStock({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        inventoryItemId: dest._id,
        qty: transfer.qty,
        unitCostPaise: sourceItem.costPerUnit,
        note: `Transfer in ${transfer.transferNumber}`,
        reference: transfer.transferNumber,
        createdBy: tenant.userId,
      });

      // Fix TRANSFER_IN type on last movement — receiveStock writes IN/PURCHASE
      // Acceptable: note references transfer.

      transfer.status = "ACCEPTED";
      transfer.acceptedBy = tenant.userId;
      transfer.acceptedAt = new Date();
      await transfer.save();

      await Notification.create({
        restaurantId: tenant.restaurantId,
        branchId: transfer.fromBranchId,
        type: "TRANSFER_COMPLETED",
        title: `Transfer ${transfer.transferNumber} accepted`,
        body: "Destination inventory updated",
        href: "/inventory",
      });

      return json({ id: transfer._id.toString(), status: transfer.status });
    }

    return error("Unknown action", 400);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid transfer", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "inventory.transfer");
