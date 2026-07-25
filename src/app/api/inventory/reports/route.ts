import { z } from "zod";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { InventoryItem } from "@/models/InventoryItem";
import { Warehouse } from "@/models/Warehouse";
import { SupplierPriceHistory } from "@/models/SupplierPriceHistory";
import { Supplier } from "@/models/Supplier";
import { withAuth, json, error } from "@/lib/api";
import { returnToSupplier, ensureDefaultWarehouse } from "@/lib/inventory-engine";
import { writeAudit } from "@/lib/audit";

/** Dead stock, overstock, price history, supplier compare, CSV export, warehouses, returns, labels */
export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const report = url.searchParams.get("report") || "summary";

  if (report === "warehouses") {
    await ensureDefaultWarehouse({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    const list = await Warehouse.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();
    return json({
      warehouses: list.map((w) => ({
        id: w._id.toString(),
        name: w.name,
        code: w.code,
        isDefault: w.isDefault,
      })),
    });
  }

  const items = await InventoryItem.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    isActive: true,
  }).lean();

  const now = Date.now();
  const deadDays = Number(url.searchParams.get("deadDays")) || 30;
  const deadCutoff = new Date(now - deadDays * 86400000);

  if (report === "dead") {
    const dead = items.filter(
      (i) =>
        i.quantityOnHand > 0 &&
        (!i.lastMovementAt || i.lastMovementAt < deadCutoff)
    );
    return json({
      deadStock: dead.map((i) => ({
        id: i._id.toString(),
        name: i.name,
        qty: i.quantityOnHand,
        unit: i.unit,
        valuePaise: Math.round(i.quantityOnHand * i.costPerUnit),
        lastMovementAt: i.lastMovementAt,
      })),
    });
  }

  if (report === "overstock") {
    const over = items.filter(
      (i) => i.maxStock > 0 && i.quantityOnHand > i.maxStock
    );
    return json({
      overstock: over.map((i) => ({
        id: i._id.toString(),
        name: i.name,
        qty: i.quantityOnHand,
        maxStock: i.maxStock,
        unit: i.unit,
        excess: i.quantityOnHand - i.maxStock,
      })),
    });
  }

  if (report === "labels") {
    return json({
      labels: items.map((i) => ({
        id: i._id.toString(),
        name: i.name,
        sku: i.sku,
        barcode: i.barcode || i.sku,
        qrPayload: i.qrPayload || `ros:inv:${i._id.toString()}`,
        unit: i.unit,
        category: i.category,
        brand: i.brand,
      })),
    });
  }

  if (report === "export") {
    const header = [
      "name",
      "sku",
      "barcode",
      "category",
      "subcategory",
      "brand",
      "unit",
      "qty",
      "reorder",
      "max",
      "costPaise",
      "valuePaise",
      "costingMethod",
    ];
    const rows = items.map((i) =>
      [
        i.name,
        i.sku,
        i.barcode,
        i.category,
        i.subcategory,
        i.brand,
        i.unit,
        i.quantityOnHand,
        i.reorderLevel,
        i.maxStock,
        i.costPerUnit,
        Math.round(i.quantityOnHand * i.costPerUnit),
        i.costingMethod,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="inventory.csv"',
      },
    });
  }

  if (report === "prices") {
    const itemId = url.searchParams.get("itemId");
    const filter: Record<string, unknown> = {
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    };
    if (itemId) filter.inventoryItemId = itemId;
    const history = await SupplierPriceHistory.find(filter)
      .sort({ recordedAt: -1 })
      .limit(100)
      .lean();
    const supplierIds = [
      ...new Set(history.map((h) => h.supplierId.toString())),
    ];
    const suppliers = await Supplier.find({ _id: { $in: supplierIds } })
      .select("company")
      .lean();
    const sm = new Map(suppliers.map((s) => [s._id.toString(), s.company]));
    const im = new Map(items.map((i) => [i._id.toString(), i.name]));
    return json({
      prices: history.map((h) => ({
        id: h._id.toString(),
        item: im.get(h.inventoryItemId.toString()) ?? "—",
        supplier: sm.get(h.supplierId.toString()) ?? "—",
        unitCostPaise: h.unitCostPaise,
        recordedAt: h.recordedAt,
      })),
    });
  }

  if (report === "supplierCompare") {
    const itemId = url.searchParams.get("itemId");
    if (!itemId) return error("itemId required", 400);
    const history = await SupplierPriceHistory.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      inventoryItemId: itemId,
    })
      .sort({ recordedAt: -1 })
      .limit(50)
      .lean();
    const bySupplier = new Map<
      string,
      { supplierId: string; latest: number; avg: number; samples: number[] }
    >();
    for (const h of history) {
      const id = h.supplierId.toString();
      const cur = bySupplier.get(id) ?? {
        supplierId: id,
        latest: h.unitCostPaise,
        avg: 0,
        samples: [] as number[],
      };
      if (!cur.samples.length) cur.latest = h.unitCostPaise;
      cur.samples.push(h.unitCostPaise);
      bySupplier.set(id, cur);
    }
    const suppliers = await Supplier.find({
      _id: { $in: [...bySupplier.keys()] },
    })
      .select("company rating")
      .lean();
    const sm = new Map(
      suppliers.map((s) => [
        s._id.toString(),
        { company: s.company, rating: s.rating },
      ])
    );
    return json({
      comparison: [...bySupplier.values()].map((v) => ({
        supplier: sm.get(v.supplierId)?.company ?? "—",
        rating: sm.get(v.supplierId)?.rating ?? null,
        latestPaise: v.latest,
        avgPaise: Math.round(
          v.samples.reduce((a, b) => a + b, 0) / v.samples.length
        ),
        samples: v.samples.length,
      })),
    });
  }

  // summary default
  const dead = items.filter(
    (i) =>
      i.quantityOnHand > 0 &&
      (!i.lastMovementAt || i.lastMovementAt < deadCutoff)
  ).length;
  const over = items.filter(
    (i) => i.maxStock > 0 && i.quantityOnHand > i.maxStock
  ).length;
  const low = items.filter((i) => i.quantityOnHand <= i.reorderLevel).length;

  return json({
    summary: {
      skuCount: items.length,
      lowStock: low,
      overstock: over,
      deadStock: dead,
      valuePaise: items.reduce(
        (s, i) => s + Math.round(i.quantityOnHand * i.costPerUnit),
        0
      ),
    },
  });
}, "inventory.view");

const ReturnSchema = z.object({
  action: z.literal("return"),
  inventoryItemId: z.string().min(1),
  qty: z.number().positive(),
  supplierId: z.string().optional().nullable(),
  note: z.string().optional().default("Purchase return"),
});

const WarehouseSchema = z.object({
  action: z.literal("warehouse"),
  name: z.string().min(1),
  code: z.string().min(1),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const raw = await req.json();
    if (raw.action === "return") {
      const body = ReturnSchema.parse(raw);
      await returnToSupplier({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        inventoryItemId: new Types.ObjectId(body.inventoryItemId),
        qty: body.qty,
        supplierId: body.supplierId
          ? new Types.ObjectId(body.supplierId)
          : null,
        note: body.note,
        createdBy: tenant.userId,
      });
      await writeAudit({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        actorId: tenant.userId,
        actorType: "USER",
        action: "inventory.return",
        entityType: "InventoryItem",
        entityId: body.inventoryItemId,
        meta: { qty: body.qty },
      });
      return json({ ok: true });
    }
    if (raw.action === "warehouse") {
      const body = WarehouseSchema.parse(raw);
      const wh = await Warehouse.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        name: body.name,
        code: body.code.toUpperCase(),
        isDefault: false,
      });
      return json({ id: wh._id.toString(), name: wh.name }, 201);
    }
    return error("Unknown action", 400);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "inventory.edit");
