import type { AiToolDefinition } from "../types";
import * as Sales from "../services/sales.service";
import * as Orders from "../services/orders.service";
import * as Tables from "../services/tables.service";
import * as Inventory from "../services/inventory.service";
import * as Kitchen from "../services/kitchen.service";
import * as Finance from "../services/finance.service";
import * as Forecast from "../services/forecast.service";
import * as Actions from "../services/actions.service";
import * as Rag from "../rag/uploads";

const emptyParams = {
  type: "object" as const,
  properties: {},
  additionalProperties: false,
};

function tool(
  def: Omit<AiToolDefinition, "parameters"> & {
    parameters?: AiToolDefinition["parameters"];
  }
): AiToolDefinition {
  return {
    ...def,
    parameters: def.parameters ?? emptyParams,
  };
}

/** Central tool registry — LLM only sees name/description/parameters. */
export const AI_TOOLS: AiToolDefinition[] = [
  tool({
    name: "getTodaySales",
    description: "Get today's completed sales revenue, order count, AOV, tax",
    permissions: ["reports.view"],
    handler: (ctx) => Sales.getTodaySales(ctx),
  }),
  tool({
    name: "getYesterdaySales",
    description: "Yesterday's completed sales",
    permissions: ["reports.view"],
    handler: (ctx) => Sales.getYesterdaySales(ctx),
  }),
  tool({
    name: "getWeeklySales",
    description: "Sales for the last 7 days",
    permissions: ["reports.view"],
    handler: (ctx) => Sales.getWeeklySales(ctx),
  }),
  tool({
    name: "getMonthlySales",
    description: "Sales for the last 30 days",
    permissions: ["reports.view"],
    handler: (ctx) => Sales.getMonthlySales(ctx),
  }),
  tool({
    name: "getYearlySales",
    description: "Sales for the last 365 days",
    permissions: ["reports.view"],
    handler: (ctx) => Sales.getYearlySales(ctx),
  }),
  tool({
    name: "getSalesBetweenDates",
    description: "Sales between from and to ISO dates",
    permissions: ["reports.view"],
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "ISO date" },
        to: { type: "string", description: "ISO date" },
      },
      required: ["from", "to"],
    },
    handler: (ctx, args) => Sales.getSalesBetweenDates(ctx, args),
  }),
  tool({
    name: "getRevenue",
    description: "Alias for today's revenue",
    permissions: ["reports.view"],
    handler: (ctx) => Sales.getRevenue(ctx),
  }),
  tool({
    name: "getProfit",
    description: "Estimated profit today (COGS heuristic)",
    permissions: ["reports.view"],
    handler: (ctx) => Sales.getProfit(ctx),
  }),
  tool({
    name: "getLoss",
    description: "Loss check for today",
    permissions: ["reports.view"],
    handler: (ctx) => Sales.getLoss(ctx),
  }),
  tool({
    name: "getAverageOrderValue",
    description: "Today's average order value",
    permissions: ["reports.view"],
    handler: (ctx) => Sales.getAverageOrderValue(ctx),
  }),
  tool({
    name: "getTopSellingItems",
    description: "Top selling menu items",
    permissions: ["reports.view"],
    parameters: {
      type: "object",
      properties: {
        days: { type: "number" },
        limit: { type: "number" },
      },
    },
    handler: (ctx, args) => Sales.getTopSellingItems(ctx, args),
  }),
  tool({
    name: "getLeastSellingItems",
    description: "Least selling menu items",
    permissions: ["reports.view"],
    parameters: {
      type: "object",
      properties: {
        days: { type: "number" },
        limit: { type: "number" },
      },
    },
    handler: (ctx, args) => Sales.getLeastSellingItems(ctx, args),
  }),
  tool({
    name: "getPeakHours",
    description: "Peak sales hours today",
    permissions: ["reports.view"],
    handler: (ctx) => Sales.getPeakHours(ctx),
  }),
  tool({
    name: "getHourlySales",
    description: "Hourly sales breakdown today",
    permissions: ["reports.view"],
    handler: (ctx) => Sales.getPeakHours(ctx),
  }),

  tool({
    name: "getOrdersToday",
    description: "List orders placed today",
    permissions: ["orders.view"],
    handler: (ctx) => Orders.getOrdersToday(ctx),
  }),
  tool({
    name: "getPendingOrders",
    description: "Orders still PLACED or PREPARING",
    permissions: ["orders.view"],
    handler: (ctx) => Orders.getPendingOrders(ctx),
  }),
  tool({
    name: "getCancelledOrders",
    description: "Cancelled orders today",
    permissions: ["orders.view"],
    handler: (ctx) => Orders.getCancelledOrders(ctx),
  }),
  tool({
    name: "getCompletedOrders",
    description: "Completed orders today",
    permissions: ["orders.view"],
    handler: (ctx) => Orders.getCompletedOrders(ctx),
  }),
  tool({
    name: "getAveragePreparationTime",
    description: "Average kitchen prep minutes today",
    permissions: ["kds.view", "orders.view"],
    handler: (ctx) => Orders.getAveragePreparationTime(ctx),
  }),

  tool({
    name: "getOccupiedTables",
    description: "List occupied tables",
    permissions: ["tables.view"],
    handler: (ctx) => Tables.getOccupiedTables(ctx),
  }),
  tool({
    name: "getAvailableTables",
    description: "List available tables",
    permissions: ["tables.view"],
    handler: (ctx) => Tables.getAvailableTables(ctx),
  }),
  tool({
    name: "getReservedTables",
    description: "List reserved tables",
    permissions: ["tables.view"],
    handler: (ctx) => Tables.getReservedTables(ctx),
  }),
  tool({
    name: "getCleaningTables",
    description: "Tables in CLEANING status",
    permissions: ["tables.view"],
    handler: (ctx) => Tables.getCleaningTables(ctx),
  }),
  tool({
    name: "getTableStatus",
    description: "Floor occupancy summary by status",
    permissions: ["tables.view"],
    handler: (ctx) => Tables.getTableStatus(ctx),
  }),

  tool({
    name: "getReservationsToday",
    description: "Reservations today",
    permissions: ["tables.view"],
    handler: () => Actions.notYetAvailable("Reservations"),
  }),
  tool({
    name: "getUpcomingReservations",
    description: "Upcoming reservations",
    permissions: ["tables.view"],
    handler: () => Actions.notYetAvailable("Reservations"),
  }),
  tool({
    name: "getCancelledReservations",
    description: "Cancelled reservations",
    permissions: ["tables.view"],
    handler: () => Actions.notYetAvailable("Reservations"),
  }),

  tool({
    name: "getCurrentStock",
    description: "Current inventory on hand",
    permissions: ["inventory.view"],
    handler: (ctx) => Inventory.getCurrentStock(ctx),
  }),
  tool({
    name: "getLowStockItems",
    description: "Items at or below reorder level",
    permissions: ["inventory.view"],
    handler: (ctx) => Inventory.getLowStockItems(ctx),
  }),
  tool({
    name: "getExpiringItems",
    description: "Batches nearing expiry",
    permissions: ["inventory.view"],
    handler: (ctx) => Inventory.getExpiringItems(ctx),
  }),
  tool({
    name: "getExpiredItems",
    description: "Expired batches",
    permissions: ["inventory.view"],
    handler: (ctx) => Inventory.getExpiredItems(ctx),
  }),
  tool({
    name: "getInventoryValue",
    description: "Total inventory valuation",
    permissions: ["inventory.view"],
    handler: (ctx) => Inventory.getInventoryValue(ctx),
  }),
  tool({
    name: "getIngredientConsumption",
    description: "Recent SALE stock movements",
    permissions: ["inventory.view"],
    handler: (ctx) => Inventory.getIngredientConsumption(ctx),
  }),

  tool({
    name: "getKitchenQueue",
    description: "Live kitchen tickets",
    permissions: ["kds.view"],
    handler: (ctx) => Kitchen.getKitchenQueue(ctx),
  }),
  tool({
    name: "getDelayedOrders",
    description: "Kitchen tickets waiting too long",
    permissions: ["kds.view"],
    handler: (ctx) => Kitchen.getDelayedOrders(ctx),
  }),
  tool({
    name: "getCookingTime",
    description: "Average cooking / prep time",
    permissions: ["kds.view"],
    handler: (ctx) => Kitchen.getCookingTime(ctx),
  }),
  tool({
    name: "getChefPerformance",
    description: "Kitchen throughput today",
    permissions: ["kds.view"],
    handler: (ctx) => Kitchen.getChefPerformance(ctx),
  }),

  tool({
    name: "getGSTCollected",
    description: "GST collected today with CGST/SGST split",
    permissions: ["reports.view"],
    handler: (ctx) => Finance.getGSTCollected(ctx),
  }),
  tool({
    name: "getCGST",
    description: "CGST portion today",
    permissions: ["reports.view"],
    handler: (ctx) => Finance.getCGST(ctx),
  }),
  tool({
    name: "getSGST",
    description: "SGST portion today",
    permissions: ["reports.view"],
    handler: (ctx) => Finance.getSGST(ctx),
  }),
  tool({
    name: "getIGST",
    description: "IGST portion",
    permissions: ["reports.view"],
    handler: (ctx) => Finance.getIGST(ctx),
  }),
  tool({
    name: "getExpenses",
    description: "Expense ledger",
    permissions: ["reports.view"],
    handler: (ctx) => Finance.getExpenses(ctx),
  }),
  tool({
    name: "getCashFlow",
    description: "Payments collected today by method",
    permissions: ["reports.view", "payments.create"],
    handler: (ctx) => Finance.getCashFlow(ctx),
  }),
  tool({
    name: "getProfitReport",
    description: "Profit estimate report",
    permissions: ["reports.view"],
    handler: (ctx) => Finance.getProfitReport(ctx),
  }),

  tool({
    name: "getAttendanceToday",
    description: "Employee attendance today",
    permissions: ["users.manage"],
    handler: () => Actions.notYetAvailable("HR attendance"),
  }),
  tool({
    name: "getLateEmployees",
    description: "Late employees today",
    permissions: ["users.manage"],
    handler: () => Actions.notYetAvailable("HR attendance"),
  }),
  tool({
    name: "getLeaveRequests",
    description: "Pending leave requests",
    permissions: ["users.manage"],
    handler: () => Actions.notYetAvailable("HR leave"),
  }),
  tool({
    name: "getPayroll",
    description: "Payroll summary",
    permissions: ["users.manage"],
    handler: () => Actions.notYetAvailable("Payroll"),
  }),

  tool({
    name: "getTopCustomers",
    description: "Top customers by spend",
    permissions: ["reports.view"],
    handler: () => Actions.notYetAvailable("CRM customers"),
  }),
  tool({
    name: "getCustomerLifetimeValue",
    description: "Customer LTV",
    permissions: ["reports.view"],
    handler: () => Actions.notYetAvailable("CRM LTV"),
  }),
  tool({
    name: "getLoyaltyPoints",
    description: "Loyalty points overview",
    permissions: ["reports.view"],
    handler: () => Actions.notYetAvailable("Loyalty"),
  }),
  tool({
    name: "getBirthdays",
    description: "Customer birthdays",
    permissions: ["reports.view"],
    handler: () => Actions.notYetAvailable("CRM birthdays"),
  }),

  tool({
    name: "getSuppliers",
    description: "Supplier list",
    permissions: ["inventory.view"],
    handler: async (ctx) => {
      const { Supplier } = await import("@/models/Supplier");
      const list = await Supplier.find({
        restaurantId: ctx.restaurantId,
        branchId: ctx.branchId,
        isActive: true,
      })
        .limit(50)
        .lean();
      return {
        ok: true,
        summary: `${list.length} active suppliers.`,
        blocks: [
          {
            type: "table",
            title: "Suppliers",
            data: {
              columns: ["company", "phone", "rating", "gst"],
              rows: list.map((s) => ({
                company: s.company,
                phone: s.phone,
                rating: s.rating,
                gst: s.gstNumber || "—",
              })),
            },
          },
        ],
      };
    },
  }),
  tool({
    name: "getPendingPurchaseOrders",
    description: "Pending POs",
    permissions: ["inventory.view"],
    handler: async (ctx) => {
      const { PurchaseOrder } = await import("@/models/PurchaseOrder");
      const list = await PurchaseOrder.find({
        restaurantId: ctx.restaurantId,
        branchId: ctx.branchId,
        status: { $in: ["SENT", "PARTIAL", "DRAFT"] },
      })
        .limit(30)
        .lean();
      return {
        ok: true,
        summary: `${list.length} open purchase orders.`,
        blocks: [
          {
            type: "table",
            title: "Open POs",
            data: {
              columns: ["poNumber", "status"],
              rows: list.map((o) => ({
                poNumber: o.poNumber,
                status: o.status,
              })),
            },
          },
        ],
      };
    },
  }),
  tool({
    name: "getVendorPerformance",
    description: "Vendor KPIs",
    permissions: ["inventory.view"],
    handler: () => Actions.notYetAvailable("Vendor scorecards (ratings live on Supplier)"),
  }),

  tool({
    name: "generateGSTReport",
    description: "Generate GST report summary",
    permissions: ["reports.view"],
    handler: (ctx) => Finance.generateGSTReport(ctx),
  }),
  tool({
    name: "generateSalesReport",
    description: "Generate sales report with top items",
    permissions: ["reports.view"],
    handler: (ctx) => Finance.generateSalesReport(ctx),
  }),
  tool({
    name: "generateInventoryReport",
    description: "Generate inventory report",
    permissions: ["inventory.view"],
    handler: (ctx) => Finance.generateInventoryReport(ctx),
  }),
  tool({
    name: "generateProfitReport",
    description: "Generate profit report",
    permissions: ["reports.view"],
    handler: (ctx) => Finance.generateProfitReport(ctx),
  }),

  tool({
    name: "forecastTomorrowSales",
    description: "Predict tomorrow's sales",
    permissions: ["reports.view"],
    handler: (ctx) => Forecast.forecastTomorrowSales(ctx),
  }),
  tool({
    name: "forecastWeekendSales",
    description: "Predict weekend sales",
    permissions: ["reports.view"],
    handler: (ctx) => Forecast.forecastWeekendSales(ctx),
  }),
  tool({
    name: "forecastMonthlyRevenue",
    description: "Project monthly revenue",
    permissions: ["reports.view"],
    handler: (ctx) => Forecast.forecastMonthlyRevenue(ctx),
  }),
  tool({
    name: "forecastDemand",
    description: "Demand forecast",
    permissions: ["reports.view"],
    handler: (ctx) => Forecast.forecastDemand(ctx),
  }),
  tool({
    name: "forecastInventory",
    description: "Inventory replenishment forecast",
    permissions: ["inventory.view"],
    handler: (ctx) => Forecast.forecastInventory(ctx),
  }),
  tool({
    name: "forecastStaff",
    description: "Suggested staffing for demand",
    permissions: ["reports.view"],
    handler: (ctx) => Forecast.forecastStaff(ctx),
  }),
  tool({
    name: "getAiInsights",
    description: "Automatic multi-domain insights snapshot",
    permissions: ["reports.view"],
    handler: (ctx) => Forecast.getInsights(ctx),
  }),

  // —— Actions ——
  tool({
    name: "markKitchenOrderReady",
    description: "Mark a kitchen order READY by orderNumber",
    permissions: ["kds.update"],
    isAction: true,
    parameters: {
      type: "object",
      properties: { orderNumber: { type: "string" } },
      required: ["orderNumber"],
    },
    handler: (ctx, args) => Kitchen.markKitchenOrderReady(ctx, args),
  }),
  tool({
    name: "closeTable",
    description: "Move a table to CLEANING by tableNumber",
    permissions: ["tables.update"],
    isAction: true,
    parameters: {
      type: "object",
      properties: { tableNumber: { type: "number" } },
      required: ["tableNumber"],
    },
    handler: (ctx, args) => Actions.closeTable(ctx, args),
  }),
  tool({
    name: "markTableAvailable",
    description: "Mark table AVAILABLE after cleaning",
    permissions: ["tables.update"],
    isAction: true,
    parameters: {
      type: "object",
      properties: { tableNumber: { type: "number" } },
      required: ["tableNumber"],
    },
    handler: (ctx, args) => Actions.markTableAvailable(ctx, args),
  }),
  tool({
    name: "suggestPurchaseOrder",
    description: "Create purchase suggestion from low stock",
    permissions: ["inventory.edit"],
    isAction: true,
    handler: (ctx) => Actions.suggestPurchaseOrder(ctx),
  }),
  tool({
    name: "createDiscount",
    description: "Draft a discount for manager review",
    permissions: ["menu.edit"],
    isAction: true,
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        percent: { type: "number" },
      },
      required: ["name"],
    },
    handler: (ctx, args) => Actions.createDiscountNote(ctx, args),
  }),
  tool({
    name: "searchKnowledge",
    description:
      "Semantic/keyword search over indexed restaurant knowledge: menu, recipes, inventory notes, restaurant policies, and uploaded SOPs. Use for allergens, prep, policies, SOP questions — not for live sales numbers.",
    permissions: ["ai.use"],
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language question" },
        sourceTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["MENU_ITEM", "RECIPE", "INVENTORY", "RESTAURANT", "UPLOAD"],
          },
          description: "Optional filter of source types",
        },
        topK: {
          type: "number",
          description: "Max snippets (1–20, default 6)",
        },
      },
      required: ["query"],
    },
    handler: (ctx, args) => Rag.searchKnowledgeTool(ctx, args),
  }),
  tool({
    name: "reindexKnowledge",
    description:
      "Rebuild RAG index from live menu, recipes, inventory, and restaurant settings (OWNER/MANAGER). Does not delete uploaded SOPs.",
    permissions: ["ai.use"],
    isAction: true,
    handler: (ctx, args) => Rag.reindexKnowledgeTool(ctx, args),
  }),
  tool({
    name: "listKnowledgeDocs",
    description: "List indexed knowledge documents and sync status",
    permissions: ["ai.use"],
    parameters: {
      type: "object",
      properties: {
        uploadsOnly: {
          type: "boolean",
          description: "If true, only list uploaded SOPs",
        },
      },
    },
    handler: (ctx, args) => Rag.listKnowledgeDocsTool(ctx, args),
  }),
];

export const TOOL_BY_NAME = new Map(AI_TOOLS.map((t) => [t.name, t]));

export function toolsForOpenAI(allowed: AiToolDefinition[]) {
  return allowed.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function filterToolsForUser(
  permissions: readonly string[]
): AiToolDefinition[] {
  return AI_TOOLS.filter((t) => {
    if (t.isAction && !permissions.includes("ai.actions")) return false;
    return t.permissions.some((p) => permissions.includes(p));
  });
}
