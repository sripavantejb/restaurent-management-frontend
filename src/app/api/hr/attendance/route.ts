import { z } from "zod";
import { Attendance } from "@/models/Attendance";
import { User, type IUser } from "@/models/User";
import { withAuth, json, error } from "@/lib/api";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export const GET = withAuth(async ({ tenant }) => {
  const date = todayKey();
  const [rows, users] = await Promise.all([
    Attendance.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      date,
    }).lean(),
    User.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      isActive: true,
    })
      .select("name role")
      .lean() as unknown as Promise<Pick<IUser, "_id" | "name" | "role">[]>,
  ]);
  const byUser = new Map(rows.map((r) => [r.userId.toString(), r]));
  return json({
    date,
    attendance: users.map((u) => {
      const a = byUser.get(u._id.toString());
      return {
        userId: u._id.toString(),
        name: u.name,
        role: u.role,
        status: a?.status ?? "ABSENT",
        checkInAt: a?.checkInAt ?? null,
        checkOutAt: a?.checkOutAt ?? null,
        recordId: a?._id.toString() ?? null,
      };
    }),
  });
}, "users.manage");

const Body = z.object({
  userId: z.string().min(1),
  action: z.enum(["checkin", "checkout", "leave", "absent"]),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = Body.parse(await req.json());
    const date = todayKey();
    let status: "PRESENT" | "LATE" | "LEAVE" | "ABSENT" = "PRESENT";
    const now = new Date();
    if (body.action === "leave") status = "LEAVE";
    if (body.action === "absent") status = "ABSENT";
    if (body.action === "checkin") {
      status = now.getHours() >= 11 ? "LATE" : "PRESENT";
    }

    const update: Record<string, unknown> = { status };
    if (body.action === "checkin") update.checkInAt = now;
    if (body.action === "checkout") update.checkOutAt = now;

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
      status: row.status,
      checkInAt: row.checkInAt,
      checkOutAt: row.checkOutAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid", 400);
    throw err;
  }
}, "users.manage");
