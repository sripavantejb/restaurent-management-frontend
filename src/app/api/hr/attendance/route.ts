import { z } from "zod";
import { Attendance } from "@/models/Attendance";
import { User, type IUser } from "@/models/User";
import { withAuth, json, error } from "@/lib/api";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function periodNow() {
  return new Date().toISOString().slice(0, 7);
}

type UserLean = Pick<IUser, "_id" | "name" | "role"> & {
  _id: { toString(): string };
};

/** GET ?date=YYYY-MM-DD | ?period=YYYY-MM | default today */
export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const period = url.searchParams.get("period");
  const userId = url.searchParams.get("userId");

  const users = (await User.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    isActive: true,
  })
    .select("name role")
    .lean()) as unknown as UserLean[];

  // Month matrix
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const filter: Record<string, unknown> = {
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      date: { $regex: `^${period}` },
    };
    if (userId) filter.userId = userId;
    const rows = await Attendance.find(filter).lean();

    const byUserDate = new Map<string, (typeof rows)[0]>();
    for (const r of rows) {
      byUserDate.set(`${r.userId.toString()}:${r.date}`, r);
    }

    const daysInMonth = new Date(
      Number(period.slice(0, 4)),
      Number(period.slice(5, 7)),
      0
    ).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) =>
      `${period}-${String(i + 1).padStart(2, "0")}`
    );

    const staff = userId
      ? users.filter((u) => u._id.toString() === userId)
      : users;

    const matrix = staff.map((u) => {
      const dayMap: Record<
        string,
        {
          status: string;
          checkInAt: string | null;
          checkOutAt: string | null;
        }
      > = {};
      let present = 0;
      let late = 0;
      let leave = 0;
      let absent = 0;
      for (const d of days) {
        const a = byUserDate.get(`${u._id.toString()}:${d}`);
        const status = a?.status ?? (d > todayKey() ? "—" : "ABSENT");
        if (status === "PRESENT") present += 1;
        else if (status === "LATE") late += 1;
        else if (status === "LEAVE") leave += 1;
        else if (status === "ABSENT") absent += 1;
        dayMap[d] = {
          status,
          checkInAt: a?.checkInAt ? new Date(a.checkInAt).toISOString() : null,
          checkOutAt: a?.checkOutAt ? new Date(a.checkOutAt).toISOString() : null,
        };
      }
      return {
        userId: u._id.toString(),
        name: u.name,
        role: u.role,
        days: dayMap,
        summary: { present, late, leave, absent },
      };
    });

    return json({ period, days, matrix });
  }

  // Single day roster
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : todayKey();
  const filter: Record<string, unknown> = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    date,
  };
  if (userId) filter.userId = userId;
  const rows = await Attendance.find(filter).lean();
  const byUser = new Map(rows.map((r) => [r.userId.toString(), r]));
  const staff = userId
    ? users.filter((u) => u._id.toString() === userId)
    : users;

  return json({
    date,
    period: periodNow(),
    attendance: staff.map((u) => {
      const a = byUser.get(u._id.toString());
      return {
        userId: u._id.toString(),
        name: u.name,
        role: u.role,
        status: a?.status ?? "ABSENT",
        checkInAt: a?.checkInAt ?? null,
        checkOutAt: a?.checkOutAt ?? null,
        notes: a?.notes ?? "",
        recordId: a?._id.toString() ?? null,
      };
    }),
  });
}, "users.manage");

const Body = z.object({
  userId: z.string().min(1),
  action: z.enum(["checkin", "checkout", "leave", "absent", "present"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = Body.parse(await req.json());
    const date = body.date || todayKey();
    let status: "PRESENT" | "LATE" | "LEAVE" | "ABSENT" = "PRESENT";
    const now = new Date();
    if (body.action === "leave") status = "LEAVE";
    if (body.action === "absent") status = "ABSENT";
    if (body.action === "present") status = "PRESENT";
    if (body.action === "checkin") {
      status = now.getHours() >= 11 ? "LATE" : "PRESENT";
    }

    const update: Record<string, unknown> = { status };
    if (body.notes != null) update.notes = body.notes;
    if (body.action === "checkin") update.checkInAt = now;
    if (body.action === "checkout") update.checkOutAt = now;
    if (body.action === "leave" || body.action === "absent") {
      update.checkInAt = null;
      update.checkOutAt = null;
    }

    const row = await Attendance.findOneAndUpdate(
      {
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        userId: body.userId,
        date,
      },
      {
        $set: update,
        $setOnInsert: {
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          userId: body.userId,
          date,
        },
      },
      { upsert: true, new: true }
    );
    return json({
      id: row._id.toString(),
      date,
      status: row.status,
      checkInAt: row.checkInAt,
      checkOutAt: row.checkOutAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid", 400);
    throw err;
  }
}, "users.manage");
