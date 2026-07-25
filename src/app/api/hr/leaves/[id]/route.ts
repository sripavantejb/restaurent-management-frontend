import { z } from "zod";
import { Types } from "mongoose";
import { LeaveRequest } from "@/models/LeaveRequest";
import { Attendance } from "@/models/Attendance";
import { withAuth, json, error, getParams } from "@/lib/api";

const PatchBody = z.object({
  action: z.enum(["approve", "reject", "cancel"]),
  reviewNote: z.string().optional().default(""),
});

export const PATCH = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing leave id", 400);

  try {
    const body = PatchBody.parse(await req.json());
    const leave = await LeaveRequest.findOne({
      _id: id,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    if (!leave) return error("Leave not found", 404);

    if (body.action === "cancel") {
      leave.status = "CANCELLED";
      leave.reviewNote = body.reviewNote || leave.reviewNote;
      leave.reviewedBy = new Types.ObjectId(tenant.userId);
      leave.reviewedAt = new Date();
      await leave.save();
      return json({ id: leave._id.toString(), status: leave.status });
    }

    if (leave.status !== "PENDING") {
      return error("Only pending leaves can be reviewed", 400);
    }

    leave.status = body.action === "approve" ? "APPROVED" : "REJECTED";
    leave.reviewNote = body.reviewNote;
    leave.reviewedBy = new Types.ObjectId(tenant.userId);
    leave.reviewedAt = new Date();
    await leave.save();

    if (leave.status === "APPROVED") {
      let d = new Date(leave.fromDate + "T00:00:00");
      const end = new Date(leave.toDate + "T00:00:00");
      while (d <= end) {
        const date = d.toISOString().slice(0, 10);
        await Attendance.findOneAndUpdate(
          {
            restaurantId: tenant.restaurantId,
            branchId: tenant.branchId,
            userId: leave.userId,
            date,
          },
          {
            $set: {
              status: "LEAVE",
              checkInAt: null,
              checkOutAt: null,
              notes: `Leave · ${leave.type}`,
            },
            $setOnInsert: {
              restaurantId: tenant.restaurantId,
              branchId: tenant.branchId,
              userId: leave.userId,
              date,
            },
          },
          { upsert: true }
        );
        d = new Date(d.getTime() + 86400000);
      }
    }

    return json({
      id: leave._id.toString(),
      status: leave.status,
      reviewedAt: leave.reviewedAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid", 400);
    throw err;
  }
}, "users.manage");
