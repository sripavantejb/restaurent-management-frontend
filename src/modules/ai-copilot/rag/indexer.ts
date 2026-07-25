import { Types } from "mongoose";
import { MenuItem } from "@/models/MenuItem";
import { MenuCategory } from "@/models/MenuCategory";
import { Recipe } from "@/models/Recipe";
import { InventoryItem } from "@/models/InventoryItem";
import { Restaurant } from "@/models/Restaurant";
import {
  RagDocument,
  type RagSourceType,
} from "@/models/RagDocument";
import { RagChunk } from "@/models/RagChunk";
import type { AiTenantCtx } from "../types";
import { chunkText, contentHash } from "./chunk";
import { embedTexts, embeddingsAvailable } from "./embeddings";

function tenantFilter(ctx: AiTenantCtx) {
  return {
    restaurantId: ctx.restaurantId,
    branchId: ctx.branchId,
  };
}

async function upsertDocumentChunks(input: {
  ctx: AiTenantCtx;
  sourceType: RagSourceType;
  sourceId: Types.ObjectId | null;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<{ skipped: boolean; chunks: number; documentId: string }> {
  const hash = contentHash(input.body);
  const filter: Record<string, unknown> = {
    ...tenantFilter(input.ctx),
    sourceType: input.sourceType,
  };
  if (input.sourceId) {
    filter.sourceId = input.sourceId;
  } else {
    filter.sourceId = null;
  }

  let doc = await RagDocument.findOne(filter);
  if (doc && doc.contentHash === hash && doc.status === "READY") {
    return {
      skipped: true,
      chunks: doc.chunkCount,
      documentId: doc._id.toString(),
    };
  }

  if (!doc) {
    doc = await RagDocument.create({
      ...tenantFilter(input.ctx),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      title: input.title,
      status: "INDEXING",
      contentHash: "",
      chunkCount: 0,
    });
  } else {
    doc.status = "INDEXING";
    doc.title = input.title;
    doc.errorMessage = "";
    await doc.save();
  }

  try {
    const pieces = chunkText(`${input.title}\n\n${input.body}`);
    if (!pieces.length) {
      await RagChunk.deleteMany({ documentId: doc._id });
      doc.status = "READY";
      doc.contentHash = hash;
      doc.chunkCount = 0;
      await doc.save();
      return {
        skipped: false,
        chunks: 0,
        documentId: doc._id.toString(),
      };
    }

    const embeddings = embeddingsAvailable()
      ? await embedTexts(pieces)
      : pieces.map(() => [] as number[]);

    await RagChunk.deleteMany({ documentId: doc._id });

    const rows = pieces.map((text, i) => ({
      ...tenantFilter(input.ctx),
      documentId: doc!._id,
      sourceType: input.sourceType,
      text,
      embedding: embeddings[i] ?? [],
      metadata: {
        title: input.title,
        ...(input.metadata || {}),
        sourceId: input.sourceId?.toString() ?? null,
      },
      contentHash: contentHash(text),
    }));

    if (rows.length) await RagChunk.insertMany(rows);

    doc.status = "READY";
    doc.contentHash = hash;
    doc.chunkCount = rows.length;
    doc.errorMessage = "";
    await doc.save();
    return {
      skipped: false,
      chunks: rows.length,
      documentId: doc._id.toString(),
    };
  } catch (e) {
    doc.status = "FAILED";
    doc.errorMessage = e instanceof Error ? e.message : "Index failed";
    await doc.save();
    throw e;
  }
}

async function indexMenu(ctx: AiTenantCtx) {
  const items = await MenuItem.find(tenantFilter(ctx)).lean();
  const cats = await MenuCategory.find(tenantFilter(ctx)).lean();
  const catMap = new Map(cats.map((c) => [c._id.toString(), c.name]));

  let indexed = 0;
  let skipped = 0;
  for (const item of items) {
    const cat = catMap.get(item.categoryId.toString()) || "Menu";
    const diet = item.isVeg ? "veg" : item.isEgg ? "egg" : "non-veg";
    const body = [
      `Menu item: ${item.name}`,
      `Category: ${cat}`,
      item.description ? `Description: ${item.description}` : "",
      `Price: ₹${(item.price / 100).toFixed(2)}`,
      `Diet: ${diet}`,
      `Prep time: ${item.prepTimeMins} mins`,
      item.allergens?.length
        ? `Allergens: ${item.allergens.join(", ")}`
        : "Allergens: none listed",
      item.tags?.length ? `Tags: ${item.tags.join(", ")}` : "",
      item.variants?.length
        ? `Variants: ${item.variants.map((v) => v.name).join(", ")}`
        : "",
      `Available: ${item.isAvailable ? "yes" : "no"}`,
    ]
      .filter(Boolean)
      .join("\n");

    const r = await upsertDocumentChunks({
      ctx,
      sourceType: "MENU_ITEM",
      sourceId: item._id,
      title: item.name,
      body,
      metadata: {
        category: cat,
        allergens: item.allergens,
        pricePaise: item.price,
      },
    });
    if (r.skipped) skipped += 1;
    else indexed += 1;
  }
  return { indexed, skipped, total: items.length };
}

async function indexRecipes(ctx: AiTenantCtx) {
  const recipes = await Recipe.find(tenantFilter(ctx)).lean();
  const menuIds = recipes.map((r) => r.menuItemId);
  const invIds = recipes.flatMap((r) =>
    r.lines.map((l) => l.inventoryItemId)
  );
  const [menus, invs] = await Promise.all([
    MenuItem.find({ _id: { $in: menuIds } }).lean(),
    InventoryItem.find({ _id: { $in: invIds } }).lean(),
  ]);
  const menuMap = new Map(menus.map((m) => [m._id.toString(), m]));
  const invMap = new Map(invs.map((i) => [i._id.toString(), i]));

  let indexed = 0;
  let skipped = 0;
  for (const recipe of recipes) {
    const menu = menuMap.get(recipe.menuItemId.toString());
    const title = menu ? `Recipe: ${menu.name}` : `Recipe ${recipe._id}`;
    const lines = recipe.lines
      .map((l) => {
        const inv = invMap.get(l.inventoryItemId.toString());
        const name = inv?.name || l.inventoryItemId.toString();
        const unit = inv?.unit || "";
        return `- ${name}: ${l.qtyPerServe} ${unit} per serve`;
      })
      .join("\n");
    const body = [
      title,
      menu?.description ? `Dish notes: ${menu.description}` : "",
      "Ingredients:",
      lines || "(no lines)",
    ]
      .filter(Boolean)
      .join("\n");

    const r = await upsertDocumentChunks({
      ctx,
      sourceType: "RECIPE",
      sourceId: recipe._id,
      title,
      body,
      metadata: { menuItemId: recipe.menuItemId.toString() },
    });
    if (r.skipped) skipped += 1;
    else indexed += 1;
  }
  return { indexed, skipped, total: recipes.length };
}

async function indexInventory(ctx: AiTenantCtx) {
  const items = await InventoryItem.find({
    ...tenantFilter(ctx),
    isActive: true,
  }).lean();

  let indexed = 0;
  let skipped = 0;
  for (const item of items) {
    const body = [
      `Inventory item: ${item.name}`,
      item.sku ? `SKU: ${item.sku}` : "",
      `Category: ${item.category}${item.subcategory ? ` / ${item.subcategory}` : ""}`,
      item.brand ? `Brand: ${item.brand}` : "",
      `Unit: ${item.unit}`,
      `On hand: ${item.quantityOnHand}`,
      `Reorder level: ${item.reorderLevel}`,
      `Max stock: ${item.maxStock}`,
      `Costing: ${item.costingMethod}`,
    ]
      .filter(Boolean)
      .join("\n");

    const r = await upsertDocumentChunks({
      ctx,
      sourceType: "INVENTORY",
      sourceId: item._id,
      title: item.name,
      body,
      metadata: { sku: item.sku, unit: item.unit },
    });
    if (r.skipped) skipped += 1;
    else indexed += 1;
  }
  return { indexed, skipped, total: items.length };
}

async function indexRestaurant(ctx: AiTenantCtx) {
  const r = await Restaurant.findById(ctx.restaurantId).lean();
  if (!r) return { indexed: 0, skipped: 0, total: 0 };

  const hours = (r.businessHours || [])
    .map((h) => {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const day = days[h.day] ?? `Day ${h.day}`;
      return h.closed
        ? `${day}: closed`
        : `${day}: ${h.open}–${h.close}`;
    })
    .join("\n");

  const tax = r.taxSettings;
  const receipt = r.receiptSettings;
  const body = [
    `Restaurant: ${r.name}`,
    `Slug: ${r.slug}`,
    r.address ? `Address: ${r.address}` : "",
    r.contactEmail ? `Email: ${r.contactEmail}` : "",
    r.contactPhone ? `Phone: ${r.contactPhone}` : "",
    r.gstNumber ? `GST: ${r.gstNumber}` : "",
    r.fssaiNumber ? `FSSAI: ${r.fssaiNumber}` : "",
    `Timezone: ${r.timezone}`,
    `Currency: ${r.currency}`,
    hours ? `Business hours:\n${hours}` : "",
    tax
      ? `Tax: GST ${tax.gstRate}% ${tax.mode}, cess ${tax.cessRate}%, service charge ${tax.serviceChargePct}%`
      : "",
    receipt?.footer ? `Receipt footer: ${receipt.footer}` : "",
    receipt?.thankYou ? `Thank you message: ${receipt.thankYou}` : "",
    receipt?.terms ? `Terms: ${receipt.terms}` : "",
    r.wifiSsid ? `Guest Wi‑Fi SSID: ${r.wifiSsid}` : "",
    // Intentionally omit wifi password from RAG
  ]
    .filter(Boolean)
    .join("\n");

  const result = await upsertDocumentChunks({
    ctx,
    sourceType: "RESTAURANT",
    sourceId: r._id,
    title: `${r.name} settings & policies`,
    body,
    metadata: { slug: r.slug },
  });
  return {
    indexed: result.skipped ? 0 : 1,
    skipped: result.skipped ? 1 : 0,
    total: 1,
  };
}

export interface ReindexResult {
  menu: { indexed: number; skipped: number; total: number };
  recipes: { indexed: number; skipped: number; total: number };
  inventory: { indexed: number; skipped: number; total: number };
  restaurant: { indexed: number; skipped: number; total: number };
  embeddingsEnabled: boolean;
}

/** Reindex operational sources for the current tenant/branch. Uploads are left as-is. */
export async function reindexTenantKnowledge(
  ctx: AiTenantCtx
): Promise<ReindexResult> {
  const menu = await indexMenu(ctx);
  const recipes = await indexRecipes(ctx);
  const inventory = await indexInventory(ctx);
  const restaurant = await indexRestaurant(ctx);
  return {
    menu,
    recipes,
    inventory,
    restaurant,
    embeddingsEnabled: embeddingsAvailable(),
  };
}

export { upsertDocumentChunks };
