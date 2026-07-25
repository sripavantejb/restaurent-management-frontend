import { NextResponse } from "next/server";
import { User } from "@/models/User";
import { Attendance } from "@/models/Attendance";
import { PayrollEntry } from "@/models/PayrollEntry";
import { withAuth, json } from "@/lib/api";

function periodNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type StaffLean = {
  _id: { toString(): string };
  name: string;
  role: string;
};

/** Build / refresh payroll stub for current month from attendance. */
export const POST = withAuth(async ({ tenant }) => {
  const period = periodNow();
  const staff = (await User.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    isActive: true,
  }).lean()) as unknown as StaffLean[];

  const rows = [];
  for (const u of staff) {
    const att = await Attendance.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      userId: u._id,
      date: { $regex: `^${period}` },
    }).lean();

    const daysPresent = att.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    const daysLeave = att.filter((a) => a.status === "LEAVE").length;
    const basePaise =
      u.role === "OWNER"
        ? 0
        : u.role === "MANAGER"
          ? 4500000
          : u.role === "CHEF"
            ? 2800000
            : 1800000;
    const perDay = Math.round(basePaise / 26);
    const netPaise = Math.max(0, perDay * daysPresent);

    const entry = await PayrollEntry.findOneAndUpdate(
      {
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        userId: u._id,
        period,
      },
      {
        $set: {
          basePaise,
          daysPresent,
          daysLeave,
          netPaise,
          notes: "Auto from attendance (stub rates)",
        },
      },
      { upsert: true, new: true }
    );

    rows.push({
      userId: u._id.toString(),
      name: u.name,
      role: u.role,
      period,
      daysPresent,
      daysLeave,
      basePaise,
      netPaise,
      id: entry!._id.toString(),
    });
  }

  return json({ period, rows });
}, "users.manage");

export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || periodNow();
  const format = url.searchParams.get("format");

  const entries = await PayrollEntry.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    period,
  }).lean();

  const users = (await User.find({
    _id: { $in: entries.map((e) => e.userId) },
  })
    .select("name role email")
    .lean()) as unknown as {
    _id: { toString(): string };
    name?: string;
    role?: string;
    email?: string;
  }[];
  const umap = new Map(users.map((u) => [u._id.toString(), u]));

  const rows = entries.map((e) => {
    const u = umap.get(e.userId.toString());
    return {
      name: u?.name || "",
      email: u?.email || "",
      role: u?.role || "",
      period: e.period,
      daysPresent: e.daysPresent,
      daysLeave: e.daysLeave,
      basePaise: e.basePaise,
      netPaise: e.netPaise,
      netInr: e.netPaise / 100,
    };
  });

  if (format === "csv") {
    const header =
      "name,email,role,period,daysPresent,daysLeave,baseInr,netInr\n";
    const lines = rows
      .map(
        (r) =>
          `"${r.name}","${r.email}",${r.role},${r.period},${r.daysPresent},${r.daysLeave},${(r.basePaise / 100).toFixed(2)},${r.netInr.toFixed(2)}`
      )
      .join("\n");
    return new NextResponse(header + lines, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll-${period}.csv"`,
      },
    });
  }

  return json({ period, rows });
}, "users.manage");
