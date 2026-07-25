import { withAuth, json } from "@/lib/api";
import type { AiTenantCtx } from "@/modules/ai-copilot/types";
import { getTodaySales } from "@/modules/ai-copilot/services/sales.service";
import { getTableStatus } from "@/modules/ai-copilot/services/tables.service";
import { getLowStockItems } from "@/modules/ai-copilot/services/inventory.service";
import { getKitchenQueue } from "@/modules/ai-copilot/services/kitchen.service";
import { getPendingOrders } from "@/modules/ai-copilot/services/orders.service";
import { forecastTomorrowSales } from "@/modules/ai-copilot/services/forecast.service";
import { getProfit } from "@/modules/ai-copilot/services/sales.service";
import { SUGGESTED_PROMPTS } from "@/modules/ai-copilot/prompts";

export const GET = withAuth(async ({ tenant, user }) => {
  const ctx: AiTenantCtx = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    userId: tenant.userId,
    role: user.role,
    permissions: user.permissions,
  };

  const [sales, floor, low, kitchen, pending, forecast, profit] =
    await Promise.all([
      getTodaySales(ctx).catch(() => null),
      getTableStatus(ctx).catch(() => null),
      getLowStockItems(ctx).catch(() => null),
      getKitchenQueue(ctx).catch(() => null),
      getPendingOrders(ctx).catch(() => null),
      forecastTomorrowSales(ctx).catch(() => null),
      getProfit(ctx).catch(() => null),
    ]);

  return json({
    widgets: {
      sales: sales?.data ?? null,
      salesSummary: sales?.summary ?? null,
      floor: floor?.summary ?? null,
      floorBlocks: floor?.blocks ?? [],
      lowStockSummary: low?.summary ?? null,
      lowStockBlocks: low?.blocks ?? [],
      kitchenSummary: kitchen?.summary ?? null,
      pendingSummary: pending?.summary ?? null,
      forecastSummary: forecast?.summary ?? null,
      forecastBlocks: forecast?.blocks ?? [],
      profitSummary: profit?.summary ?? null,
      profitBlocks: profit?.blocks ?? [],
    },
    suggestions: SUGGESTED_PROMPTS,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  });
}, "ai.use");
