import { z } from "zod";
import { Types } from "mongoose";
import { PurchaseRequest } from "@/models/PurchaseRequest";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { Supplier } from "@/models/Supplier";
import { InventoryItem } from "@/models/InventoryItem";
import { Notification } from "@/models/Notification";
import { withAuth, json, error } from "@/lib/api";
import { receiveStock } from "@/lib/inventory-engine";
import { writeAudit } from "@/lib/audit";

function seq(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") || "all";

  const [requests, orders, suppliers, items] = await Promise.all([
    kind === "po"
      ? Promise.resolve([])
      : PurchaseRequest.find({
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
        })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
    kind === "pr"
      ? Promise.resolve([])
      : PurchaseOrder.find({
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
        })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
    Supplier.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      isActive: true,
    })
      .select("company")
      .lean(),
    InventoryItem.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      isActive: true,
    })
      .select("name unit reorderLevel quantityOnHand")
      .lean(),
  ]);

  const supMap = new Map(suppliers.map((s) => [s._id.toString(), s.company]));
  const itemMap = new Map(
    items.map((i) => [i._id.toString(), { name: i.name, unit: i.unit }])
  );

  return json({
    requests: requests.map((r) => ({
      id: r._id.toString(),
      requestNumber: r.requestNumber,
      status: r.status,
      notes: r.notes,
      lines: r.lines.map((l) => ({
        inventoryItemId: l.inventoryItemId.toString(),
        name: itemMap.get(l.inventoryItemId.toString())?.name ?? "—",
        qty: l.qty,
        unit: l.unit,
      })),
      createdAt: (r as { createdAt?: Date }).createdAt,
    })),
    orders: orders.map((o) => ({
      id: o._id.toString(),
      poNumber: o.poNumber,
      status: o.status,
      supplierId: o.supplierId.toString(),
      supplier: supMap.get(o.supplierId.toString()) ?? "—",
      invoiceNumber: o.invoiceNumber,
      invoicePaise: o.invoicePaise,
      lines: o.lines.map((l) => ({
        inventoryItemId: l.inventoryItemId.toString(),
        name: itemMap.get(l.inventoryItemId.toString())?.name ?? "—",
        qtyOrdered: l.qtyOrdered,
        qtyReceived: l.qtyReceived,
        unitCostPaise: l.unitCostPaise,
        unit: l.unit,
      })),
      createdAt: (o as { createdAt?: Date }).createdAt,
    })),
    suppliers: suppliers.map((s) => ({
      id: s._id.toString(),
      company: s.company,
    })),
    items: items.map((i) => ({
      id: i._id.toString(),
      name: i.name,
      unit: i.unit,
      quantityOnHand: i.quantityOnHand,
      reorderLevel: i.reorderLevel,
      lowStock: i.quantityOnHand <= i.reorderLevel,
    })),
  });
}, "inventory.view");

const PrSchema = z.object({
  kind: z.literal("request"),
  notes: z.string().optional().default(""),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        qty: z.number().positive(),
        unit: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .min(1),
});

const PoSchema = z.object({
  kind: z.literal("order"),
  supplierId: z.string().min(1),
  purchaseRequestId: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        qtyOrdered: z.number().positive(),
        unitCostPaise: z.number().int().nonnegative(),
        unit: z.string().optional(),
      })
    )
    .min(1),
});

const ApproveSchema = z.object({
  kind: z.literal("approve"),
  requestId: z.string().min(1),
  approve: z.boolean(),
});

const ReceiveSchema = z.object({
  kind: z.literal("receive"),
  purchaseOrderId: z.string().min(1),
  invoiceNumber: z.string().optional().default(""),
  qualityOk: z.boolean().optional().default(true),
  qualityNotes: z.string().optional().default(""),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        qty: z.number().positive(),
        expiryDate: z.string().optional().nullable(),
      })
    )
    .min(1),
});

const FromLowSchema = z.object({
  kind: z.literal("fromLowStock"),
});

export const POST = withAuth(async ({ req, tenant, user }) => {
  try {
    const raw = await req.json();
    const kind = raw.kind as string;

    if (kind === "fromLowStock") {
      FromLowSchema.parse(raw);
      const low = await InventoryItem.find({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        isActive: true,
        $expr: { $lte: ["$quantityOnHand", "$reorderLevel"] },
      });
      if (!low.length) return error("No low-stock items", 400);
      const pr = await PurchaseRequest.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        requestNumber: seq("PR"),
        status: "PENDING",
        requestedBy: tenant.userId,
        notes: "Auto from low stock",
        lines: low.map((i) => ({
          inventoryItemId: i._id,
          qty: Math.max(i.reorderLevel * 2 - i.quantityOnHand, i.reorderLevel || 1),
          unit: i.unit,
          note: "Low stock auto",
        })),
      });
      await Notification.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        role: "MANAGER",
        type: "PURCHASE_REQUEST",
        title: `PR ${pr.requestNumber} needs approval`,
        body: `${low.length} low-stock lines`,
        href: "/inventory",
      });
      return json({ id: pr._id.toString(), requestNumber: pr.requestNumber }, 201);
    }

    if (kind === "request") {
      if (!user.permissions.includes("inventory.purchase")) {
        return error("Permission denied", 403);
      }
      const body = PrSchema.parse(raw);
      const pr = await PurchaseRequest.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        requestNumber: seq("PR"),
        status: "PENDING",
        requestedBy: tenant.userId,
        notes: body.notes,
        lines: body.lines.map((l) => ({
          inventoryItemId: new Types.ObjectId(l.inventoryItemId),
          qty: l.qty,
          unit: l.unit || "KG",
          note: l.note || "",
        })),
      });
      return json({ id: pr._id.toString(), requestNumber: pr.requestNumber }, 201);
    }

    if (kind === "approve") {
      if (!user.permissions.includes("inventory.approve")) {
        return error("Permission denied", 403);
      }
      const body = ApproveSchema.parse(raw);
      const pr = await PurchaseRequest.findOne({
        _id: body.requestId,
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
      });
      if (!pr) return error("Request not found", 404);
      pr.status = body.approve ? "APPROVED" : "REJECTED";
      pr.approvedBy = tenant.userId;
      await pr.save();
      await Notification.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        type: "PURCHASE_APPROVED",
        title: `PR ${pr.requestNumber} ${pr.status}`,
        body: body.approve ? "Ready to create PO" : "Rejected",
        href: "/inventory",
      });
      return json({ id: pr._id.toString(), status: pr.status });
    }

    if (kind === "order") {
      if (!user.permissions.includes("inventory.purchase")) {
        return error("Permission denied", 403);
      }
      const body = PoSchema.parse(raw);
      const po = await PurchaseOrder.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        supplierId: body.supplierId,
        purchaseRequestId: body.purchaseRequestId || null,
        poNumber: seq("PO"),
        status: "SENT",
        createdBy: tenant.userId,
        lines: body.lines.map((l) => ({
          inventoryItemId: new Types.ObjectId(l.inventoryItemId),
          qtyOrdered: l.qtyOrdered,
          qtyReceived: 0,
          unitCostPaise: l.unitCostPaise,
          unit: l.unit || "KG",
        })),
        invoicePaise: body.lines.reduce(
          (s, l) => s + Math.round(l.qtyOrdered * l.unitCostPaise),
          0
        ),
      });
      if (body.purchaseRequestId) {
        await PurchaseRequest.updateOne(
          { _id: body.purchaseRequestId },
          { $set: { status: "ORDERED" } }
        );
      }
      return json({ id: po._id.toString(), poNumber: po.poNumber }, 201);
    }

    if (kind === "receive") {
      if (!user.permissions.includes("inventory.edit")) {
        return error("Permission denied", 403);
      }
      const body = ReceiveSchema.parse(raw);
      if (body.qualityOk === false) {
        return error(
          "Quality check failed — reject delivery or return to supplier",
          400,
          body.qualityNotes || "Mark qualityOk true after inspection"
        );
      }
      const po = await PurchaseOrder.findOne({
        _id: body.purchaseOrderId,
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
      });
      if (!po) return error("PO not found", 404);

      for (const line of body.lines) {
        const poLine = po.lines.find(
          (l) => l.inventoryItemId.toString() === line.inventoryItemId
        );
        const unitCost = poLine?.unitCostPaise ?? 0;
        await receiveStock({
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          inventoryItemId: new Types.ObjectId(line.inventoryItemId),
          qty: line.qty,
          unitCostPaise: unitCost,
          supplierId: po.supplierId,
          purchaseOrderId: po._id,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
          note: `GRN ${po.poNumber} (QC OK${body.qualityNotes ? `: ${body.qualityNotes}` : ""})`,
          reference: po.poNumber,
          createdBy: tenant.userId,
        });
        if (poLine) poLine.qtyReceived += line.qty;
      }

      const allReceived = po.lines.every((l) => l.qtyReceived >= l.qtyOrdered);
      const anyReceived = po.lines.some((l) => l.qtyReceived > 0);
      po.status = allReceived ? "RECEIVED" : anyReceived ? "PARTIAL" : po.status;
      po.invoiceNumber = body.invoiceNumber || po.invoiceNumber;
      if (allReceived) po.receivedAt = new Date();
      await po.save();

      await Supplier.updateOne(
        { _id: po.supplierId },
        { $set: { lastPurchaseAt: new Date() } }
      );

      await Notification.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        type: "GOODS_RECEIVED",
        title: `Goods received · ${po.poNumber}`,
        body: po.status,
        href: "/inventory",
      });

      await writeAudit({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        actorId: tenant.userId,
        actorType: "USER",
        action: "purchase.receive",
        entityType: "PurchaseOrder",
        entityId: po._id.toString(),
        after: { status: po.status },
      });

      return json({ id: po._id.toString(), status: po.status });
    }

    return error("Unknown kind", 400);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid purchase payload", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "inventory.view");
