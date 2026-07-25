import { z } from "zod";
import { Types } from "mongoose";
import { LeaveRequest, LEAVE_ENTITLEMENTS, LEAVE_TYPES, countLeaveDays } from "@/models/LeaveRequest";
import { User } from "@/models/User";
import { Attendance } from "@/models/Attendance";
import { withAuth, json, error } from "@/lib/api";

function yearNow() {
  return new Date().getFullYear();
}

function periodNow() {
  return new Date().toISOString().slice(0, 7);
}

/** List leave requests + balances. ?userId= & ?period=YYYY-MM & ?status= */
export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const period = url.searchParams.get("period") || periodNow();
  const status = url.searchParams.get("status");
  const year = url.searchParams.get("year") || String(yearNow());

  const filter: Record<string, unknown> = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  };
  if (userId) filter.userId = userId;
  if (status) filter.status = status.toUpperCase();

  // Month filter overlaps period
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const monthStart = `${period}-01`;
    const last = new Date(
      Number(period.slice(0, 4)),
      Number(period.slice(5, 7)),
      0
    ).getDate();
    const monthEnd = `${period}-${String(last).padStart(2, "0")}`;
    filter.$or = [
      { fromDate: { $lte: monthEnd }, toDate: { $gte: monthStart } },
    ];
  }

  const [rows, users] = await Promise.all([
    LeaveRequest.find(filter).sort({ fromDate: -1 }).limit(300).lean(),
    User.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      isActive: true,
    })
      .select("name role email")
      .lean(),
  ]);

  const umap = new Map(
    users.map((u) => [
      u._id.toString(),
      { name: u.name, role: u.role, email: u.email },
    ])
  );

  const leaves = rows.map((r) => {
    const u = umap.get(r.userId.toString());
    return {
      id: r._id.toString(),
      userId: r.userId.toString(),
      name: u?.name || "",
      role: u?.role || "",
      email: u?.email || "",
      type: r.type,
      status: r.status,
      fromDate: r.fromDate,
      toDate: r.toDate,
      days: r.days,
      reason: r.reason,
      reviewNote: r.reviewNote,
      reviewedAt: r.reviewedAt,
      createdAt: (r as { createdAt?: Date }).createdAt ?? null,
    };
  });

  // Balances for year (approved only)
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const approved = await LeaveRequest.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    status: "APPROVED",
    fromDate: { $lte: yearEnd },
    toDate: { $gte: yearStart },
    ...(userId ? { userId } : {}),
  }).lean();

  const usedByUser = new Map<string, Record<string, number>>();
  for (const r of approved) {
    const id = r.userId.toString();
    if (!usedByUser.has(id)) {
      usedByUser.set(
        id,
        Object.fromEntries(LEAVE_TYPES.map((t) => [t, 0]))
      );
    }
    const bag = usedByUser.get(id)!;
    bag[r.type] = (bag[r.type] || 0) + r.days;
  }

  const balances = users
    .filter((u) => !userId || u._id.toString() === userId)
    .map((u) => {
      const used = usedByUser.get(u._id.toString()) || {};
      const byType = LEAVE_TYPES.map((t) => ({
        type: t,
        entitled: LEAVE_ENTITLEMENTS[t],
        used: used[t] || 0,
        remaining: Math.max(0, LEAVE_ENTITLEMENTS[t] - (used[t] || 0)),
      }));
      return {
        userId: u._id.toString(),
        name: u.name,
        role: u.role,
        year,
        byType,
        totalUsed: byType.reduce((s, x) => s + x.used, 0),
        totalRemaining: byType.reduce((s, x) => s + x.remaining, 0),
      };
    });

  // Month calendar cells: approved leave days per user
  const monthDays: {
    userId: string;
    name: string;
    dates: { date: string; type: string; leaveId: string }[];
  }[] = [];
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    for (const u of users) {
      if (userId && u._id.toString() !== userId) continue;
      const dates: { date: string; type: string; leaveId: string }[] = [];
      for (const r of rows) {
        if (r.userId.toString() !== u._id.toString()) continue;
        if (r.status !== "APPROVED" && r.status !== "PENDING") continue;
        let d = new Date(r.fromDate + "T00:00:00");
        const end = new Date(r.toDate + "T00:00:00");
        while (d <= end) {
          const key = d.toISOString().slice(0, 10);
          if (key.startsWith(period)) {
            dates.push({
              date: key,
              type: r.type,
              leaveId: r._id.toString(),
            });
          }
          d = new Date(d.getTime() + 86400000);
        }
      }
      monthDays.push({
        userId: u._id.toString(),
        name: u.name,
        dates,
      });
    }
  }

  return json({
    period,
    year,
    leaves,
    balances,
    monthDays,
    entitlements: LEAVE_ENTITLEMENTS,
  });
}, "users.manage");

const CreateBody = z.object({
  userId: z.string().min(1),
  type: z.enum(LEAVE_TYPES),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional().default(""),
  autoApprove: z.boolean().optional().default(false),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateBody.parse(await req.json());
    const days = countLeaveDays(body.fromDate, body.toDate);
    if (days <= 0) return error("Invalid date range", 400);

    const user = await User.findOne({
      _id: body.userId,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    if (!user) return error("Staff not found", 404);

    const status = body.autoApprove ? "APPROVED" : "PENDING";
    const leave = await LeaveRequest.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      userId: body.userId,
      type: body.type,
      status,
      fromDate: body.fromDate,
      toDate: body.toDate,
      days,
      reason: body.reason,
      reviewedBy: body.autoApprove ? tenant.userId : null,
      reviewedAt: body.autoApprove ? new Date() : null,
      reviewNote: body.autoApprove ? "Auto-approved" : "",
    });

    // Sync attendance LEAVE for approved ranges
    if (status === "APPROVED") {
      await syncAttendanceLeave(
        tenant.restaurantId,
        tenant.branchId,
        body.userId,
        body.fromDate,
        body.toDate
      );
    }

    return json(
      {
        id: leave._id.toString(),
        days,
        status: leave.status,
      },
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid leave", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "users.manage");

async function syncAttendanceLeave(
  restaurantId: Types.ObjectId,
  branchId: Types.ObjectId,
  userId: string,
  fromDate: string,
  toDate: string
) {
  let d = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate + "T00:00:00");
  while (d <= end) {
    const date = d.toISOString().slice(0, 10);
    await Attendance.findOneAndUpdate(
      { restaurantId, branchId, userId, date },
      {
        $set: {
          status: "LEAVE",
          checkInAt: null,
          checkOutAt: null,
          notes: "Approved leave",
        },
        $setOnInsert: { restaurantId, branchId, userId, date },
      },
      { upsert: true }
    );
    d = new Date(d.getTime() + 86400000);
  }
}
