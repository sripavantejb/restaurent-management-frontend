import { InventoryItem } from "@/models/InventoryItem";
import { StockMovement } from "@/models/StockMovement";
import { Order } from "@/models/Order";
import { withAuth, json } from "@/lib/api";
import { getExpirySummary } from "@/lib/inventory-engine";

export const GET = withAuth(async ({ tenant, user }) => {
  const canFinance = user.permissions.includes("inventory.finance");

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const monthStart = new Date(start);
  monthStart.setDate(1);

  const [items, wasteMoves, saleMoves, expiry, monthOrders] = await Promise.all([
    InventoryItem.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      isActive: true,
    }).lean(),
    StockMovement.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      type: "WASTE",
      createdAt: { $gte: monthStart },
    }).lean(),
    StockMovement.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      type: "SALE",
      createdAt: { $gte: start },
    }).lean(),
    getExpirySummary({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    }),
    Order.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      status: "COMPLETED",
      completedAt: { $gte: start },
    })
      .select("total")
      .lean(),
  ]);

  const inventoryValue = items.reduce(
    (s, i) => s + Math.round(i.quantityOnHand * i.costPerUnit),
    0
  );
  const lowStock = items.filter((i) => i.quantityOnHand <= i.reorderLevel);

  const wasteCost = wasteMoves.reduce(
    (s, m) => s + Math.round(Math.abs(m.quantity) * (m.unitCostPaise || 0)),
    0
  );
  const consumptionCost = saleMoves.reduce(
    (s, m) => s + Math.round(Math.abs(m.quantity) * (m.unitCostPaise || 0)),
    0
  );
  const revenue = monthOrders.reduce((s, o) => s + o.total, 0);
  const foodCostPct =
    revenue > 0 ? Math.round((consumptionCost / revenue) * 1000) / 10 : 0;
  const grossMarginPct =
    revenue > 0
      ? Math.round(((revenue - consumptionCost) / revenue) * 1000) / 10
      : 0;

  const byItem = new Map<string, number>();
  for (const m of saleMoves) {
    const id = m.inventoryItemId.toString();
    byItem.set(id, (byItem.get(id) ?? 0) + Math.abs(m.quantity));
  }
  const topIngredients = [...byItem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, qty]) => {
      const item = items.find((i) => i._id.toString() === id);
      return { name: item?.name ?? id, qty, unit: item?.unit ?? "" };
    });

  const suggestions: string[] = [];
  if (lowStock.length) {
    suggestions.push(
      `Low stock on ${lowStock.length} SKUs — create a purchase request.`
    );
  }
  if (expiry.counts.expired > 0) {
    suggestions.push(
      `${expiry.counts.expired} expired batches — write off as waste.`
    );
  }
  if (expiry.counts.within3Days > 0) {
    suggestions.push(
      `${expiry.counts.within3Days} batches expire within 3 days — promote dishes using them.`
    );
  }
  if (wasteCost > consumptionCost * 0.15 && consumptionCost > 0) {
    suggestions.push("High waste vs consumption — review prep / portioning.");
  }
  if (!suggestions.length) {
    suggestions.push("Inventory looks healthy. Keep FIFO receiving with expiry dates.");
  }

  return json({
    kpis: {
      inventoryValuePaise: inventoryValue,
      lowStockCount: lowStock.length,
      skuCount: items.length,
      dailyConsumptionCostPaise: consumptionCost,
      monthlyWasteCostPaise: wasteCost,
      ...(canFinance
        ? {
            foodCostPct,
            grossMarginPct,
            revenuePaise: revenue,
            profitPaise: revenue - consumptionCost,
          }
        : {}),
    },
    expiry: expiry.counts,
    topIngredients,
    suggestions,
    charts: {
      stockValue: items
        .map((i) => ({
          x: i.name,
          y: Math.round((i.quantityOnHand * i.costPerUnit) / 100),
        }))
        .sort((a, b) => b.y - a.y)
        .slice(0, 10),
      wasteByReason: Object.entries(
        wasteMoves.reduce(
          (acc, m) => {
            const r = m.wasteReason || "OTHER";
            acc[r] = (acc[r] ?? 0) + Math.abs(m.quantity);
            return acc;
          },
          {} as Record<string, number>
        )
      ).map(([x, y]) => ({ x, y })),
    },
  });
}, "inventory.view");
