import { z } from "zod";
import { Expense } from "@/models/Expense";
import { Order } from "@/models/Order";
import { withAuth, json, error } from "@/lib/api";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const report = url.searchParams.get("report");

  const expenses = await Expense.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  })
    .sort({ paidAt: -1 })
    .limit(100)
    .lean();

  if (report === "pnl") {
    const today = startOfDay();
    const month = new Date(today);
    month.setDate(1);
    const [orders, monthExpenses] = await Promise.all([
      Order.find({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        status: "COMPLETED",
        completedAt: { $gte: month },
      })
        .select("total taxAmount")
        .lean(),
      Expense.find({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        paidAt: { $gte: month },
      }).lean(),
    ]);
    const revenue = orders.reduce((s, o) => s + o.total, 0);
    const tax = orders.reduce((s, o) => s + (o.taxAmount || 0), 0);
    const expenseTotal = monthExpenses.reduce((s, e) => s + e.amountPaise, 0);
    return json({
      pnl: {
        revenuePaise: revenue,
        taxPaise: tax,
        expensesPaise: expenseTotal,
        profitPaise: revenue - expenseTotal,
      },
    });
  }

  const todayStart = startOfDay();
  const todayTotal = expenses
    .filter((e) => e.paidAt && new Date(e.paidAt) >= todayStart)
    .reduce((s, e) => s + e.amountPaise, 0);

  return json({
    expenses: expenses.map((e) => ({
      id: e._id.toString(),
      category: e.category,
      description: e.description,
      amountPaise: e.amountPaise,
      paidAt: e.paidAt,
      paymentMethod: e.paymentMethod,
      vendor: e.vendor,
    })),
    todayTotalPaise: todayTotal,
  });
}, "reports.view");

const CreateSchema = z.object({
  category: z.string().min(1),
  description: z.string().optional().default(""),
  amountPaise: z.number().int().positive(),
  paymentMethod: z.string().optional().default("CASH"),
  vendor: z.string().optional().default(""),
  paidAt: z.string().optional(),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateSchema.parse(await req.json());
    const e = await Expense.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      category: body.category,
      description: body.description,
      amountPaise: body.amountPaise,
      paymentMethod: body.paymentMethod,
      vendor: body.vendor,
      paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
      createdBy: tenant.userId,
    });
    return json({ id: e._id.toString() }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid expense", 400);
    throw err;
  }
}, "inventory.finance");
