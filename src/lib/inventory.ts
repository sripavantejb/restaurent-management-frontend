import { Types } from "mongoose";
import { InventoryItem } from "@/models/InventoryItem";
import { Recipe } from "@/models/Recipe";
import { StockMovement } from "@/models/StockMovement";
import { MenuItem } from "@/models/MenuItem";
import type { IOrder } from "@/models/Order";
import { consumeFifo } from "@/lib/inventory-engine";

/**
 * Deduct recipe ingredients for a completed/paid order (idempotent).
 * Uses FIFO batch consumption when batches exist.
 */
export async function deductInventoryForOrder(order: IOrder) {
  if (!order?.items?.length) return;

  const existing = await StockMovement.findOne({
    restaurantId: order.restaurantId,
    branchId: order.branchId,
    orderId: order._id,
    type: "SALE",
  }).lean();
  if (existing) return;

  const menuIds = [
    ...new Set(
      order.items
        .map((i) => i.menuItemId?.toString())
        .filter(Boolean) as string[]
    ),
  ];

  const recipes = await Recipe.find({
    restaurantId: order.restaurantId,
    branchId: order.branchId,
    menuItemId: { $in: menuIds },
  }).lean();

  if (!recipes.length) return;

  const recipeByMenu = new Map(
    recipes.map((r) => [r.menuItemId.toString(), r])
  );

  /** inventoryItemId → { qty, menuNames } */
  const needed = new Map<string, { qty: number; names: string[] }>();
  for (const line of order.items) {
    const mid = line.menuItemId?.toString();
    if (!mid) continue;
    const recipe = recipeByMenu.get(mid);
    if (!recipe) continue;
    for (const rl of recipe.lines) {
      const id = rl.inventoryItemId.toString();
      const cur = needed.get(id) ?? { qty: 0, names: [] };
      cur.qty += rl.qtyPerServe * line.qty;
      if (!cur.names.includes(line.name)) cur.names.push(line.name);
      needed.set(id, cur);
    }
  }

  if (!needed.size) return;

  const touchedMenuIds = new Set<string>();

  for (const [invId, { qty, names }] of needed) {
    if (qty <= 0) continue;
    await consumeFifo({
      restaurantId: order.restaurantId,
      branchId: order.branchId,
      inventoryItemId: new Types.ObjectId(invId),
      qty,
      type: "SALE",
      note: `Order ${order.orderNumber}`,
      orderId: order._id,
      menuItemName: names.join(", "),
      reference: order.orderNumber,
    });

    for (const [mid, recipe] of recipeByMenu) {
      if (recipe.lines.some((l) => l.inventoryItemId.toString() === invId)) {
        touchedMenuIds.add(mid);
      }
    }
  }

  for (const menuItemId of touchedMenuIds) {
    const recipe = recipeByMenu.get(menuItemId);
    if (!recipe?.lines.length) continue;
    let canServe = true;
    for (const rl of recipe.lines) {
      const stock = await InventoryItem.findById(rl.inventoryItemId).lean();
      if (!stock || stock.quantityOnHand < rl.qtyPerServe) {
        canServe = false;
        break;
      }
    }
    if (!canServe) {
      await MenuItem.updateOne(
        {
          _id: new Types.ObjectId(menuItemId),
          restaurantId: order.restaurantId,
          branchId: order.branchId,
        },
        { $set: { isAvailable: false } }
      );
    }
  }
}

export async function deductInventoryForOrders(
  orders: IOrder[] | Array<{ _id: Types.ObjectId }>
) {
  const { Order } = await import("@/models/Order");
  for (const ref of orders) {
    const order =
      "items" in ref && Array.isArray((ref as IOrder).items)
        ? (ref as IOrder)
        : await Order.findById(ref._id);
    if (order && order.status === "COMPLETED") {
      await deductInventoryForOrder(order);
    }
  }
}
