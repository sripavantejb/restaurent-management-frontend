/**
 * Deterministic intent router when OPENAI_API_KEY is missing.
 * Maps natural language → tool names (no LLM, no Mongo from this layer).
 */
export function detectIntentTools(message: string): string[] {
  const q = message.toLowerCase();
  const tools: string[] = [];

  const push = (name: string) => {
    if (!tools.includes(name)) tools.push(name);
  };

  if (/insight|overview|how.*(business|doing)|snapshot/.test(q)) {
    push("getAiInsights");
  }
  if (/today.*sales|sales.*today|revenue.*today|how much.*(sold|made)/.test(q)) {
    push("getTodaySales");
  }
  if (/yesterday/.test(q) && /sales|revenue/.test(q)) push("getYesterdaySales");
  if (/week|7 day/.test(q) && /sales|revenue/.test(q)) push("getWeeklySales");
  if (/month|30 day/.test(q) && /sales|revenue/.test(q)) push("getMonthlySales");
  if (/year|365/.test(q) && /sales|revenue/.test(q)) push("getYearlySales");
  if (/top.?sell|best.?sell|popular/.test(q)) push("getTopSellingItems");
  if (/least.?sell|worst.?sell|slow.?mov/.test(q)) push("getLeastSellingItems");
  if (/peak.?hour|busy.?hour|hourly/.test(q)) push("getPeakHours");
  if (/aov|average.?order/.test(q)) push("getAverageOrderValue");
  if (/profit/.test(q)) push("getProfit");
  if (/gst|cgst|sgst|tax/.test(q)) push("getGSTCollected");
  if (/cash.?flow|upi|payment.?mix/.test(q)) push("getCashFlow");

  if (/pending.?order|kitchen.?queue|in.?kitchen/.test(q)) {
    push("getKitchenQueue");
    push("getPendingOrders");
  }
  if (/delayed/.test(q)) push("getDelayedOrders");
  if (/prep.?time|cook.?time/.test(q)) push("getAveragePreparationTime");
  if (/cancel/.test(q) && /order/.test(q)) push("getCancelledOrders");
  if (/order/.test(q) && /today/.test(q)) push("getOrdersToday");

  if (/occup|table.?status|floor/.test(q)) push("getTableStatus");
  if (/occupied/.test(q)) push("getOccupiedTables");
  if (/available.?table|free.?table/.test(q)) push("getAvailableTables");
  if (/cleaning/.test(q)) push("getCleaningTables");
  if (/reserved.?table/.test(q)) push("getReservedTables");

  if (/low.?stock|reorder/.test(q)) push("getLowStockItems");
  if (/inventory.?value|stock.?value/.test(q)) push("getInventoryValue");
  if (/current.?stock|inventory(?!.*value)/.test(q)) push("getCurrentStock");
  if (/consump/.test(q)) push("getIngredientConsumption");

  if (/forecast|predict|tomorrow/.test(q)) push("forecastTomorrowSales");
  if (/weekend/.test(q) && /forecast|sales/.test(q)) push("forecastWeekendSales");
  if (/staff/.test(q) && /need|forecast|suggest/.test(q)) push("forecastStaff");

  if (/purchase|po\b|replenish/.test(q)) push("suggestPurchaseOrder");
  if (/sales.?report/.test(q)) push("generateSalesReport");
  if (/gst.?report/.test(q)) push("generateGSTReport");
  if (/inventory.?report/.test(q)) push("generateInventoryReport");

  if (tools.length === 0) {
    push("getAiInsights");
    push("getTodaySales");
  }

  return tools.slice(0, 4);
}
