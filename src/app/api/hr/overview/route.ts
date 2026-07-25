import { User } from "@/models/User";
import { Attendance } from "@/models/Attendance";
import { LeaveRequest } from "@/models/LeaveRequest";
import { PayrollEntry } from "@/models/PayrollEntry";
import { withAuth, json } from "@/lib/api";

type UserLean = {
  _id: { toString(): string };
  name: string;
  role: string;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function periodNow() {
  return new Date().toISOString().slice(0, 7);
}

/** HR overview KPIs for the branch. */
export const GET = withAuth(async ({ tenant }) => {
  const today = todayKey();
  const period = periodNow();

  const users = (await User.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    isActive: true,
  })
    .select("name role")
    .lean()) as unknown as UserLean[];

  const [attToday, pendingLeaves, payrollRows, monthLeaves] =
    await Promise.all([
      Attendance.find({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        date: today,
      }).lean(),
      LeaveRequest.countDocuments({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        status: "PENDING",
      }),
      PayrollEntry.find({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        period,
      }).lean(),
      LeaveRequest.find({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        status: "APPROVED",
        fromDate: { $lte: `${period}-31` },
        toDate: { $gte: `${period}-01` },
      }).lean(),
    ]);

  const present = attToday.filter(
    (a) => a.status === "PRESENT" || a.status === "LATE"
  ).length;
  const onLeave = attToday.filter((a) => a.status === "LEAVE").length;
  const late = attToday.filter((a) => a.status === "LATE").length;
  const headcount = users.length;

  const payrollTotal = payrollRows.reduce((s, r) => s + (r.netPaise || 0), 0);
  const leaveDaysMonth = monthLeaves.reduce((s, r) => s + (r.days || 0), 0);

  const byRole: Record<string, number> = {};
  for (const u of users) {
    byRole[u.role] = (byRole[u.role] || 0) + 1;
  }

  return json({
    today,
    period,
    headcount,
    present,
    late,
    onLeave,
    absent: Math.max(0, headcount - present - onLeave),
    pendingLeaves,
    leaveDaysMonth,
    payrollTotalPaise: payrollTotal,
    payrollRows: payrollRows.length,
    byRole,
    staff: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      role: u.role,
    })),
  });
}, "users.manage");
